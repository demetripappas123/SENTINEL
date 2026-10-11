"""SQL for one organization.

load_history gathers the window the rules need. persist upserts the canonical
rows and the current queue, then appends one rule decision per scored action.
Decisions are not updated when the same action is ingested again.
"""
import secrets
from datetime import datetime, timedelta, timezone

from psycopg.types.json import Json

from app.dtos.canonical import (
    Action,
    AnomalyClaim,
    Asset,
    CanonicalBatch,
    Location,
    Mission,
    Reading,
)
from app.dtos.queue import QueueItem, QueueUpdate, RuleDecision, Verdict

HISTORY_DAYS = 30


def load_history(conn, incoming: CanonicalBatch, organization_id: str) -> CanonicalBatch:
    """Prior canonical rows the new batch is ranked against.

    Actions are limited to the assets in the batch and the 30 days before
    its earliest timestamp. Good readings of those same assets are included
    so a new value is compared with that asset's own baseline.
    """
    start = _window_start(incoming)
    asset_ids = sorted(
        {action.asset_id for action in incoming.actions if action.asset_id}
        | {reading.asset_id for reading in incoming.readings if reading.asset_id}
    )
    actions = _actions_for_assets(conn, organization_id, asset_ids, start)
    readings = _readings_for_actions(conn, organization_id, actions)
    measurements = sorted(
        {reading.measurement_type for reading in incoming.readings}
        | {reading.measurement_type for reading in readings}
    )
    peers = _good_readings(conn, organization_id, asset_ids, measurements, start)
    extra_actions = _actions_for_keys(
        conn,
        organization_id,
        {(reading.source.value, reading.action_id) for reading in peers}
        - {(action.source.value, action.action_id) for action in actions},
    )
    actions = _dedupe(actions + extra_actions, lambda action: (action.source, action.action_id))
    readings = _dedupe(
        readings + peers + _readings_for_actions(conn, organization_id, extra_actions),
        lambda reading: (reading.source, reading.reading_id),
    )
    claims = _claims_for_actions(conn, organization_id, actions)
    return CanonicalBatch(
        missions=_missions_for_actions(conn, organization_id, actions),
        actions=actions,
        readings=readings,
        anomaly_claims=claims,
        assets=_assets(conn, organization_id, actions, incoming),
        locations=_locations(conn, organization_id, actions, incoming),
    )


def persist(conn, incoming: CanonicalBatch, update: QueueUpdate, organization_id: str) -> None:
    """Upsert the new canonical rows and the queue rows they change."""
    _write(conn, "locations", _LOCATION, [_location_row(organization_id, row) for row in incoming.locations])
    _write(conn, "assets", _ASSET, [_asset_row(organization_id, row) for row in incoming.assets])
    _write(conn, "missions", _MISSION, [_mission_row(organization_id, row) for row in incoming.missions])
    _write(conn, "actions", _ACTION, [_action_row(organization_id, row) for row in incoming.actions])
    _write(conn, "readings", _READING, [_reading_row(organization_id, row) for row in incoming.readings])
    _write(conn, "anomaly_claims", _CLAIM, [_claim_row(organization_id, row) for row in incoming.anomaly_claims])
    for item_id in update.remove_ids:
        source, action_id = item_id.split(":", 1)
        conn.execute(
            "DELETE FROM sentinel.queue_items WHERE organization_id = %s AND source = %s AND action_id = %s",
            (organization_id, source, action_id),
        )
    _write(conn, "queue_items", _QUEUE, [_queue_row(organization_id, row) for row in update.upsert])
    _write_decisions(conn, organization_id, update.decisions)


def load_queue(conn, organization_id: str) -> list[QueueItem]:
    rows = conn.execute(
        """
        SELECT source, action_id, verdict, cause, explanation, mission_id,
               asset_id, location_id, rank, evidence
        FROM sentinel.queue_items
        WHERE organization_id = %s
        ORDER BY rank DESC, mission_id, action_id
        """,
        (organization_id,),
    ).fetchall()
    return [
        QueueItem(
            id=f"{row['source']}:{row['action_id']}",
            verdict=Verdict(row["verdict"]),
            cause=row["cause"],
            explanation=row["explanation"],
            mission_id=row["mission_id"],
            action_id=row["action_id"],
            asset_id=row["asset_id"],
            location_id=row["location_id"],
            rank=row["rank"],
            evidence=row["evidence"] or {},
        )
        for row in rows
    ]


