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


def test_orbit_route_preserves_partial_records_for_the_web_dashboard(monkeypatch):
    from app.mappers.orbit import map_orbit
    from app.services.dataset import to_dataset

    batch = map_orbit({
        "uuid": "orbit-run-1",
        "missionName": "Boiler inspection",
        "startTime": "2026-10-10T12:00:00Z",
        "status": "IN_PROGRESS",
        "runEvents": [{
            "uuid": "orbit-action-1", "runUuid": "orbit-run-1",
            "actionName": "GAUGE_READING", "actionStatus": "FAILED",
            "failureType": "SENSOR_TIMEOUT", "time": "2026-10-10T12:01:00Z",
        }],
    })
    monkeypatch.setattr(dataset_router, "get_dataset", lambda source: to_dataset(batch))
    response = client.get("/dataset?source=orbit")
    assert response.status_code == 200
    data = response.json()
    assert data["missions"][0]["end_time"] is None
    assert data["actions"][0]["failure_type"] == "SENSOR_TIMEOUT"
    assert data["actions"][0]["timestamp"] == "2026-10-10T12:01:00"
    assert [event["event_type"] for event in data["events"]] == ["MISSION_STARTED", "ACTION_STARTED", "ACTION_FAILED"]
    assert data["locations"] == []
