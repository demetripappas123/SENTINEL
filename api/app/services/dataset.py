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


def get_dataset(source: Source) -> InspectionDataset:
    """Every canonical record for one source, in the frontend's shape."""
    with connect() as conn:
        batch = CanonicalBatch(
            **{
                field: [
                    model.model_validate(row)
                    for row in conn.execute(
                        f"SELECT * FROM sentinel.{table} WHERE source = %s",
                        (source.value,),
                    ).fetchall()
                ]
                for field, (table, model) in _TABLES.items()
            }
        )
    return to_dataset(batch)


def to_dataset(batch: CanonicalBatch) -> InspectionDataset:
    """Convert canonical records to the frontend dataset.

    Records are sorted by ID so screens are stable whatever order the
    database returns rows in. Replay events are not stored yet.
    """
    return InspectionDataset(
        missions=[
            MissionOut(
                **mission.model_dump(include=set(MissionOut.model_fields) - {"start_time", "end_time"}),
                start_time=format_timestamp(mission.start_time),
                end_time=format_timestamp(mission.end_time),
            )
            for mission in sorted(batch.missions, key=lambda row: row.mission_id)
        ],
        actions=[
            ActionOut(
                **action.model_dump(include=set(ActionOut.model_fields) - {"timestamp", "failure_type"}),
                timestamp=format_timestamp(action.timestamp),
                failure_type=action.failure_type or "",
            )
            for action in sorted(batch.actions, key=lambda row: row.action_id)
        ],
        findings=[
            FindingOut(
                **claim.model_dump(include=set(FindingOut.model_fields) - {"timestamp"}),
                timestamp=format_timestamp(claim.timestamp),
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
    )


def format_timestamp(value: datetime | None) -> str:
    """UTC as YYYY-MM-DDTHH:MM:SS, the format the frontend slices and compares.

    Kit timestamps carry no offset and are treated as UTC.
    """
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