# History queries. Same organization, same assets, and the 30 days before the batch.
def _window_start(incoming: CanonicalBatch) -> datetime:
    stamps = [action.timestamp for action in incoming.actions if action.timestamp is not None]
    anchor = min(stamps) if stamps else datetime.now(timezone.utc)
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)
    return anchor - timedelta(days=HISTORY_DAYS)


def _actions_for_assets(conn, organization_id: str, asset_ids: list[str], start: datetime) -> list[Action]:
    if not asset_ids:
        return []
    rows = conn.execute(
        """
        SELECT * FROM sentinel.actions
        WHERE organization_id = %s
          AND asset_id = ANY(%s)
          AND (timestamp IS NULL OR timestamp >= %s)
        """,
        (organization_id, asset_ids, start),
    ).fetchall()
    return [Action.model_validate(row) for row in rows]


def _actions_for_keys(conn, organization_id: str, keys: set[tuple[str, str]]) -> list[Action]:
    found: list[Action] = []
    for source in {source for source, _ in keys}:
        action_ids = [action_id for item_source, action_id in keys if item_source == source]
        rows = conn.execute(
            "SELECT * FROM sentinel.actions WHERE organization_id = %s AND source = %s AND action_id = ANY(%s)",
            (organization_id, source, action_ids),
        ).fetchall()
        found.extend(Action.model_validate(row) for row in rows)
    return found


def _readings_for_actions(conn, organization_id: str, actions: list[Action]) -> list[Reading]:
    return _for_actions(conn, organization_id, "readings", Reading, actions)


def _claims_for_actions(conn, organization_id: str, actions: list[Action]) -> list[AnomalyClaim]:
    return _for_actions(conn, organization_id, "anomaly_claims", AnomalyClaim, actions)


def _for_actions(conn, organization_id: str, table: str, model, actions: list[Action]):
    found = []
    keys = {(action.source.value, action.action_id) for action in actions}
    for source in {source for source, _ in keys}:
        action_ids = [action_id for item_source, action_id in keys if item_source == source]
        rows = conn.execute(
            f"SELECT * FROM sentinel.{table} WHERE organization_id = %s AND source = %s AND action_id = ANY(%s)",
            (organization_id, source, action_ids),
        ).fetchall()
        found.extend(model.model_validate(row) for row in rows)
    return found


def _good_readings(
    conn,
    organization_id: str,
    asset_ids: list[str],
    measurements: list[str],
    start: datetime,
) -> list[Reading]:
    if not asset_ids or not measurements:
        return []
    rows = conn.execute(
        """
        SELECT * FROM sentinel.readings
        WHERE organization_id = %s
          AND asset_id = ANY(%s)
          AND measurement_type = ANY(%s)
          AND quality = 'GOOD'
          AND (timestamp IS NULL OR timestamp >= %s)
        """,
        (organization_id, asset_ids, measurements, start),
    ).fetchall()
    return [Reading.model_validate(row) for row in rows]


def _missions_for_actions(conn, organization_id: str, actions: list[Action]) -> list[Mission]:
    found: list[Mission] = []
    keys = {(action.source.value, action.mission_id) for action in actions}
    for source in {source for source, _ in keys}:
        mission_ids = [mission_id for item_source, mission_id in keys if item_source == source]
        rows = conn.execute(
            "SELECT * FROM sentinel.missions WHERE organization_id = %s AND source = %s AND mission_id = ANY(%s)",
            (organization_id, source, mission_ids),
        ).fetchall()
        found.extend(Mission.model_validate(row) for row in rows)
    return found


def _assets(conn, organization_id: str, actions: list[Action], incoming: CanonicalBatch) -> list[Asset]:
    ids = {action.asset_id for action in actions if action.asset_id}
    ids.update(action.asset_id for action in incoming.actions if action.asset_id)
    if not ids:
        return []
    rows = conn.execute(
        "SELECT * FROM sentinel.assets WHERE organization_id = %s AND asset_id = ANY(%s)",
        (organization_id, sorted(ids)),
    ).fetchall()
    return [Asset.model_validate(row) for row in rows]


