"""Assign a verdict and a rank from the readings on an action.

The comparison ladder is:

1. This asset's own good readings of the same measurement, once eight others exist.
2. The organization's cohort of the same asset type. Not consulted yet.
3. An engineering low and high stored in anomaly_baselines. Not consulted yet.
4. A common-sense ceiling for the asset type and measurement, applied here.

Cohort and engineering rows belong in sentinel.anomaly_baselines. This module
still computes the asset fence in memory, and the ceiling in sanity.py.
A reading above that ceiling is a potential anomaly, including when the
asset does not yet have eight good readings. A decision is recorded either way.
"""
from app.dtos.canonical import Action, AnomalyClaim, CanonicalBatch, Reading
from app.dtos.queue import QueueItem, RuleDecision, RuleFiring, Verdict
from app.services.rules.sanity import exceeds_sanity

MIN_PEER_READINGS = 8
# evidence-v4 queues a good reading above a common-sense ceiling as a potential anomaly.
RULE_SET_VERSION = "evidence-v4"
VERDICT_BASE = {
    Verdict.inspection_failure: 100,
    Verdict.equipment_finding: 80,
    Verdict.potential_anomaly: 50,
    Verdict.unsupported_claim: 20,
}


def build_queue(batch: CanonicalBatch) -> list[QueueItem]:
    """Rank operator queue items from canonical records.

    A failed action or a questionable reading is an inspection failure.
    A successful good reading is an equipment finding only when its value
    falls outside that asset's other good readings of the same measurement.
    A good reading above the common-sense ceiling is a potential anomaly
    even without those readings. Any other anomaly label is an unsupported
    claim. A second failure on the same asset raises rank.
    """
    items = [item for item, _ in score_batch(batch) if item is not None]
    items.sort(key=lambda item: (-item.rank, item.mission_id, item.action_id or ""))
    return items


def score_batch(batch: CanonicalBatch) -> list[tuple[QueueItem | None, RuleDecision]]:
    """Score every action that is no longer DEFINED.

    A queued action keeps its operator item. An action that stays off the
    queue still produces a decision so the rule log records that choice.
    """
    missions = {mission.mission_id: mission for mission in batch.missions}
    assets = {asset.asset_id: asset for asset in batch.assets}
    readings_by_action: dict[str, list[Reading]] = {}
    claims_by_action: dict[str, list[AnomalyClaim]] = {}
    failures_by_asset: dict[str, list[Action]] = {}
    good_by_asset: dict[tuple[str, str], list[Reading]] = {}

    for reading in batch.readings:
        readings_by_action.setdefault(reading.action_id, []).append(reading)
        if reading.quality == "GOOD" and reading.asset_id:
            good_by_asset.setdefault((reading.asset_id, reading.measurement_type), []).append(reading)
    for claim in batch.anomaly_claims:
        claims_by_action.setdefault(claim.action_id, []).append(claim)
    for action in batch.actions:
        if action.status == "FAILED" and action.asset_id:
            failures_by_asset.setdefault(action.asset_id, []).append(action)

    scored: list[tuple[QueueItem | None, RuleDecision]] = []
    for action in batch.actions:
        if action.status == "DEFINED":
            continue
        scored.append(
            _item_for_action(
                action,
                readings_by_action.get(action.action_id, []),
                claims_by_action.get(action.action_id, []),
                missions.get(action.mission_id),
                assets.get(action.asset_id or ""),
                failures_by_asset.get(action.asset_id, []) if action.asset_id else [],
                good_by_asset,
            )
        )
    return scored


