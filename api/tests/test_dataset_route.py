import psycopg
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import dataset as dataset_router
from app.schemas.canonical import Source
from app.schemas.dataset import AssetOut, InspectionDataset

client = TestClient(app)


@pytest.fixture
def served(monkeypatch):
    calls: list[Source] = []

    def fake(source: Source) -> InspectionDataset:
        calls.append(source)
        return InspectionDataset(
            assets=[AssetOut(asset_id="HX-201", asset_name="Heat Exchanger 01", asset_type="Heat Exchanger", location_id="WP05", criticality="LOW")]
        )

    monkeypatch.setattr(dataset_router, "get_dataset", fake)
    return calls


def test_dataset_defaults_to_kit(served):
    response = client.get("/dataset")
    assert response.status_code == 200
    assert response.json()["assets"][0]["asset_id"] == "HX-201"
    assert response.json()["events"] == []
    assert served == [Source.kit]


def test_dataset_rejects_unknown_source(served):
    assert client.get("/dataset?source=bogus").status_code == 422
    assert served == []


def test_dataset_reports_unavailable_database(monkeypatch):
    def down(source: Source) -> InspectionDataset:
        raise psycopg.OperationalError("connection refused")

    monkeypatch.setattr(dataset_router, "get_dataset", down)
    response = client.get("/dataset")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unavailable"}


def test_expo_web_origin_may_call_the_api(served):
    response = client.options(
        "/dataset",
        headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
