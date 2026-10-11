from app.mappers.parse import first, flag, number, text, timestamp
from app.schemas.canonical import (
    Action,
    AnomalyClaim,
    CanonicalBatch,
    Mission,
    Reading,
    Source,
)


def map_orbit(payload: dict) -> CanonicalBatch:
    """Map an Orbit run, run event, anomaly, or a bundle of those into canonical records.

    Field names follow the published Orbit objects: Run, RunEvent, RunCapture,
    and the anomaly sample in the Orbit guide. Site walks and site elements are
    mission definitions, so their status is DEFINED rather than a robot result.
    """
    batch = CanonicalBatch()
    if _is_anomaly(payload):
        _add_anomaly(batch, payload)
    elif _is_run_event(payload):
        _add_run_event(batch, payload, mission_id=text(first(payload, "runUuid", "run_uuid")))
    elif _is_site_walk(payload):
        _add_site_walk(batch, payload)
    elif _is_run(payload):
        _add_run(batch, payload)
    else:
        for run in _items(payload, "runs"):
            _add_run(batch, run)
        for event in _items(payload, "runEvents", "run_events"):
            _add_run_event(batch, event, mission_id=text(first(event, "runUuid", "run_uuid")))
        for anomaly in _items(payload, "anomalies"):
            _add_anomaly(batch, anomaly)
        for walk in _items(payload, "siteWalks", "site_walks"):
            _add_site_walk(batch, walk)
        if not _any_records(batch):
            raise ValueError("Unrecognized Orbit payload")
    return batch


def _add_run(batch: CanonicalBatch, run: dict, mission_id: str | None = None) -> None:
    mission_id = mission_id or text(first(run, "uuid", "id"))
    if mission_id is None:
        raise ValueError("Orbit run is missing uuid")
    batch.missions.append(
        Mission(
            source=Source.orbit,
            mission_id=mission_id,
            mission_name=text(first(run, "missionName", "mission_name", "name")) or mission_id,
            start_time=timestamp(first(run, "startTime", "start_time")),
            end_time=timestamp(first(run, "endTime", "end_time")),
            mission_status=text(first(run, "status", "missionStatus")) or "UNKNOWN",
        )
    )
    for index, event in enumerate(_nested(run, "runEvents", "run_events"), start=1):
        _add_run_event(batch, event, mission_id=mission_id, sequence=index)


def _add_run_event(
    batch: CanonicalBatch,
    event: dict,
    mission_id: str | None,
    sequence: int | None = None,
) -> None:
    action_id = text(first(event, "uuid", "id", "runEventUuid"))
    mission_id = mission_id or text(first(event, "runUuid", "run_uuid"))
    if action_id is None or mission_id is None:
        raise ValueError("Orbit run event is missing uuid or runUuid")
    _ensure_mission(batch, mission_id, text(first(event, "missionName", "mission_name")))
    batch.actions.append(
        Action(
            source=Source.orbit,
            action_id=action_id,
            mission_id=mission_id,
            sequence=sequence,
            timestamp=timestamp(first(event, "time", "timestamp", "createdAt")),
            location_id=text(first(event, "waypointId", "locationId", "location_id")),
            asset_id=text(first(event, "assetId", "asset_id")),
            action_type=text(first(event, "actionName", "actionType", "type", "name")) or "UNKNOWN",
            status=text(first(event, "actionStatus", "status")) or "UNKNOWN",
            failure_type=text(first(event, "failureType", "failure_type")),
        )
    )
    for capture in _nested(event, "dataCaptures", "runCaptures", "captures"):
        _add_capture(batch, capture, action_id=action_id, mission_id=mission_id, event=event)


