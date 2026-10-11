import psycopg
from fastapi.testclient import TestClient

from app.main import app
from app.orchestrators import metrics as metrics_router

client = TestClient(app)


def test_every_router_is_mounted():
    paths = set(app.openapi()["paths"])
    assert {
        "/health",
        "/dataset",
        "/queue",
        "/metrics",
        "/ingest/orbit",
        "/ingest/spot",
        "/api/auth/login",
        "/api/organizations",
        "/api/orbit/connections",
        "/api/webhooks/orbit/{webhook_id}",
        "/api/orbit/organizations/{organization_id}/inspections",
    } <= paths


def test_metrics_reports_unavailable_database(monkeypatch):
    def down(organization_id: str):
        raise psycopg.OperationalError("connection refused")

    login = client.post(
        "/api/auth/login",
        json={"email": "operator.north@sentinel.local", "password": "sentinel"},
    )
    monkeypatch.setattr(metrics_router, "get_metrics", down)
    response = client.get("/metrics", headers={"Authorization": "Bearer " + login.json()["token"]})
    assert response.status_code == 503
