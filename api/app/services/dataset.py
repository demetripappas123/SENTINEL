from datetime import datetime, timezone

from app.db import connect
from app.schemas.canonical import (
    Action,
    AnomalyClaim,
    Asset,
    CanonicalBatch,
    Location,
    Mission,
    Reading,
    Source,
)
from app.schemas.dataset import (
    ActionOut,
    AssetOut,
    FindingOut,
    InspectionDataset,
    MissionOut,
    ReadingOut,
    ReplayEventOut,
    WaypointOut,
)

_TABLES = {
    "missions": ("missions", Mission),
    "actions": ("actions", Action),
    "readings": ("readings", Reading),
    "anomaly_claims": ("anomaly_claims", AnomalyClaim),
    "assets": ("assets", Asset),
    "locations": ("locations", Location),
}


def _tables(detail: bool) -> dict[str, tuple[str, type]]:
    if detail:
        return _TABLES
    return {key: value for key, value in _TABLES.items() if key != "readings"}


def _load(conn, organization_id: str, source: Source | None, detail: bool) -> dict:
    loaded: dict = {}
    for field, (table, model) in _tables(detail).items():
        statement = f"SELECT * FROM sentinel.{table} WHERE organization_id = %s"
        params: list[str] = [organization_id]
        if source is not None:
            statement += " AND source = %s"
            params.append(source.value)
        loaded[field] = [model.model_validate(row) for row in conn.execute(statement, tuple(params)).fetchall()]
    if not detail:
        loaded["readings"] = []
    return loaded


def get_dataset(source: Source, organization_id: str, *, detail: bool = True) -> InspectionDataset:
    """Canonical records for one organization and source, in the frontend's shape.

    The shell omits readings and derived replay. Those are the heavy parts
    and are only needed after the counts and lists are on screen.
    """
    with connect() as conn:
        loaded = _load(conn, organization_id, source, detail)
    return to_dataset(CanonicalBatch(**loaded), include_events=detail)


def get_live_dataset(organization_id: str, *, detail: bool = True) -> InspectionDataset:
    """Every source for one organization. Same shell/detail split as get_dataset."""
    with connect() as conn:
        loaded = _load(conn, organization_id, None, detail)
    return to_dataset(CanonicalBatch(**loaded), include_events=detail)


def to_dataset(batch: CanonicalBatch, *, include_events: bool = True) -> InspectionDataset:
    """Convert canonical records to the frontend dataset.

    Records are sorted by ID so screens are stable whatever order the
    database returns rows in. Replay is derived from mission and action
    times; it is not a separate stored stream.
    """
    return InspectionDataset(
        missions=[
            MissionOut(
                **mission.model_dump(include=set(MissionOut.model_fields) - {"start_time", "end_time"}),
                start_time=_timestamp(mission.start_time),
                end_time=_timestamp(mission.end_time),
            )
            for mission in sorted(batch.missions, key=lambda row: row.mission_id)
        ],
        actions=[
            ActionOut(
                **action.model_dump(include=set(ActionOut.model_fields) - {"timestamp", "failure_type"}),
                timestamp=_timestamp(action.timestamp),
                failure_type=action.failure_type or "",
            )
            for action in sorted(batch.actions, key=lambda row: row.action_id)
        ],
        findings=[
            FindingOut(
                **claim.model_dump(include=set(FindingOut.model_fields) - {"timestamp"}),
                timestamp=_timestamp(claim.timestamp),
            )
            for claim in sorted(batch.anomaly_claims, key=lambda row: row.anomaly_id)
        ],
        assets=[
            AssetOut(**asset.model_dump(include=set(AssetOut.model_fields)))
            for asset in sorted(batch.assets, key=lambda row: row.asset_id)
        ],
        locations=[
            WaypointOut(**location.model_dump(include=set(WaypointOut.model_fields)))
            for location in sorted(batch.locations, key=lambda row: row.location_id)
        ],
        readings=[
            ReadingOut(**reading.model_dump(include=set(ReadingOut.model_fields)))
            for reading in sorted(batch.readings, key=lambda row: row.reading_id)
        ],
        events=replay_events(batch),
    )