def _locations(conn, organization_id: str, actions: list[Action], incoming: CanonicalBatch) -> list[Location]:
    ids = {action.location_id for action in actions if action.location_id}
    ids.update(action.location_id for action in incoming.actions if action.location_id)
    if not ids:
        return []
    rows = conn.execute(
        "SELECT * FROM sentinel.locations WHERE organization_id = %s AND location_id = ANY(%s)",
        (organization_id, sorted(ids)),
    ).fetchall()
    return [Location.model_validate(row) for row in rows]


def _dedupe(rows: list, key) -> list:
    return list({key(row): row for row in rows}.values())


# Writes. Canonical rows and the current queue are upserted. Rule decisions are appended.
def _write(conn, table: str, statement: str, rows: list[tuple]) -> None:
    if rows:
        conn.cursor().executemany(statement, rows)


def _write_decisions(conn, organization_id: str, decisions: list[RuleDecision]) -> None:
    decision_rows: list[tuple] = []
    firing_rows: list[tuple] = []
    for decision in decisions:
        decision_id = "dec_" + secrets.token_hex(8)
        decision_rows.append(
            (
                decision_id,
                organization_id,
                decision.source,
                decision.action_id,
                decision.rule_set_version,
                decision.queued,
                None if decision.verdict is None else decision.verdict.value,
                decision.rank,
            )
        )
        firing_rows.extend(
            (
                decision_id,
                firing.rule_id,
                firing.matched,
                firing.observed_value,
                firing.threshold,
                firing.rank_delta,
            )
            for firing in decision.firings
        )
    _write(conn, "rule_decisions", _DECISION, decision_rows)
    _write(conn, "rule_firings", _FIRING, firing_rows)


def _location_row(organization_id: str, row: Location) -> tuple:
    return (
        organization_id, row.source.value, row.location_id, row.location_name, row.zone_type,
        row.floor, row.x_coord, row.y_coord, row.environment,
    )


def _asset_row(organization_id: str, row: Asset) -> tuple:
    return (
        organization_id, row.source.value, row.asset_id, row.asset_name, row.asset_type,
        row.location_id, row.criticality,
    )


def _mission_row(organization_id: str, row: Mission) -> tuple:
    return (
        organization_id, row.source.value, row.mission_id, row.mission_name,
        row.configuration_version, row.start_time, row.end_time, row.duration_min,
        row.start_battery_pct, row.end_battery_pct, row.mission_status, row.operator_mode,
    )


def _action_row(organization_id: str, row: Action) -> tuple:
    return (
        organization_id, row.source.value, row.action_id, row.mission_id, row.sequence, row.timestamp,
        row.location_id, row.asset_id, row.action_type, row.battery_pct, row.status, row.failure_type,
        row.duration_sec, row.configuration_version,
    )


def _reading_row(organization_id: str, row: Reading) -> tuple:
    return (
        organization_id, row.source.value, row.reading_id, row.action_id, row.mission_id, row.asset_id,
        row.location_id, row.timestamp, row.measurement_type, row.value, row.unit, row.quality,
    )


def _claim_row(organization_id: str, row: AnomalyClaim) -> tuple:
    return (
        organization_id, row.source.value, row.anomaly_id, row.action_id, row.mission_id, row.location_id,
        row.asset_id, row.timestamp, row.anomaly_type, row.severity, row.operator_review_required,
        row.description,
    )


def _queue_row(organization_id: str, row: QueueItem) -> tuple:
    source, action_id = row.id.split(":", 1)
    return (
        organization_id, source, action_id, row.verdict.value, row.cause, row.explanation, row.mission_id,
        row.asset_id, row.location_id, row.rank, Json(row.evidence),
    )


_LOCATION = """
INSERT INTO sentinel.locations (
    organization_id, source, location_id, location_name, zone_type, floor, x_coord, y_coord, environment
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (source, location_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    location_name = EXCLUDED.location_name,
    zone_type = EXCLUDED.zone_type,
    floor = EXCLUDED.floor,
    x_coord = EXCLUDED.x_coord,
    y_coord = EXCLUDED.y_coord,
    environment = EXCLUDED.environment
"""