def _add_anomaly(batch: CanonicalBatch, anomaly: dict) -> None:
    anomaly_id = text(first(anomaly, "uuid", "id"))
    action_id = text(first(anomaly, "runEventUuid", "run_event_uuid", "actionId"))
    mission_id = text(first(anomaly, "runUuid", "run_uuid", "missionId"))
    if anomaly_id is None or action_id is None or mission_id is None:
        raise ValueError("Orbit anomaly is missing uuid, runEventUuid, or runUuid")
    _ensure_mission(batch, mission_id, text(first(anomaly, "missionName", "mission_name")))
    if not _has_action(batch, action_id):
        batch.actions.append(
            Action(
                source=Source.orbit,
                action_id=action_id,
                mission_id=mission_id,
                timestamp=timestamp(first(anomaly, "time", "createdAt")),
                asset_id=text(first(anomaly, "assetId", "asset_id")),
                action_type=text(first(anomaly, "actionName", "name")) or "UNKNOWN",
                status="UNKNOWN",
            )
        )
    severity = first(anomaly, "severity")
    batch.anomaly_claims.append(
        AnomalyClaim(
            source=Source.orbit,
            anomaly_id=anomaly_id,
            action_id=action_id,
            mission_id=mission_id,
            asset_id=text(first(anomaly, "assetId", "asset_id")),
            timestamp=timestamp(first(anomaly, "time", "createdAt")),
            anomaly_type=text(first(anomaly, "channelName", "name", "title")) or "UNKNOWN",
            severity=str(severity) if severity is not None else "UNKNOWN",
            operator_review_required=flag(first(anomaly, "status")),
            description=text(first(anomaly, "title", "name")) or anomaly_id,
        )
    )
    for capture in _nested(anomaly, "dataCaptures", "captures"):
        _add_capture(batch, capture, action_id=action_id, mission_id=mission_id, event=anomaly)


def _add_site_walk(batch: CanonicalBatch, walk: dict) -> None:
    mission_id = text(first(walk, "uuid", "id"))
    if mission_id is None:
        raise ValueError("Orbit site walk is missing uuid")
    batch.missions.append(
        Mission(
            source=Source.orbit,
            mission_id=mission_id,
            mission_name=text(first(walk, "name", "missionName")) or mission_id,
            mission_status="DEFINED",
        )
    )
    for index, element in enumerate(_nested(walk, "siteElements", "elements"), start=1):
        action_id = text(first(element, "uuid", "id"))
        if action_id is None:
            continue
        batch.actions.append(
            Action(
                source=Source.orbit,
                action_id=action_id,
                mission_id=mission_id,
                sequence=index,
                location_id=text(first(element, "waypointId", "locationId")),
                asset_id=text(first(element, "assetId")),
                action_type=text(first(element, "name", "actionName", "type")) or "UNKNOWN",
                status="DEFINED",
            )
        )


def _add_capture(
    batch: CanonicalBatch,
    capture: dict,
    action_id: str,
    mission_id: str,
    event: dict,
) -> None:
    capture_id = text(first(capture, "uuid", "id")) or action_id
    captured_at = timestamp(first(capture, "time", "createdAt"))
    asset_id = text(first(event, "assetId", "asset_id"))
    location_id = text(first(event, "waypointId", "locationId", "location_id"))
    results = capture.get("keyResults") or capture.get("key_results") or []
    if not isinstance(results, list):
        return
    for result in results:
        if not isinstance(result, dict):
            continue
        value = number(first(result, "value"))
        if value is None:
            continue
        name = text(first(result, "name")) or "reading"
        batch.readings.append(
            Reading(
                source=Source.orbit,
                reading_id=f"{capture_id}:{name}",
                action_id=action_id,
                mission_id=mission_id,
                asset_id=asset_id,
                location_id=location_id,
                timestamp=captured_at,
                measurement_type=name,
                value=value,
                unit=text(first(result, "units", "unit")) or "",
                quality="UNSPECIFIED",
            )
        )


def _ensure_mission(batch: CanonicalBatch, mission_id: str, name: str | None) -> None:
    if any(mission.mission_id == mission_id for mission in batch.missions):
        return
    batch.missions.append(
        Mission(
            source=Source.orbit,
            mission_id=mission_id,
            mission_name=name or mission_id,
            mission_status="UNKNOWN",
        )
    )


def _has_action(batch: CanonicalBatch, action_id: str) -> bool:
    return any(action.action_id == action_id for action in batch.actions)


def _is_anomaly(payload: dict) -> bool:
    return "runEventUuid" in payload or "run_event_uuid" in payload


def _is_run_event(payload: dict) -> bool:
    return "runUuid" in payload or "run_uuid" in payload


def _is_run(payload: dict) -> bool:
    return "runEvents" in payload or "run_events" in payload or "missionName" in payload


def _is_site_walk(payload: dict) -> bool:
    return "siteElements" in payload or "elements" in payload


def _items(payload: dict, *keys: str) -> list[dict]:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _nested(record: dict, *keys: str) -> list[dict]:
    return _items(record, *keys)


def _any_records(batch: CanonicalBatch) -> bool:
    return any(
        (
            batch.missions,
            batch.actions,
            batch.readings,
            batch.anomaly_claims,
        )
    )
