import csv
from pathlib import Path

from app.mappers.parse import flag, number, required_text, text, timestamp, whole_number
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


def map_kit(data_dir: Path) -> CanonicalBatch:
    """Map the six Knight Hacks CSV files into canonical records."""
    data_dir = Path(data_dir)
    return CanonicalBatch(
        locations=[_location(row) for row in _rows(data_dir / "locations.csv")],
        assets=[_asset(row) for row in _rows(data_dir / "assets.csv")],
        missions=[_mission(row) for row in _rows(data_dir / "missions.csv")],
        actions=[_action(row) for row in _rows(data_dir / "actions.csv")],
        readings=[_reading(row) for row in _rows(data_dir / "readings.csv")],
        anomaly_claims=[_claim(row) for row in _rows(data_dir / "anomalies.csv")],
    )


def _required_float(value: object, field_name: str) -> float:
    parsed = number(value)
    if parsed is None:
        raise ValueError(f"Missing {field_name}")
    return parsed


def _required_int(value: object, field_name: str) -> int:
    parsed = whole_number(value)
    if parsed is None:
        raise ValueError(f"Missing {field_name}")
    return parsed


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _location(row: dict[str, str]) -> Location:
    return Location(
        source=Source.kit,
        location_id=required_text(row.get("location_id"), "location_id"),
        location_name=required_text(row.get("location_name"), "location_name"),
        zone_type=required_text(row.get("zone_type"), "zone_type"),
        floor=_required_int(row.get("floor"), "floor"),
        x_coord=_required_float(row.get("x_coord"), "x_coord"),
        y_coord=_required_float(row.get("y_coord"), "y_coord"),
        environment=required_text(row.get("environment"), "environment"),
    )


def _asset(row: dict[str, str]) -> Asset:
    return Asset(
        source=Source.kit,
        asset_id=required_text(row.get("asset_id"), "asset_id"),
        asset_name=required_text(row.get("asset_name"), "asset_name"),
        asset_type=required_text(row.get("asset_type"), "asset_type"),
        location_id=required_text(row.get("location_id"), "location_id"),
        criticality=required_text(row.get("criticality"), "criticality"),
    )


def _mission(row: dict[str, str]) -> Mission:
    return Mission(
        source=Source.kit,
        mission_id=required_text(row.get("mission_id"), "mission_id"),
        mission_name=required_text(row.get("mission_name"), "mission_name"),
        scenario=text(row.get("scenario")),
        configuration_version=text(row.get("configuration_version")),
        start_time=timestamp(row.get("start_time")),
        end_time=timestamp(row.get("end_time")),
        duration_min=number(row.get("duration_min")),
        start_battery_pct=number(row.get("start_battery_pct")),
        end_battery_pct=number(row.get("end_battery_pct")),
        mission_status=required_text(row.get("mission_status"), "mission_status"),
        operator_mode=text(row.get("operator_mode")),
    )


def _action(row: dict[str, str]) -> Action:
    return Action(
        source=Source.kit,
        action_id=required_text(row.get("action_id"), "action_id"),
        mission_id=required_text(row.get("mission_id"), "mission_id"),
        sequence=whole_number(row.get("sequence")),
        timestamp=timestamp(row.get("timestamp")),
        location_id=text(row.get("location_id")),
        asset_id=text(row.get("asset_id")),
        action_type=required_text(row.get("action_type"), "action_type"),
        battery_pct=number(row.get("battery_pct")),
        status=required_text(row.get("status"), "status"),
        failure_type=text(row.get("failure_type")),
        duration_sec=number(row.get("duration_sec")),
        scenario=text(row.get("scenario")),
        configuration_version=text(row.get("configuration_version")),
    )


def _reading(row: dict[str, str]) -> Reading:
    return Reading(
        source=Source.kit,
        reading_id=required_text(row.get("reading_id"), "reading_id"),
        action_id=required_text(row.get("action_id"), "action_id"),
        mission_id=required_text(row.get("mission_id"), "mission_id"),
        asset_id=text(row.get("asset_id")),
        location_id=text(row.get("location_id")),
        timestamp=timestamp(row.get("timestamp")),
        measurement_type=required_text(row.get("measurement_type"), "measurement_type"),
        value=_required_float(row.get("value"), "value"),
        unit=required_text(row.get("unit"), "unit"),
        quality=required_text(row.get("quality"), "quality"),
    )


def _claim(row: dict[str, str]) -> AnomalyClaim:
    return AnomalyClaim(
        source=Source.kit,
        anomaly_id=required_text(row.get("anomaly_id"), "anomaly_id"),
        action_id=required_text(row.get("action_id"), "action_id"),
        mission_id=required_text(row.get("mission_id"), "mission_id"),
        location_id=text(row.get("location_id")),
        asset_id=text(row.get("asset_id")),
        timestamp=timestamp(row.get("timestamp")),
        anomaly_type=required_text(row.get("anomaly_type"), "anomaly_type"),
        severity=required_text(row.get("severity"), "severity"),
        operator_review_required=flag(row.get("operator_review_required")),
        description=required_text(row.get("description"), "description"),
    )
