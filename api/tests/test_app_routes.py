import psycopg
from fastapi.testclient import TestClient

from app.main import app
from app.routers import metrics as metrics_router

client = TestClient(app)


def test_every_router_is_mounted():
    paths = set(app.openapi()["paths"])
    assert {"/health", "/dataset", "/queue", "/metrics", "/ingest/orbit", "/ingest/spot"} <= paths


def test_metrics_reports_unavailable_database(monkeypatch):
    def down():
        raise psycopg.OperationalError("connection refused")

    monkeypatch.setattr(metrics_router, "get_metrics", down)
    response = client.get("/metrics")
    assert response.status_code == 503