_EVENT_ORDER = {
    "MISSION_STARTED": 0,
    "ACTION_STARTED": 1,
    "ACTION_FAILED": 2,
    "ACTION_COMPLETED": 2,
    "MISSION_COMPLETED": 3,
}


def replay_events(batch: CanonicalBatch) -> list[ReplayEventOut]:
    """Chronological mission and action status from the stored rows.

    A mission with a start time opens the timeline. Each action with a
    timestamp contributes a start and, once it succeeded or failed, an
    outcome. A mission with an end time closes the timeline. Rows that
    have not received a time are left out.
    """
    grouped: dict[str, list[Action]] = {}
    for action in batch.actions:
        grouped.setdefault(action.mission_id, []).append(action)
    known = {mission.mission_id for mission in batch.missions}
    events: list[ReplayEventOut] = []
    for mission in batch.missions:
        events.extend(_mission_replay(mission, grouped.get(mission.mission_id, [])))
    for mission_id, actions in grouped.items():
        if mission_id not in known:
            events.extend(_action_replay(actions))
    events.sort(
        key=lambda event: (
            event.timestamp,
            _EVENT_ORDER.get(event.event_type, 9),
            event.mission_id,
            event.event_id,
        )
    )
    return events


def _mission_replay(mission: Mission, actions: list[Action]) -> list[ReplayEventOut]:
    events: list[ReplayEventOut] = []
    started = format_timestamp(mission.start_time)
    if started:
        events.append(
            ReplayEventOut(
                event_id=f"{mission.mission_id}:started",
                mission_id=mission.mission_id,
                timestamp=started,
                event_type="MISSION_STARTED",
                details={
                    "scenario": mission.scenario,
                    "configuration_version": mission.configuration_version,
                    "battery_pct": mission.start_battery_pct,
                },
            )
        )
    events.extend(_action_replay(actions))
    ended = format_timestamp(mission.end_time)
    if ended:
        events.append(
            ReplayEventOut(
                event_id=f"{mission.mission_id}:completed",
                mission_id=mission.mission_id,
                timestamp=ended,
                event_type="MISSION_COMPLETED",
                details={
                    "status": mission.mission_status,
                    "end_battery_pct": mission.end_battery_pct,
                },
            )
        )
    return events


def _action_replay(actions: list[Action]) -> list[ReplayEventOut]:
    events: list[ReplayEventOut] = []
    for action in sorted(actions, key=lambda row: (row.sequence or 0, row.action_id)):
        stamp = format_timestamp(action.timestamp)
        if not stamp:
            continue
        events.append(
            ReplayEventOut(
                event_id=f"{action.action_id}:started",
                mission_id=action.mission_id,
                timestamp=stamp,
                event_type="ACTION_STARTED",
                details={
                    "action_id": action.action_id,
                    "location_id": action.location_id,
                    "asset_id": action.asset_id,
                    "action_type": action.action_type,
                    "battery_pct": action.battery_pct,
                },
            )
        )
        if action.status == "FAILED":
            outcome = "ACTION_FAILED"
        elif action.status == "SUCCESS":
            outcome = "ACTION_COMPLETED"
        else:
            continue
        events.append(
            ReplayEventOut(
                event_id=f"{action.action_id}:outcome",
                mission_id=action.mission_id,
                timestamp=stamp,
                event_type=outcome,
                details={
                    "action_id": action.action_id,
                    "status": action.status,
                    "failure_type": action.failure_type or "",
                },
            )
        )
    return events


def _timestamp(value: datetime | None) -> str | None:
    """A missing time stays null so the screen can show it as not received."""
    return format_timestamp(value) if value is not None else None


def format_timestamp(value: datetime | None) -> str:
    """UTC as YYYY-MM-DDTHH:MM:SS, the format the frontend slices and compares.

    Kit timestamps carry no offset and are treated as UTC.
    """
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