# Verdict. Failed or questionable work is an inspection failure. A good reading
# outside this asset's fence is an equipment finding. A good reading above the
# common-sense ceiling is a potential anomaly. Any other anomaly label is an
# unsupported claim.
def _item_for_action(
    action: Action,
    readings: list[Reading],
    claims: list[AnomalyClaim],
    mission,
    asset,
    asset_failures: list[Action],
    good_by_asset: dict[tuple[str, str], list[Reading]],
) -> tuple[QueueItem | None, RuleDecision]:
    questionable = any(reading.quality == "QUESTIONABLE" for reading in readings)
    good_readings = [reading for reading in readings if reading.quality == "GOOD"]
    failed = action.status == "FAILED" or questionable
    verdict: Verdict | None
    cause = ""
    extreme: list[Reading] = []
    asset_type = None if asset is None else asset.asset_type
    sanity = [
        reading
        for reading in good_readings
        if exceeds_sanity(reading.value, asset_type, reading.measurement_type)[0]
    ]
    if failed:
        verdict = Verdict.inspection_failure
        cause = action.failure_type or ("QUESTIONABLE_READING" if questionable else action.status)
    elif action.status == "SUCCESS" and good_readings:
        extreme = [
            reading
            for reading in good_readings
            if _is_extreme(reading, _peers(reading, action, good_by_asset))
        ]
        if extreme:
            verdict = Verdict.equipment_finding
            cause = extreme[0].measurement_type
        elif sanity:
            verdict = Verdict.potential_anomaly
            cause = sanity[0].measurement_type
        elif claims:
            verdict = Verdict.unsupported_claim
            cause = claims[0].anomaly_type
        else:
            verdict = None
    elif claims:
        verdict = Verdict.unsupported_claim
        cause = claims[0].anomaly_type
    else:
        verdict = None

    firings = [
        RuleFiring(
            rule_id="action_failed",
            matched=action.status == "FAILED",
            observed_value=action.status,
            threshold="FAILED",
        ),
        RuleFiring(
            rule_id="questionable_reading",
            matched=questionable,
            observed_value="QUESTIONABLE" if questionable else None,
            threshold="QUESTIONABLE",
        ),
        _extreme_firing(action, good_readings, good_by_asset),
        _sanity_firing(good_readings, asset_type),
        RuleFiring(
            rule_id="anomaly_claim",
            matched=bool(claims),
            observed_value=None if not claims else claims[0].anomaly_type,
            threshold="present",
        ),
    ]
    if verdict is None:
        return None, _decision(action, False, None, None, firings)

    other_failures = [failed_action for failed_action in asset_failures if failed_action.action_id != action.action_id]
    same_reason = [
        failed_action
        for failed_action in asset_failures
        if failed_action.action_id != action.action_id and failed_action.failure_type == action.failure_type
    ]
    rank, rank_firings = _rank_firings(verdict, action, asset, len(other_failures), len(same_reason))
    firings.extend(rank_firings)
    basis = extreme or sanity or good_readings
    sanity_limit = None if not sanity else exceeds_sanity(sanity[0].value, asset_type, sanity[0].measurement_type)[1]
    item = QueueItem(
        id=f"{action.source.value}:{action.action_id}",
        verdict=verdict,
        cause=cause,
        explanation=_explanation(
            verdict,
            cause,
            action,
            mission,
            claims,
            good_readings,
            extreme,
            sanity,
            asset_type,
            _other_count(sanity[0], action, good_by_asset) if sanity else 0,
            len(other_failures),
        ),
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
            "measurement_type": None if not basis else basis[0].measurement_type,
            "measurement_value": None if not basis else basis[0].value,
            "asset_type": asset_type,
            "sanity_limit": sanity_limit,
            "asset_criticality": None if asset is None else asset.criticality,
        },
    )
    return item, _decision(action, True, verdict, rank, firings)


# Asset baseline. Peers are other good readings of the same measurement on the
# same asset. Eight others are required before a fence is drawn.
def _peers(reading: Reading, action: Action, good_by_asset: dict[tuple[str, str], list[Reading]]) -> list[Reading]:
    asset_id = reading.asset_id or action.asset_id
    if not asset_id:
        return []
    return good_by_asset.get((asset_id, reading.measurement_type), [])


def _other_count(reading: Reading, action: Action, good_by_asset: dict[tuple[str, str], list[Reading]]) -> int:
    return sum(1 for peer in _peers(reading, action, good_by_asset) if peer.reading_id != reading.reading_id)


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


def _extreme_firing(
    action: Action,
    good_readings: list[Reading],
    good_by_asset: dict[tuple[str, str], list[Reading]],
) -> RuleFiring:
    if not good_readings:
        return RuleFiring(
            rule_id="extreme_reading",
            matched=False,
            threshold=str(MIN_PEER_READINGS),
        )
    fallback: RuleFiring | None = None
    for reading in good_readings:
        peers = _peers(reading, action, good_by_asset)
        others = [peer.value for peer in peers if peer.reading_id != reading.reading_id]
        if len(others) < MIN_PEER_READINGS:
            fallback = fallback or RuleFiring(
                rule_id="extreme_reading",
                matched=False,
                observed_value=str(len(others)),
                threshold=str(MIN_PEER_READINGS),
            )
            continue
        low, high = _fences(others)
        low_only = reading.measurement_type in {"LOCALIZATION_CONFIDENCE_PCT", "VISUAL_SCORE"}
        matched = reading.value < low if low_only else reading.value < low or reading.value > high
        firing = RuleFiring(
            rule_id="extreme_reading",
            matched=matched,
            observed_value=format(reading.value, "g"),
            threshold=f"{format(low, 'g')}..{format(high, 'g')}",
        )
        if matched:
            return firing
        fallback = fallback or firing
    return fallback or RuleFiring(rule_id="extreme_reading", matched=False, threshold=str(MIN_PEER_READINGS))


