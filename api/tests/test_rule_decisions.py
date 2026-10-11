from app.demo_org import DEMO_ORGANIZATION_ID
from app.services.rules.evidence import score_batch
from app.dtos.canonical import Action, AnomalyClaim, Asset, CanonicalBatch, Location, Reading, Source
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
    assert decision.rule_set_version == "evidence-v4"
    assert item.rank == sum(firing.rank_delta for firing in decision.firings)
    points = {firing.rule_id: firing.rank_delta for firing in decision.firings}
    assert points["verdict_base"] == 100
    assert points["battery_below_40"] == 20
    assert points["battery_below_20"] == 10
    assert points["critical_asset"] == 10
    assert "hotspot_location" not in points
    assert item.rank == 140


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
    assert update.decisions[0].rank == 140


def test_persist_appends_rule_decisions_and_firings():
    decision = RuleDecision(
        source="kit",
        action_id="A1",
        rule_set_version="evidence-v4",
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


def test_each_asset_type_has_a_common_sense_ceiling():
    from app.services.rules.sanity import sanity_limit

    kinds = [
        "Heat Exchanger",
        "Electrical Panel",
        "Pump",
        "Motor",
        "Valve",
        "Pressure Gauge",
        "Compressor",
    ]
    for kind in kinds:
        assert sanity_limit(kind, "TEMPERATURE_C") is not None
        assert sanity_limit(kind, "PRESSURE_PSI") is not None
        assert sanity_limit(kind, "SOUND_DB") is not None
        assert sanity_limit(kind, "VISUAL_SCORE") == 100
        assert sanity_limit(kind, "LOCALIZATION_CONFIDENCE_PCT") == 100
    assert sanity_limit("heat_exchanger", "TEMPERATURE_C") == sanity_limit("Heat Exchanger", "TEMPERATURE_C")
    assert sanity_limit("Electrical Panel", "TEMPERATURE_C") < sanity_limit("Heat Exchanger", "TEMPERATURE_C")
    assert sanity_limit("Motor", "PRESSURE_PSI") < sanity_limit("Pump", "PRESSURE_PSI")
    assert sanity_limit("Compressor", "SOUND_DB") > sanity_limit("Heat Exchanger", "SOUND_DB")


def test_a_high_good_reading_without_enough_peers_is_a_potential_anomaly():
    item, decision = score_batch(_heat("HX-1", "Heat Exchanger", 180, peers=2))[0]
    assert item is not None
    assert item.verdict is Verdict.potential_anomaly
    assert item.rank == 50
    assert "above 150" in item.explanation
    assert "2 other good" in item.explanation
    assert "potential anomaly" in item.explanation
    assert item.evidence["sanity_limit"] == 150
    points = {firing.rule_id: firing for firing in decision.firings}
    assert points["sanity_limit"].matched is True
    assert points["sanity_limit"].threshold == "150"
    assert points["extreme_reading"].matched is False


def test_a_high_good_reading_with_a_label_is_not_an_unbacked_claim():
    batch = _heat("HX-1", "Heat Exchanger", 180, peers=1)
    batch.anomaly_claims.append(
        AnomalyClaim(
            source=Source.kit,
            anomaly_id="AN1",
            action_id="hot",
            mission_id="M1",
            anomaly_type="ABNORMAL_TEMPERATURE",
            severity="HIGH",
            operator_review_required=True,
            description="Synthetic abnormal temperature detected.",
        )
    )
    item, _ = score_batch(batch)[0]
    assert item is not None
    assert item.verdict is Verdict.potential_anomaly


def test_a_normal_good_reading_without_peers_stays_off_the_queue():
    item, decision = score_batch(_heat("HX-1", "Heat Exchanger", 70, peers=2))[0]
    assert item is None
    assert decision.queued is False
    assert decision.verdict is None


def test_a_normal_labeled_reading_without_peers_stays_an_unbacked_claim():
    batch = _heat("HX-1", "Heat Exchanger", 70, peers=1)
    batch.anomaly_claims.append(
        AnomalyClaim(
            source=Source.kit,
            anomaly_id="AN1",
            action_id="hot",
            mission_id="M1",
            anomaly_type="ABNORMAL_TEMPERATURE",
            severity="LOW",
            operator_review_required=False,
            description="Synthetic abnormal temperature detected.",
        )
    )
    item, _ = score_batch(batch)[0]
    assert item is not None
    assert item.verdict is Verdict.unsupported_claim


def test_the_asset_fence_still_outranks_the_ceiling():
    item, _ = score_batch(_heat("HX-1", "Heat Exchanger", 180, peers=8, peer_value=40))[0]
    assert item is not None
    assert item.verdict is Verdict.equipment_finding


def test_a_high_reading_inside_a_hot_asset_history_stays_a_potential_anomaly():
    item, _ = score_batch(_heat("HX-1", "Heat Exchanger", 170, peers=8, peer_value=170))[0]
    assert item is not None
    assert item.verdict is Verdict.potential_anomaly
    assert "inside this asset's other good readings" in item.explanation


def test_an_electrical_panel_uses_its_own_temperature_ceiling():
    item, _ = score_batch(_heat("PANEL-1", "Electrical Panel", 95, peers=1))[0]
    assert item is not None
    assert item.verdict is Verdict.potential_anomaly
    assert item.evidence["sanity_limit"] == 90
    quiet, _ = score_batch(_heat("PANEL-1", "Electrical Panel", 74, peers=1))[0]
    assert quiet is None


def test_a_score_above_one_hundred_is_a_potential_anomaly():
    reading = _reading("hot", "HX-1", "VISUAL_SCORE", 140, "score")
    item, _ = score_batch(_batch_for("HX-1", "Heat Exchanger", reading, []))[0]
    assert item is not None
    assert item.verdict is Verdict.potential_anomaly
    on_scale = _reading("hot", "HX-1", "VISUAL_SCORE", 100, "score")
    quiet, _ = score_batch(_batch_for("HX-1", "Heat Exchanger", on_scale, []))[0]
    assert quiet is None


def _heat(asset_id: str, asset_type: str, value: float, peers: int, peer_value: float = 60) -> CanonicalBatch:
    current = _reading("hot", asset_id, "TEMPERATURE_C", value, "C")
    history = [
        _reading(f"peer-{index}", asset_id, "TEMPERATURE_C", peer_value, "C")
        for index in range(peers)
    ]
    return _batch_for(asset_id, asset_type, current, history)


def _batch_for(asset_id: str, asset_type: str, current: Reading, history: list[Reading]) -> CanonicalBatch:
    actions = [
        Action(
            source=Source.kit,
            action_id=current.action_id,
            mission_id="M1",
            action_type="THERMAL_INSPECTION",
            status="SUCCESS",
            asset_id=asset_id,
        )
    ]
    actions.extend(
        Action(
            source=Source.kit,
            action_id=reading.action_id,
            mission_id="M1",
            action_type="THERMAL_INSPECTION",
            status="SUCCESS",
            asset_id=asset_id,
        )
        for reading in history
    )
    return CanonicalBatch(
        actions=actions,
        readings=[current, *history],
        assets=[
            Asset(
                source=Source.kit,
                asset_id=asset_id,
                asset_name=asset_id,
                asset_type=asset_type,
                location_id="WP03",
                criticality="MEDIUM",
            )
        ],
    )


def _reading(action_id: str, asset_id: str, measurement: str, value: float, unit: str) -> Reading:
    return Reading(
        source=Source.kit,
        reading_id=f"{action_id}-reading",
        action_id=action_id,
        mission_id="M1",
        asset_id=asset_id,
        measurement_type=measurement,
        value=value,
        unit=unit,
        quality="GOOD",
    )
