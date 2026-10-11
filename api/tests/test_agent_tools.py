from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.auth.deps import require_user
from app.auth.store import MemoryAuthStore, UserAccount, get_auth_store
from app.demo_org import DEMO_ORGANIZATION_ID
from app.main import app
from app.dtos.agent import (
    AssetDetailsRequest,
    AssetHistoryRequest,
    CompareTrendsRequest,
    CorrelationRequest,
    EvidenceRequest,
    RuleEvaluationsRequest,
    SearchAssetsRequest,
)
from app.services.agent import tools
from app.services.agent.registry import TOOLS

START = datetime(2026, 9, 1, tzinfo=timezone.utc)
ORG = DEMO_ORGANIZATION_ID
client = TestClient(app)
USER = UserAccount(
    id="usr_north",
    email="operator.north@sentinel.local",
    name="North Operator",
    organization_id=ORG,
    organization_name="North Yard",
    password_hash="x",
)


class Conn:
    def __init__(self, rows):
        self.rows = rows
        self.statements = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=()):
        self.statements.append((sql, params))
        if sql.lstrip().upper().startswith("SET"):
            return self
        return Result(self.rows(sql, params or ()))

    def fetchall(self):
        return []


class Result:
    def __init__(self, rows):
        self.rows = rows

    def fetchall(self):
        return self.rows


def _asset(asset_id="PUMP-1", asset_type="Pump", location_id="WP10"):
    return {
        "source": "kit",
        "asset_id": asset_id,
        "asset_name": asset_id,
        "asset_type": asset_type,
        "location_id": location_id,
        "criticality": "MEDIUM",
    }


def _reading(asset_id, stamp, value, unit="C", measurement="TEMPERATURE_C", reading_id=None):
    return {
        "source": "kit",
        "reading_id": reading_id or f"{asset_id}-{stamp.isoformat()}",
        "action_id": f"A-{asset_id}",
        "mission_id": "M1",
        "asset_id": asset_id,
        "location_id": "WP10",
        "timestamp": stamp,
        "measurement_type": measurement,
        "value": value,
        "unit": unit,
        "quality": "GOOD",
    }


def test_a_tool_argument_cannot_name_an_organization():
    app.dependency_overrides[require_user] = lambda: USER
    try:
        response = client.post("/internal/agent/tools/search-assets", json={"organization_id": "org_south"})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 422


def test_missing_credentials_are_rejected():
    app.dependency_overrides[get_auth_store] = MemoryAuthStore
    try:
        response = client.post("/internal/agent/tools/search-assets", json={})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401


def test_agent_routes_do_not_expose_a_mutation_method():
    paths = app.openapi()["paths"]
    for path, methods in paths.items():
        if path.startswith("/internal/agent"):
            assert set(methods) <= {"get", "post"}


def test_search_is_scoped_to_the_signed_in_organization():
    def rows(sql, params):
        assert params[0] == ORG
        if "FROM sentinel.assets" in sql:
            return [_asset()]
        if "GROUP BY asset_id, measurement_type" in sql:
            return [{"asset_id": "PUMP-1", "measurement_type": "TEMPERATURE_C", "unit": "C", "reading_count": 2, "first_timestamp": START, "last_timestamp": START}]
        return []

    conn = Conn(rows)
    result = tools.search_assets(conn, ORG, "req_test", SearchAssetsRequest(query="pump"))
    assert result.status == "success"
    assert result.data["assets"][0]["asset_id"] == "PUMP-1"
    assert result.data["assets"][0]["subsystem"] is None
    assert all(statement.lstrip().upper().startswith("SELECT") for statement, _ in conn.statements)


def test_an_asset_outside_the_organization_is_not_returned():
    result = tools.get_asset_details(Conn(lambda sql, params: []), ORG, "req_test", AssetDetailsRequest(asset_id="HX-999"))
    assert result.status == "insufficient_data"
    assert "not in this organization" in result.data["reason"]


def test_history_keeps_units_and_pages():
    stamps = [START + timedelta(hours=index) for index in range(3)]
    stored = [_reading("PUMP-1", stamp, 60 + index, reading_id=f"R{index}") for index, stamp in enumerate(stamps)]

    def rows(sql, params):
        if "FROM sentinel.assets" in sql:
            return [_asset()]
        if "FROM sentinel.readings" in sql:
            return stored[: params[-1]]
        return []

    first = tools.get_asset_history(
        Conn(rows),
        ORG,
        "req_test",
        AssetHistoryRequest(asset_id="PUMP-1", start_time=START, end_time=START + timedelta(days=1), limit=2),
    )
    assert first.status == "success"
    assert first.metadata.truncated is True
    assert first.metadata.next_cursor
    assert first.data["observations"][0]["unit"] == "C"


