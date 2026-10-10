from app.mappers.parse import first, number, text, timestamp
from app.schemas.canonical import Action, AnomalyClaim, CanonicalBatch, Mission, Source


def map_spot(payload: dict) -> CanonicalBatch:
    """Map a Spot robot-state snapshot into canonical records.

    Accepts either a small fixture or RobotState JSON from the Spot SDK:
    battery percentage, an optional mission, a waypoint, and system faults.
    A snapshot with no mission id is stored under spot-state-{nickname}.
    Faults become anomaly claims. They are not treated as inspection readings.
    """
    nickname = text(first(payload, "nickname", "robot_nickname")) or _robot_id(payload) or "spot"
    mission_id = text(first(payload, "mission_id", "missionId")) or f"spot-state-{nickname}"
    mission_name = text(first(payload, "mission_name", "missionName")) or nickname
    taken_at = timestamp(first(payload, "timestamp", "time"))
    battery = _battery(payload)
    status = text(first(payload, "mission_status", "missionStatus", "status")) or "UNKNOWN"
    location_id = _location_id(payload)
    faults = _faults(payload)

    action_id = text(first(payload, "action_id", "actionId")) or f"{mission_id}:state"
    batch = CanonicalBatch(
        missions=[
            Mission(
                source=Source.spot,
                mission_id=mission_id,
                mission_name=mission_name,
                start_battery_pct=battery,
                end_battery_pct=battery,
                mission_status=status,
            )
        ],
        actions=[
            Action(
                source=Source.spot,
                action_id=action_id,
                mission_id=mission_id,
                timestamp=taken_at,
                location_id=location_id,
                asset_id=text(first(payload, "asset_id", "assetId")),
                action_type="ROBOT_STATE",
                battery_pct=battery,
                status="FAILED" if faults else status,
                failure_type=faults[0]["name"] if faults else None,
            )
        ],
    )
    for index, fault in enumerate(faults):
        batch.anomaly_claims.append(
            AnomalyClaim(
                source=Source.spot,
                anomaly_id=f"{action_id}:fault:{index}",
                action_id=action_id,
                mission_id=mission_id,
                location_id=location_id,
                timestamp=taken_at,
                anomaly_type=fault["name"],
                severity=fault["severity"],
                operator_review_required=True,
                description=fault["name"],
            )
        )
    return batch


def _battery(payload: dict) -> float | None:
    direct = number(first(payload, "battery_pct", "batteryPercentage", "battery_percentage"))
    if direct is not None:
        return direct
    power = payload.get("powerState") or payload.get("power_state") or {}
    if not isinstance(power, dict):
        return None
    charge = first(power, "locomotionChargePercentage", "locomotion_charge_percentage")
    if isinstance(charge, dict):
        return number(first(charge, "value"))
    return number(charge)


def _location_id(payload: dict) -> str | None:
    direct = text(first(payload, "location_id", "waypoint_id", "waypointId"))
    if direct is not None:
        return direct
    localization = payload.get("localization") or payload.get("waypoint") or {}
    if isinstance(localization, dict):
        return text(first(localization, "waypoint_id", "waypointId", "location_id"))
    return None


def _faults(payload: dict) -> list[dict[str, str]]:
    raw = payload.get("faults")
    if raw is None:
        system = payload.get("systemFaultState") or payload.get("system_fault_state") or {}
        if isinstance(system, dict):
            raw = system.get("faults")
    if not isinstance(raw, list):
        return []
    faults: list[dict[str, str]] = []
    for item in raw:
        if isinstance(item, str):
            name = text(item)
            severity = "UNKNOWN"
        elif isinstance(item, dict):
            name = text(first(item, "name", "faultName", "code"))
            severity = text(first(item, "severity")) or "UNKNOWN"
        else:
            continue
        if name is not None:
            faults.append({"name": name, "severity": severity})
    return faults


def _robot_id(payload: dict) -> str | None:
    robot = payload.get("robot")
    if isinstance(robot, dict):
        return text(first(robot, "nickname", "hostname", "id"))
    return text(first(payload, "hostname"))
