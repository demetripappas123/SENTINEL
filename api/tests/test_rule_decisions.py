from app.demo_org import DEMO_ORGANIZATION_ID
from app.services.rules.evidence import score_batch
from app.dtos.canonical import Action, Asset, CanonicalBatch, Location, Reading, Source
from app.dtos.queue import QueueUpdate, RuleDecision, RuleFiring, Verdict
from app.services.queue import queue_updates
from app.services.store import persist
from tests.test_store import FakeConnection


def _batch() -> CanonicalBatch:
    return CanonicalBatch(
        actions=[
            Action(
                source=Source.kit,
                action_id="A1",
                mission_id="M1",
                action_type="THERMAL_INSPECTION",
                status="FAILED",
                failure_type="SENSOR_TIMEOUT",
                battery_pct=15,
                location_id="WP05",
                asset_id="AS1",
            )
        ],
        assets=[
            Asset(
                source=Source.kit,
                asset_id="AS1",
                asset_name="Panel",
                asset_type="electrical",
                location_id="WP05",
                criticality="CRITICAL",
            )
        ],
        locations=[
            Location(
                source=Source.kit,
                location_id="WP05",
                location_name="Pipe Gallery",
                zone_type="indoor",
                floor=1,
                x_coord=0,
                y_coord=0,
                environment="indoor",
            )
        ],
    )


def test_rank_is_the_sum_of_rule_points():
    item, decision = score_batch(_batch())[0]
    assert item is not None
    assert decision.queued is True
    assert decision.verdict is Verdict.inspection_failure
    assert decision.rule_set_version == "evidence-v2"
    assert item.rank == sum(firing.rank_delta for firing in decision.firings)
    points = {firing.rule_id: firing.rank_delta for firing in decision.firings}
    assert points["verdict_base"] == 100
    assert points["battery_below_40"] == 20
    assert points["battery_below_20"] == 10
    assert points["hotspot_location"] == 15
    assert points["critical_asset"] == 10
    assert item.rank == 155


def test_an_extreme_reading_is_judged_against_the_same_asset():
    cooler = _temperature_action("cooler-action", "cooler", [5] * 8 + [80])
    heater = _temperature_action("heater-action", "heater", [80] * 9)
    scored = {decision.action_id: item for item, decision in score_batch(CanonicalBatch(actions=[cooler[0], heater[0]], readings=cooler[1] + heater[1]))}
    assert scored["cooler-action"] is not None
    assert scored["cooler-action"].verdict is Verdict.equipment_finding
    assert scored["heater-action"] is None


def _temperature_action(action_id: str, asset_id: str, values: list[float]) -> tuple[Action, list]:
    action = Action(
        source=Source.kit,
        action_id=action_id,
        mission_id="M1",
        action_type="GAUGE_READING",
        status="SUCCESS",
        asset_id=asset_id,
    )
    readings = [
        Reading(
            source=Source.kit,
            reading_id=f"{action_id}-{index}",
            action_id=action_id,
            mission_id="M1",
            asset_id=asset_id,
            measurement_type="TEMPERATURE_C",
            value=value,
            unit="C",
            quality="GOOD",
        )
        for index, value in enumerate(values)
    ]
    return action, readings


def test_a_plain_success_stays_off_the_queue():
    batch = CanonicalBatch(
        actions=[
            Action(
                source=Source.kit,
                action_id="A2",
                mission_id="M1",
                action_type="GAUGE_READING",
                status="SUCCESS",
            )
        ]
    )
    item, decision = score_batch(batch)[0]
    assert item is None
    assert decision.queued is False
    assert decision.verdict is None
    assert decision.rank is None


def test_ingest_scoring_keeps_the_decision_with_the_queue_update():
    update = queue_updates(CanonicalBatch(), _batch())
    assert [item.id for item in update.upsert] == ["kit:A1"]
    assert [decision.action_id for decision in update.decisions] == ["A1"]
    assert update.decisions[0].rank == 155


def test_persist_appends_rule_decisions_and_firings():
    decision = RuleDecision(
        source="kit",
        action_id="A1",
        rule_set_version="evidence-v2",
        queued=True,
        verdict=Verdict.inspection_failure,
        rank=100,
        firings=[
            RuleFiring(
                rule_id="verdict_base",
                matched=True,
                observed_value="inspection_failure",
                threshold="100",
                rank_delta=100,
            )
        ],
    )
    conn = FakeConnection()
    persist(conn, CanonicalBatch(), QueueUpdate(decisions=[decision]), DEMO_ORGANIZATION_ID)
    tables = [statement.split("sentinel.")[1].split()[0] for statement, _ in conn.writes]
    assert tables == ["rule_decisions", "rule_firings"]
    _, firing_rows = conn.writes[1]
    assert firing_rows[0][1:] == ("verdict_base", True, "inspection_failure", "100", 100)