def _sanity_firing(good_readings: list[Reading], asset_type: str | None) -> RuleFiring:
    fallback: RuleFiring | None = None
    for reading in good_readings:
        over, limit = exceeds_sanity(reading.value, asset_type, reading.measurement_type)
        if limit is None:
            continue
        firing = RuleFiring(
            rule_id="sanity_limit",
            matched=over,
            observed_value=format(reading.value, "g"),
            threshold=format(limit, "g"),
        )
        if over:
            return firing
        fallback = fallback or firing
    return fallback or RuleFiring(rule_id="sanity_limit", matched=False)


def _decision(
    action: Action,
    queued: bool,
    verdict: Verdict | None,
    rank: int | None,
    firings: list[RuleFiring],
) -> RuleDecision:
    return RuleDecision(
        source=action.source.value,
        action_id=action.action_id,
        rule_set_version=RULE_SET_VERSION,
        queued=queued,
        verdict=verdict,
        rank=rank,
        firings=firings,
    )


# Priority. The rank stored on a queued decision is the sum of these points.
def _rank_firings(
    verdict: Verdict,
    action: Action,
    asset,
    other_failures: int,
    same_reason: int,
) -> tuple[int, list[RuleFiring]]:
    base = VERDICT_BASE[verdict]
    repeated_delta = 40 + min(other_failures, 5) * 5 if other_failures else 0
    same_matched = action.status == "FAILED" and same_reason > 0
    below_40 = action.battery_pct is not None and action.battery_pct < 40
    below_20 = action.battery_pct is not None and action.battery_pct < 20
    critical = asset is not None and asset.criticality == "CRITICAL"
    battery = None if action.battery_pct is None else format(action.battery_pct, "g")
    firings = [
        RuleFiring(rule_id="verdict_base", matched=True, observed_value=verdict.value, threshold=str(base), rank_delta=base),
        RuleFiring(
            rule_id="repeated_failure",
            matched=other_failures > 0,
            observed_value=str(other_failures),
            threshold="1",
            rank_delta=repeated_delta,
        ),
        RuleFiring(
            rule_id="same_failure_reason",
            matched=same_matched,
            observed_value=str(same_reason),
            threshold="1",
            rank_delta=20 if same_matched else 0,
        ),
        RuleFiring(
            rule_id="battery_below_40",
            matched=below_40,
            observed_value=battery,
            threshold="40",
            rank_delta=20 if below_40 else 0,
        ),
        RuleFiring(
            rule_id="battery_below_20",
            matched=below_20,
            observed_value=battery,
            threshold="20",
            rank_delta=10 if below_20 else 0,
        ),
        RuleFiring(
            rule_id="critical_asset",
            matched=critical,
            observed_value=None if asset is None else asset.criticality,
            threshold="CRITICAL",
            rank_delta=10 if critical else 0,
        ),
    ]
    return sum(firing.rank_delta for firing in firings), firings


# The sentence shown on the review card.
def _explanation(
    verdict: Verdict,
    cause: str,
    action: Action,
    mission,
    claims: list[AnomalyClaim],
    good_readings: list[Reading],
    extreme: list[Reading],
    sanity: list[Reading],
    asset_type: str | None,
    sanity_peers: int,
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
        sentence = f"{reading.measurement_type} {reading.value:g} {reading.unit} is outside this asset's other good readings."
        if other_failures:
            sentence += f" This asset already has {other_failures} other failed action{'s' if other_failures != 1 else ''}."
        return sentence
    if verdict is Verdict.potential_anomaly:
        reading = sanity[0]
        limit = exceeds_sanity(reading.value, asset_type, reading.measurement_type)[1]
        kind = asset_type or "equipment"
        sentence = f"{reading.measurement_type} {reading.value:g} {reading.unit} on this {kind} is above {limit:g} {reading.unit}."
        if sanity_peers < MIN_PEER_READINGS:
            noun = "reading" if sanity_peers == 1 else "readings"
            sentence += (
                f" This asset has {sanity_peers} other good {reading.measurement_type} {noun}, "
                "so this is a potential anomaly rather than a confirmed finding."
            )
        else:
            sentence += (
                " It still sits inside this asset's other good readings, so this is a potential "
                "anomaly from the equipment limit rather than a confirmed finding."
            )
        return sentence
    claim = claims[0].anomaly_type if claims else cause
    compared = good_readings[0] if good_readings else None
    if compared is None:
        return f"Labeled {claim}, but this action has no good reading to support it."
    return (
        f"Labeled {claim}, but {compared.measurement_type} {compared.value:g} {compared.unit} "
        "is inside this asset's other good readings."
    )
