from app.schemas.canonical import Action, AnomalyClaim, CanonicalBatch, Reading
from app.schemas.queue import QueueItem, Verdict

HOTSPOT_LOCATIONS = {"WP05", "WP09"}
HOTSPOT_NAMES = {"pipe gallery", "turbine hall south"}
MIN_PEER_READINGS = 8
VERDICT_BASE = {
    Verdict.inspection_failure: 100,
    Verdict.equipment_finding: 80,
    Verdict.unsupported_claim: 20,
}


def build_queue(batch: CanonicalBatch) -> list[QueueItem]:
    """Rank operator queue items from canonical records.

    A failed action or a questionable reading is an inspection failure.
    A successful good reading is an equipment finding only when its value
    falls outside the other good readings of that measurement. Any other
    anomaly label is an unsupported claim. A second failure on the same
    asset raises rank.
    """
    missions = {mission.mission_id: mission for mission in batch.missions}
    assets = {asset.asset_id: asset for asset in batch.assets}
    locations = {location.location_id: location for location in batch.locations}
    readings_by_action: dict[str, list[Reading]] = {}
    claims_by_action: dict[str, list[AnomalyClaim]] = {}
    failures_by_asset: dict[str, list[Action]] = {}
    good_by_measurement: dict[str, list[Reading]] = {}

    for reading in batch.readings:
        readings_by_action.setdefault(reading.action_id, []).append(reading)
        if reading.quality == "GOOD":
            good_by_measurement.setdefault(reading.measurement_type, []).append(reading)
    for claim in batch.anomaly_claims:
        claims_by_action.setdefault(claim.action_id, []).append(claim)
    for action in batch.actions:
        if action.status == "FAILED" and action.asset_id:
            failures_by_asset.setdefault(action.asset_id, []).append(action)

    items: list[QueueItem] = []
    for action in batch.actions:
        if action.status == "DEFINED":
            continue
        item = _item_for_action(
            action,
            readings_by_action.get(action.action_id, []),
            claims_by_action.get(action.action_id, []),
            missions.get(action.mission_id),
            assets.get(action.asset_id or ""),
            locations.get(action.location_id or ""),
            failures_by_asset.get(action.asset_id or [], []) if action.asset_id else [],
            good_by_measurement,
        )
        if item is not None:
            items.append(item)
    items.sort(key=lambda item: (-item.rank, item.mission_id, item.action_id or ""))
    return items


def _item_for_action(
    action: Action,
    readings: list[Reading],
    claims: list[AnomalyClaim],
    mission,
    asset,
    location,
    asset_failures: list[Action],
    good_by_measurement: dict[str, list[Reading]],
) -> QueueItem | None:
    questionable = any(reading.quality == "QUESTIONABLE" for reading in readings)
    good_readings = [reading for reading in readings if reading.quality == "GOOD"]
    failed = action.status == "FAILED" or questionable
    if failed:
        verdict = Verdict.inspection_failure
        cause = action.failure_type or ("QUESTIONABLE_READING" if questionable else action.status)
        extreme: list[Reading] = []
    elif action.status == "SUCCESS" and good_readings:
        extreme = [
            reading
            for reading in good_readings
            if _is_extreme(reading, good_by_measurement.get(reading.measurement_type, []))
        ]
        if extreme:
            verdict = Verdict.equipment_finding
            cause = extreme[0].measurement_type
        elif claims:
            verdict = Verdict.unsupported_claim
            cause = claims[0].anomaly_type
        else:
            return None
    elif claims:
        verdict = Verdict.unsupported_claim
        cause = claims[0].anomaly_type
        extreme = []
    else:
        return None

    other_failures = [failed_action for failed_action in asset_failures if failed_action.action_id != action.action_id]
    same_reason = [
        failed_action
        for failed_action in asset_failures
        if failed_action.action_id != action.action_id and failed_action.failure_type == action.failure_type
    ]
    rank = _rank(verdict, action, asset, location, len(other_failures), len(same_reason))
    return QueueItem(
        id=f"{action.source.value}:{action.action_id}",
        verdict=verdict,
        cause=cause,
        explanation=_explanation(verdict, cause, action, mission, claims, good_readings, extreme, len(other_failures)),
        mission_id=action.mission_id,
        action_id=action.action_id,
        asset_id=action.asset_id,
        location_id=action.location_id,
        rank=rank,
        evidence={
            "action_status": action.status,
            "failure_type": action.failure_type,
            "battery_pct": action.battery_pct,
            "mission_status": None if mission is None else mission.mission_status,
            "configuration_version": action.configuration_version,
            "claim_type": None if not claims else claims[0].anomaly_type,
            "other_failures_on_asset": len(other_failures),
            "same_failure_reason_on_asset": len(same_reason),
            "measurement_type": None if not (extreme or good_readings) else (extreme or good_readings)[0].measurement_type,
            "measurement_value": None if not (extreme or good_readings) else (extreme or good_readings)[0].value,
            "asset_criticality": None if asset is None else asset.criticality,
        },
    )