def test_evidence_from_another_organization_is_not_dereferenced():
    result = tools.get_evidence(
        Conn(lambda sql, params: []),
        ORG,
        "req_test",
        EvidenceRequest(evidence_type="asset", evidence_ids=["HX-SOUTH"]),
    )
    assert result.status == "insufficient_data"


def test_incompatible_units_are_not_compared():
    def rows(sql, params):
        if "FROM sentinel.assets" in sql:
            return [_asset("PUMP-1"), _asset("PUMP-2", location_id="WP14")]
        if "FROM sentinel.readings" in sql:
            return [
                _reading("PUMP-1", START, 60, unit="C"),
                _reading("PUMP-2", START, 140, unit="F"),
            ]
        return []

    result = tools.compare_asset_trends(
        Conn(rows),
        ORG,
        "req_test",
        CompareTrendsRequest(
            asset_ids=["PUMP-1", "PUMP-2"],
            measurement_type="TEMPERATURE_C",
            start_time=START,
            end_time=START + timedelta(days=1),
            aggregation_interval="hour",
        ),
    )
    assert result.status == "insufficient_data"
    assert result.data["comparable"] is False


def test_correlation_of_an_identical_series_is_reproducible():
    values = [float(index) for index in range(1, 9)]

    def rows(sql, params):
        if "FROM sentinel.assets" in sql:
            return [_asset("PUMP-1"), _asset("PUMP-2", location_id="WP14")]
        if "FROM sentinel.readings" in sql:
            return [
                *[_reading("PUMP-1", START + timedelta(hours=index), value, reading_id=f"A{index}") for index, value in enumerate(values)],
                *[_reading("PUMP-2", START + timedelta(hours=index), value, reading_id=f"B{index}") for index, value in enumerate(values)],
            ]
        return []

    body = CorrelationRequest(
        asset_ids=["PUMP-1", "PUMP-2"],
        measurement_type="TEMPERATURE_C",
        start_time=START,
        end_time=START + timedelta(days=1),
        alignment_interval="hour",
        method="pearson",
    )
    first = tools.compute_measurement_correlation(Conn(rows), ORG, "req_test", body)
    second = tools.compute_measurement_correlation(Conn(rows), ORG, "req_test", body)
    assert first.status == "success"
    assert first.data["coefficient"] == 1
    assert first.data["coefficient"] == second.data["coefficient"]
    assert first.data["causation"] is False


def test_a_constant_series_is_insufficient():
    def rows(sql, params):
        if "FROM sentinel.assets" in sql:
            return [_asset("PUMP-1"), _asset("PUMP-2", location_id="WP14")]
        if "FROM sentinel.readings" in sql:
            return [
                *[_reading("PUMP-1", START + timedelta(hours=index), 5, reading_id=f"A{index}") for index in range(8)],
                *[_reading("PUMP-2", START + timedelta(hours=index), float(index), reading_id=f"B{index}") for index in range(8)],
            ]
        return []

    result = tools.compute_measurement_correlation(
        Conn(rows),
        ORG,
        "req_test",
        CorrelationRequest(
            asset_ids=["PUMP-1", "PUMP-2"],
            measurement_type="TEMPERATURE_C",
            start_time=START,
            end_time=START + timedelta(days=1),
            alignment_interval="hour",
        ),
    )
    assert result.status == "insufficient_data"
    assert result.data["coefficient"] is None


def test_rule_evaluations_return_the_stored_firings():
    def rows(sql, params):
        if "FROM sentinel.rule_firings" in sql:
            return [{
                "decision_id": "dec_1",
                "rule_id": "sanity_limit",
                "matched": True,
                "observed_value": "180",
                "threshold": "150",
                "rank_delta": 0,
            }]
        if "FROM sentinel.rule_decisions" in sql:
            return [{
                "id": "dec_1",
                "source": "kit",
                "action_id": "A1",
                "rule_set_version": "evidence-v4",
                "decided_at": START,
                "queued": True,
                "verdict": "potential_anomaly",
                "rank": 50,
            }]
        return []

    result = tools.get_rule_evaluations(Conn(rows), ORG, "req_test", RuleEvaluationsRequest(inspection_id="A1"))
    assert result.status == "success"
    assert result.data["evaluations"][0]["firings"][0]["rule_id"] == "sanity_limit"
    assert result.data["evaluations"][0]["rule_set_version"] == "evidence-v4"


def test_the_manifest_requires_a_user_and_lists_every_tool():
    app.dependency_overrides[get_auth_store] = MemoryAuthStore
    hidden = client.get("/internal/agent/tools")
    app.dependency_overrides.clear()
    app.dependency_overrides[require_user] = lambda: USER
    try:
        response = client.get("/internal/agent/tools")
    finally:
        app.dependency_overrides.clear()
    assert hidden.status_code == 401
    assert response.status_code == 200
    names = {item["name"] for item in response.json()["tools"]}
    assert names == {name for name, *_ in TOOLS}
    assert all(item["read_only"] is True for item in response.json()["tools"])
