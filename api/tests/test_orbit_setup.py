from fastapi.testclient import TestClient

from app.main import app
from app.orbit.catalog import MemoryCatalog
from app.orbit.models import InspectionRecord
from app.orbit.provider import MockOrbitProvider, OrbitUnavailable, RealOrbitProvider
from app.orbit.service import inspection_batch
from app.orchestrators import orbit as orbit_router

client = TestClient(app)

EVENT = {
    "event_type": "ACTION_COMPLETED",
    "mission_id": "mission_123",
    "action_id": "action_456",
    "robot_id": "spot_01",
    "organization_id": "org_attacker",
}


def _install():
    catalog = MemoryCatalog()
    provider = MockOrbitProvider(catalog)
    app.dependency_overrides[orbit_router.get_catalog] = lambda: catalog
    app.dependency_overrides[orbit_router.get_provider] = lambda: provider
    return catalog, provider


def _login(email: str = "operator.north@sentinel.local") -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": "sentinel"})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _connect(facility: str, instance: str, email: str = "operator.north@sentinel.local") -> dict:
    response = client.post(
        "/api/orbit/connections",
        json={"facility_name": facility, "instance_url": instance},
        headers={"Authorization": "Bearer " + _login(email)},
    )
    assert response.status_code == 200, response.text
    return response.json()


def setup_function():
    app.dependency_overrides.clear()


def teardown_function():
    app.dependency_overrides.clear()


def test_setup_returns_a_secret_once_and_lists_without_it():
    _install()
    created = _connect("Facility A", "orbit-a.example")
    assert created["integration"]["mode"] == "simulated"
    assert created["secret"]
    assert created["callback_path"] == "/api/webhooks/orbit/" + created["subscription_id"]
    listed = client.get(
        "/api/orbit/connections",
        headers={"Authorization": "Bearer " + _login()},
    ).json()
    assert listed[0]["subscription_id"] == created["subscription_id"]
    assert listed[0]["secret"] is None


def test_an_organization_gets_one_connection():
    _install()
    _connect("Facility A", "orbit-a.example")
    again = client.post(
        "/api/orbit/connections",
        json={"facility_name": "Facility B", "instance_url": "orbit-b.example"},
        headers={"Authorization": "Bearer " + _login()},
    )
    assert again.status_code == 409
    assert again.json()["detail"] == "This organization already has an Orbit connection"
    listed = client.get(
        "/api/orbit/connections",
        headers={"Authorization": "Bearer " + _login()},
    ).json()
    assert len(listed) == 1
    other = _connect("Facility B", "orbit-b.example", "operator.south@sentinel.local")
    assert other["organization"]["id"] != listed[0]["organization"]["id"]


def test_two_organizations_keep_the_same_orbit_event_apart():
    _install()
    first = _connect("Facility A", "orbit-a.example", "operator.north@sentinel.local")
    second = _connect("Facility B", "orbit-b.example", "operator.south@sentinel.local")

    def post(connection: dict) -> dict:
        response = client.post(
            connection["callback_path"],
            json=EVENT,
            headers={"X-Sentinel-Webhook-Secret": connection["secret"]},
        )
        assert response.status_code == 200, response.text
        return response.json()

    accepted_a = post(first)
    accepted_b = post(second)
    assert accepted_a["status"] == "accepted"
    assert accepted_b["status"] == "accepted"
    assert accepted_a["organization_id"] == first["organization"]["id"]
    assert accepted_b["organization_id"] == second["organization"]["id"]
    assert accepted_a["organization_id"] != "org_attacker"
    assert accepted_a["ingestion_mission_id"] != accepted_b["ingestion_mission_id"]

    again = post(first)
    assert again["status"] == "duplicate"
    inspections_a = client.get(
        "/api/orbit/organizations/" + first["organization"]["id"] + "/inspections",
        headers={"Authorization": "Bearer " + _login("operator.north@sentinel.local")},
    ).json()
    inspections_b = client.get(
        "/api/orbit/organizations/" + second["organization"]["id"] + "/inspections",
        headers={"Authorization": "Bearer " + _login("operator.south@sentinel.local")},
    ).json()
    assert len(inspections_a) == 1
    assert len(inspections_b) == 1
    assert inspections_a[0]["provider_mission_id"] == "mission_123"
    assert inspections_a[0]["organization_id"] != inspections_b[0]["organization_id"]
    batch = inspection_batch(InspectionRecord.model_validate(inspections_a[0]))
    assert batch.missions[0].mission_id == inspections_a[0]["ingestion_mission_id"]


def test_webhook_id_without_the_secret_is_rejected():
    _install()
    created = _connect("Facility A", "orbit-a.example")
    missing = client.post(created["callback_path"], json=EVENT)
    wrong = client.post(created["callback_path"], json=EVENT, headers={"X-Sentinel-Webhook-Secret": "nope"})
    unknown = client.post("/api/webhooks/orbit/wh_missing", json=EVENT, headers={"X-Sentinel-Webhook-Secret": created["secret"]})
    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert unknown.status_code == 404
    assert client.get(
        "/api/orbit/organizations/" + created["organization"]["id"] + "/inspections",
        headers={"Authorization": "Bearer " + _login()},
    ).json() == []


def test_disabled_subscription_rejects_a_signed_event():
    _install()
    created = _connect("Facility A", "orbit-a.example")
    deleted = client.delete(
        "/api/orbit/subscriptions/" + created["subscription_id"],
        headers={"Authorization": "Bearer " + _login()},
    )
    assert deleted.status_code == 204
    response = client.post(
        created["callback_path"],
        json=EVENT,
        headers={"X-Sentinel-Webhook-Secret": created["secret"]},
    )
    assert response.status_code == 403


def test_mock_provider_posts_to_the_webhook_instead_of_writing_the_inspection():
    catalog, provider = _install()
    created = _connect("Facility A", "orbit-a.example")
    calls = []

    def poster(path, event, secret):
        calls.append((path, event, secret))
        response = client.post(path, json=event, headers={"X-Sentinel-Webhook-Secret": secret})
        return response.status_code, response.json()

    status_code, body = provider.publish(created["subscription_id"], EVENT, poster)
    assert status_code == 200
    assert body["status"] == "accepted"
    assert calls[0][0] == created["callback_path"]
    assert calls[0][2] == created["secret"]
    assert len(catalog.inspections(created["organization"]["id"])) == 1


def test_real_orbit_provider_does_not_pretend_to_connect():
    provider = RealOrbitProvider()
    try:
        provider.create_subscription("int_a1", ["ACTION_COMPLETED"], "https://sentinel.example/hook")
    except OrbitUnavailable as exc:
        assert "No Orbit instance" in str(exc)
    else:
        raise AssertionError("expected OrbitUnavailable")