def _is_extreme(reading: Reading, peers: list[Reading]) -> bool:
    others = [peer.value for peer in peers if peer.reading_id != reading.reading_id]
    if len(others) < MIN_PEER_READINGS:
        return False
    low, high = _fences(others)
    if reading.measurement_type in {"LOCALIZATION_CONFIDENCE_PCT", "VISUAL_SCORE"}:
        return reading.value < low
    return reading.value < low or reading.value > high


def _fences(values: list[float]) -> tuple[float, float]:
    ordered = sorted(values)
    q1 = _percentile(ordered, 0.25)
    q3 = _percentile(ordered, 0.75)
    iqr = q3 - q1
    return q1 - 1.5 * iqr, q3 + 1.5 * iqr


def _percentile(ordered: list[float], fraction: float) -> float:
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _rank(verdict: Verdict, action: Action, asset, location, other_failures: int, same_reason: int) -> int:
    rank = VERDICT_BASE[verdict]
    if other_failures:
        rank += 40 + min(other_failures, 5) * 5
    if action.status == "FAILED" and same_reason:
        rank += 20
    if action.battery_pct is not None and action.battery_pct < 40:
        rank += 20
    if action.battery_pct is not None and action.battery_pct < 20:
        rank += 10
    location_name = "" if location is None else location.location_name.casefold()
    if action.location_id in HOTSPOT_LOCATIONS or location_name in HOTSPOT_NAMES:
        rank += 15
    if asset is not None and asset.criticality == "CRITICAL":
        rank += 10
    return rank


def _explanation(
    verdict: Verdict,
    cause: str,
    action: Action,
    mission,
    claims: list[AnomalyClaim],
    good_readings: list[Reading],
    extreme: list[Reading],
    other_failures: int,
) -> str:
    mission_status = None if mission is None else mission.mission_status
    if verdict is Verdict.inspection_failure:
        sentence = f"{action.action_type} failed: {cause}."
        if mission_status == "COMPLETED":
            sentence += f" Mission {action.mission_id} is still completed."
        if other_failures:
            sentence += f" This asset already has {other_failures} other failed action{'s' if other_failures != 1 else ''}."
        return sentence
    if verdict is Verdict.equipment_finding:
        reading = extreme[0]
        sentence = f"{reading.measurement_type} {reading.value:g} {reading.unit} is outside the other good readings."
        if other_failures:
            sentence += f" This asset already has {other_failures} other failed action{'s' if other_failures != 1 else ''}."
        return sentence
    claim = claims[0].anomaly_type if claims else cause
    compared = good_readings[0] if good_readings else None
    if compared is None:
        return f"Labeled {claim}, but this action has no good reading to support it."
    return (
        f"Labeled {claim}, but {compared.measurement_type} {compared.value:g} {compared.unit} "
        "is inside the other good readings."
    )