_ASSET = """
INSERT INTO sentinel.assets (
    organization_id, source, asset_id, asset_name, asset_type, location_id, criticality
) VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (source, asset_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    asset_name = EXCLUDED.asset_name,
    asset_type = EXCLUDED.asset_type,
    location_id = EXCLUDED.location_id,
    criticality = EXCLUDED.criticality
"""

_MISSION = """
INSERT INTO sentinel.missions (
    organization_id, source, mission_id, mission_name, configuration_version, start_time, end_time,
    duration_min, start_battery_pct, end_battery_pct, mission_status, operator_mode
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (source, mission_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    mission_name = EXCLUDED.mission_name,
    configuration_version = EXCLUDED.configuration_version,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    duration_min = EXCLUDED.duration_min,
    start_battery_pct = EXCLUDED.start_battery_pct,
    end_battery_pct = EXCLUDED.end_battery_pct,
    mission_status = EXCLUDED.mission_status,
    operator_mode = EXCLUDED.operator_mode
"""

_ACTION = """
INSERT INTO sentinel.actions (
    organization_id, source, action_id, mission_id, sequence, timestamp, location_id, asset_id, action_type,
    battery_pct, status, failure_type, duration_sec, configuration_version
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (source, action_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    mission_id = EXCLUDED.mission_id,
    sequence = EXCLUDED.sequence,
    timestamp = EXCLUDED.timestamp,
    location_id = EXCLUDED.location_id,
    asset_id = EXCLUDED.asset_id,
    action_type = EXCLUDED.action_type,
    battery_pct = EXCLUDED.battery_pct,
    status = EXCLUDED.status,
    failure_type = EXCLUDED.failure_type,
    duration_sec = EXCLUDED.duration_sec,
    configuration_version = EXCLUDED.configuration_version
"""

_READING = """
INSERT INTO sentinel.readings (
    organization_id, source, reading_id, action_id, mission_id, asset_id, location_id, timestamp,
    measurement_type, value, unit, quality
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (source, reading_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    action_id = EXCLUDED.action_id,
    mission_id = EXCLUDED.mission_id,
    asset_id = EXCLUDED.asset_id,
    location_id = EXCLUDED.location_id,
    timestamp = EXCLUDED.timestamp,
    measurement_type = EXCLUDED.measurement_type,
    value = EXCLUDED.value,
    unit = EXCLUDED.unit,
    quality = EXCLUDED.quality
"""

_CLAIM = """
INSERT INTO sentinel.anomaly_claims (
    organization_id, source, anomaly_id, action_id, mission_id, location_id, asset_id, timestamp,
    anomaly_type, severity, operator_review_required, description
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (source, anomaly_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    action_id = EXCLUDED.action_id,
    mission_id = EXCLUDED.mission_id,
    location_id = EXCLUDED.location_id,
    asset_id = EXCLUDED.asset_id,
    timestamp = EXCLUDED.timestamp,
    anomaly_type = EXCLUDED.anomaly_type,
    severity = EXCLUDED.severity,
    operator_review_required = EXCLUDED.operator_review_required,
    description = EXCLUDED.description
"""

_QUEUE = """
INSERT INTO sentinel.queue_items (
    organization_id, source, action_id, verdict, cause, explanation, mission_id, asset_id, location_id, rank, evidence
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (source, action_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    verdict = EXCLUDED.verdict,
    cause = EXCLUDED.cause,
    explanation = EXCLUDED.explanation,
    mission_id = EXCLUDED.mission_id,
    asset_id = EXCLUDED.asset_id,
    location_id = EXCLUDED.location_id,
    rank = EXCLUDED.rank,
    evidence = EXCLUDED.evidence,
    updated_at = now()
"""

_DECISION = """
INSERT INTO sentinel.rule_decisions (
    id, organization_id, source, action_id, rule_set_version, queued, verdict, rank
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""

_FIRING = """
INSERT INTO sentinel.rule_firings (
    decision_id, rule_id, matched, observed_value, threshold, rank_delta
) VALUES (%s, %s, %s, %s, %s, %s)
"""
