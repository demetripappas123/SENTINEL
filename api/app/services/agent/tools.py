"""Agent tools. They read stored rows and do not rescore the queue.

A facility id is checked against the signed-in organization, then the
inspection rows for that organization are used. Assets are not assigned
to a facility. There is no subsystem column and no upstream or downstream
link. Those requests come back as insufficient data.
"""
from datetime import datetime, timedelta

from app.dtos.agent import (
    AnomaliesRequest,
    AssetDetailsRequest,
    AssetHistoryRequest,
    ComparePeriodsRequest,
    CompareTrendsRequest,
    CorrelationRequest,
    EvidenceRef,
    EvidenceRequest,
    FacilitySummaryRequest,
    HypothesisRequest,
    InspectionQueueRequest,
    RelatedAssetsRequest,
    RuleEvaluationsRequest,
    SearchAssetsRequest,
    TemporalOverlapRequest,
    ToolEnvelope,
    envelope,
)
from app.services.agent import read
from app.services.agent.stats import MIN_CORRELATION_PAIRS, align, change, correlate, summarize, utc

FACILITY_WARNING = "Inspection rows are stored by organization. A facility does not partition them."
NO_SUBSYSTEM = "Assets have no subsystem field."
NO_ML = "No machine-learning anomaly score is stored."
NOT_CAUSAL = "Correlation and time overlap do not establish a shared cause."
NO_FACILITY_LINK = "This facility is not in the signed-in organization."
QUEUE_STATUS = "The queue has no stored review status. Filter with a verdict name instead."

VERDICTS = {"inspection_failure", "equipment_finding", "potential_anomaly", "unsupported_claim"}
DETECTION = {
    "equipment_finding": "asset_fence",
    "potential_anomaly": "sanity_ceiling",
    "inspection_failure": "inspection_failure",
    "unsupported_claim": "unbacked_label",
}
RELATIONSHIPS = {"same_location", "same_asset_type", "same_zone", "same_environment"}


def search_assets(conn, organization_id: str, request_id: str, body: SearchAssetsRequest) -> ToolEnvelope:
    warnings = [NO_SUBSYSTEM]
    facility_warning = _facility(conn, organization_id, body.facility_id)
    if facility_warning == "missing":
        return _insufficient("search_assets", request_id, NO_FACILITY_LINK, warnings)
    if facility_warning:
        warnings.append(facility_warning)
    rows = read.search_assets(conn, organization_id, body.query, body.asset_type, body.limit)
    capabilities = _capabilities(conn, organization_id, [row["asset_id"] for row in rows])
    assets = [_asset_summary(row, capabilities.get(row["asset_id"], [])) for row in rows]
    return envelope(
        "search_assets",
        request_id,
        "success",
        {"assets": assets},
        evidence=[_ref("asset", row["asset_id"], row["asset_id"], None, row["source"], "sentinel.assets") for row in rows],
        warnings=warnings,
        record_count=len(assets),
        truncated=len(assets) == body.limit,
    )


def get_asset_details(conn, organization_id: str, request_id: str, body: AssetDetailsRequest) -> ToolEnvelope:
    row = read.asset(conn, organization_id, body.asset_id)
    if row is None:
        return _insufficient("get_asset_details", request_id, "That asset is not in this organization.")
    capabilities = _capabilities(conn, organization_id, [row["asset_id"]]).get(row["asset_id"], [])
    counts = {item["asset_id"]: item["action_count"] for item in read.action_counts(conn, organization_id, [row["asset_id"]])}
    stamps = [item["first_timestamp"] for item in capabilities if item.get("first_timestamp")]
    latest = [item["last_timestamp"] for item in capabilities if item.get("last_timestamp")]
    data = {
        **_asset_summary(row, capabilities),
        "criticality": row["criticality"],
        "observation_start": _iso(min(stamps)) if stamps else None,
        "observation_end": _iso(max(latest)) if latest else None,
        "action_count": int(counts.get(row["asset_id"], 0)),
        "subsystem": None,
    }
    return envelope(
        "get_asset_details",
        request_id,
        "success",
        data,
        evidence=[_ref("asset", row["asset_id"], row["asset_id"], None, row["source"], "sentinel.assets")],
        warnings=[NO_SUBSYSTEM],
        record_count=1,
    )


def get_asset_history(conn, organization_id: str, request_id: str, body: AssetHistoryRequest) -> ToolEnvelope:
    if read.asset(conn, organization_id, body.asset_id) is None:
        return _insufficient("get_asset_history", request_id, "That asset is not in this organization.")
    start, end, window_warning = _window(body.start_time, body.end_time)
    if window_warning:
        return _insufficient("get_asset_history", request_id, window_warning)
    cursor_time, cursor_id, cursor_warning = _cursor(body.cursor)
    if cursor_warning:
        return _insufficient("get_asset_history", request_id, cursor_warning)
    rows = read.readings(
        conn,
        organization_id,
        [body.asset_id],
        start,
        end,
        body.measurement_types,
        body.limit,
        cursor_time,
        cursor_id,
    )
    warnings = _unit_warnings(rows)
    if not rows:
        warnings.append("No readings were stored for this asset in the requested window.")
    observations = [_observation(row) for row in rows]
    next_cursor = None
    if len(rows) == body.limit and rows[-1]["timestamp"] is not None:
        next_cursor = f"{utc(rows[-1]['timestamp']).isoformat()}|{rows[-1]['reading_id']}"
    return envelope(
        "get_asset_history",
        request_id,
        "success",
        {"observations": observations},
        evidence=[_reading_ref(row) for row in rows],
        warnings=warnings,
        record_count=len(observations),
        truncated=next_cursor is not None,
        next_cursor=next_cursor,
    )


def get_inspection_queue(conn, organization_id: str, request_id: str, body: InspectionQueueRequest) -> ToolEnvelope:
    warnings = []
    facility_warning = _facility(conn, organization_id, body.facility_id)
    if facility_warning == "missing":
        return _insufficient("get_inspection_queue", request_id, NO_FACILITY_LINK)
    if facility_warning:
        warnings.append(facility_warning)
    if body.status and body.status not in VERDICTS:
        return _insufficient("get_inspection_queue", request_id, QUEUE_STATUS, warnings)
    rows = read.queue_items(conn, organization_id)
    if body.status:
        rows = [row for row in rows if row["verdict"] == body.status]
    claim_severity = {}
    for claim in read.claims(conn, organization_id, None, None, None):
        claim_severity.setdefault((claim["source"], claim["action_id"]), claim["severity"])
    if body.severity:
        rows = [row for row in rows if claim_severity.get((row["source"], row["action_id"])) == body.severity]
        warnings.append("Severity is the anomaly label severity, not a separate queue field.")
    rows = rows[: body.limit]
    named = {
        row["asset_id"]: row
        for row in read.assets_by_ids(conn, organization_id, [item["asset_id"] for item in rows if item.get("asset_id")])
    }
    items = []
    evidence = []
    for row in rows:
        item_id = f"{row['source']}:{row['action_id']}"
        asset = named.get(row["asset_id"], {})
        items.append(
            {
                "inspection_id": row["action_id"],
                "queue_item_id": item_id,
                "asset_id": row["asset_id"],
                "asset_name": asset.get("asset_name"),
                "asset_type": asset.get("asset_type"),
                "location_id": row.get("location_id"),
                "mission_id": row.get("mission_id"),
                "verdict": row["verdict"],
                "rank": row["rank"],
                "cause": row["cause"],
                "explanation": row["explanation"],
                "severity": claim_severity.get((row["source"], row["action_id"])),
                "updated_at": _iso(row.get("updated_at")),
            }
        )
        evidence.append(_ref("queue_item", item_id, row["asset_id"], row.get("updated_at"), row["source"], "sentinel.queue_items"))
    return envelope(
        "get_inspection_queue",
        request_id,
        "success",
        {"items": items},
        evidence=evidence,
        warnings=warnings,
        record_count=len(items),
        truncated=len(items) == body.limit,
    )


def get_anomalies(conn, organization_id: str, request_id: str, body: AnomaliesRequest) -> ToolEnvelope:
    warnings = [NO_ML]
    facility_warning = _facility(conn, organization_id, body.facility_id)
    if facility_warning == "missing":
        return _insufficient("get_anomalies", request_id, NO_FACILITY_LINK, warnings)
    if facility_warning:
        warnings.append(facility_warning)
    start, end, window_warning = _window(body.start_time, body.end_time)
    if window_warning:
        return _insufficient("get_anomalies", request_id, window_warning, warnings)
    if body.asset_id and read.asset(conn, organization_id, body.asset_id) is None:
        return _insufficient("get_anomalies", request_id, "That asset is not in this organization.", warnings)
    claim_rows = read.claims(conn, organization_id, body.asset_id, start, end)
    if body.severity:
        claim_rows = [row for row in claim_rows if row["severity"] == body.severity]
    reading_rows = read.readings(
        conn,
        organization_id,
        [body.asset_id] if body.asset_id else _asset_ids(claim_rows),
        start,
        end,
        None,
        500,
    ) if claim_rows else []
    readings_by_action = {}
    for row in reading_rows:
        readings_by_action.setdefault(row["action_id"], row)
    anomalies = []
    evidence = []
    for claim in claim_rows:
        reading = readings_by_action.get(claim["action_id"])
        anomalies.append(
            {
                "anomaly_id": claim["anomaly_id"],
                "asset_id": claim["asset_id"],
                "timestamp": _iso(claim["timestamp"]),
                "measurement_type": None if reading is None else reading["measurement_type"],
                "observed_value": None if reading is None else reading["value"],
                "unit": None if reading is None else reading["unit"],
                "detection_method": "spot_label",
                "threshold": None,
                "severity": claim["severity"],
                "action_id": claim["action_id"],
            }
        )
        evidence.append(_ref("anomaly_claim", claim["anomaly_id"], claim["asset_id"], claim["timestamp"], claim["source"], "sentinel.anomaly_claims"))
    decision_rows = []
    if start and end:
        decision_rows = [row for row in read.decisions_between(conn, organization_id, start, end, body.asset_id) if row["queued"]]
    failed_checks = [row for row in decision_rows if row["verdict"] == "inspection_failure"]
    if failed_checks:
        warnings.append("Failed inspections are queue items, not anomalies, and they do not confirm a Spot label.")
    decision_rows = [row for row in decision_rows if row["verdict"] != "inspection_failure"]
    firing_rows = read.firings(conn, organization_id, [row["id"] for row in decision_rows])
    threshold_by_decision = {}
    for firing in firing_rows:
        if firing["matched"] and firing["rule_id"] in {"extreme_reading", "sanity_limit"}:
            threshold_by_decision[firing["decision_id"]] = firing["threshold"]
    for decision in decision_rows:
        method = DETECTION.get(decision["verdict"], decision["verdict"])
        if body.severity and method != body.severity:
            continue
        anomalies.append(
            {
                "anomaly_id": decision["id"],
                "asset_id": decision["asset_id"],
                "timestamp": _iso(decision["decided_at"]),
                "measurement_type": None,
                "observed_value": None,
                "unit": None,
                "detection_method": method,
                "threshold": threshold_by_decision.get(decision["id"]),
                "severity": None,
                "action_id": decision["action_id"],
            }
        )
        evidence.append(_ref("rule_decision", decision["id"], decision["asset_id"], decision["decided_at"], decision["source"], "sentinel.rule_decisions"))
    anomalies = anomalies[: body.limit]
    evidence = evidence[: body.limit]
    return envelope(
        "get_anomalies",
        request_id,
        "success",
        {"anomalies": anomalies},
        evidence=evidence,
        warnings=warnings,
        record_count=len(anomalies),
        truncated=len(anomalies) == body.limit,
    )


def get_rule_evaluations(conn, organization_id: str, request_id: str, body: RuleEvaluationsRequest) -> ToolEnvelope:
    if body.event_id and not body.inspection_id:
        return _insufficient(
            "get_rule_evaluations",
            request_id,
            "Replay events are derived and are not stored. Pass inspection_id, which is the action id.",
        )
    if not body.inspection_id:
        return _insufficient("get_rule_evaluations", request_id, "inspection_id is required.")
    decisions = read.decisions_for_action(conn, organization_id, body.inspection_id)
    if not decisions:
        return _insufficient("get_rule_evaluations", request_id, "No rule evaluation is stored for that action.")
    firing_rows = read.firings(conn, organization_id, [row["id"] for row in decisions])
    grouped: dict[str, list[dict]] = {}
    for firing in firing_rows:
        grouped.setdefault(firing["decision_id"], []).append(
            {
                "rule_id": firing["rule_id"],
                "matched": firing["matched"],
                "observed_value": firing["observed_value"],
                "threshold": firing["threshold"],
                "rank_delta": firing["rank_delta"],
            }
        )
    evaluations = [
        {
            "rule_evaluation_id": row["id"],
            "rule_set_version": row["rule_set_version"],
            "inspection_id": row["action_id"],
            "verdict": row["verdict"],
            "queued": row["queued"],
            "rank": row["rank"],
            "evaluated_at": _iso(row["decided_at"]),
            "firings": grouped.get(row["id"], []),
        }
        for row in decisions
    ]
    return envelope(
        "get_rule_evaluations",
        request_id,
        "success",
        {"evaluations": evaluations},
        evidence=[_ref("rule_decision", row["id"], None, row["decided_at"], row["source"], "sentinel.rule_decisions") for row in decisions],
        record_count=len(evaluations),
    )


def get_facility_summary(conn, organization_id: str, request_id: str, body: FacilitySummaryRequest) -> ToolEnvelope:
    owned = read.facilities(conn, organization_id)
    if body.facility_id:
        if _facility(conn, organization_id, body.facility_id) == "missing":
            return _insufficient("get_facility_summary", request_id, NO_FACILITY_LINK)
        owned = [row for row in owned if row["id"] == body.facility_id]
    elif not owned:
        return _insufficient("get_facility_summary", request_id, "This organization has no facility.")
    start, end, window_warning = _window(body.start_time, body.end_time)
    if window_warning:
        return _insufficient("get_facility_summary", request_id, window_warning)
    fresh = read.freshness(conn, organization_id)
    actions = read.recent_actions(conn, organization_id, start, end, 10)
    data = {
        "facilities": [{"id": row["id"], "name": row["name"]} for row in owned],
        "facility_id": owned[0]["id"] if len(owned) == 1 else body.facility_id,
        "assets_by_type": read.asset_type_counts(conn, organization_id),
        "queue_by_verdict": read.queue_verdict_counts(conn, organization_id),
        "claims_by_type": read.claim_type_counts(conn, organization_id, start, end),
        "recent_actions": [
            {
                "action_id": row["action_id"],
                "asset_id": row["asset_id"],
                "timestamp": _iso(row["timestamp"]),
                "action_type": row["action_type"],
                "status": row["status"],
            }
            for row in actions
        ],
        "latest_reading_at": _iso(fresh.get("latest_reading")),
        "latest_action_at": _iso(fresh.get("latest_action")),
    }
    return envelope(
        "get_facility_summary",
        request_id,
        "success",
        data,
        evidence=[_ref("action", row["action_id"], row["asset_id"], row["timestamp"], row["source"], "sentinel.actions") for row in actions],
        warnings=[FACILITY_WARNING],
        record_count=len(actions),
    )


def get_evidence(conn, organization_id: str, request_id: str, body: EvidenceRequest) -> ToolEnvelope:
    rows = read.evidence_rows(conn, organization_id, body.evidence_type, body.evidence_ids)
    found = {row["id"] for row in rows}
    missing = [item for item in body.evidence_ids if item not in found]
    warnings = []
    if missing:
        warnings.append("Some ids are not in this organization or do not exist.")
    if not rows:
        return _insufficient("get_evidence", request_id, "None of those ids are in this organization.", warnings)
    table = {
        "asset": "sentinel.assets",
        "action": "sentinel.actions",
        "reading": "sentinel.readings",
        "anomaly_claim": "sentinel.anomaly_claims",
        "queue_item": "sentinel.queue_items",
        "rule_decision": "sentinel.rule_decisions",
    }[body.evidence_type]
    evidence = [
        _ref(body.evidence_type, row["id"], row.get("asset_id"), row.get("timestamp") or row.get("decided_at"), row.get("source"), table)
        for row in rows
    ]
    return envelope(
        "get_evidence",
        request_id,
        "success",
        {"records": rows},
        evidence=evidence,
        warnings=warnings,
        record_count=len(rows),
    )


def get_related_assets(conn, organization_id: str, request_id: str, body: RelatedAssetsRequest) -> ToolEnvelope:
    origin = read.asset(conn, organization_id, body.asset_id)
    if origin is None:
        return _insufficient("get_related_assets", request_id, "That asset is not in this organization.")
    requested = body.relationship_types or sorted(RELATIONSHIPS)
    unsupported = [item for item in requested if item not in RELATIONSHIPS]
    supported = [item for item in requested if item in RELATIONSHIPS]
    warnings = []
    if unsupported:
        warnings.append("Unsupported relationship types were ignored: " + ", ".join(unsupported) + ".")
    if not supported:
        return _insufficient("get_related_assets", request_id, "None of the requested relationship types are stored.", warnings)
    candidates = read.search_assets(conn, organization_id, None, None, 500)
    location_ids = list({origin["location_id"], *[row["location_id"] for row in candidates]})
    locations = {row["location_id"]: row for row in read.locations_by_ids(conn, organization_id, location_ids)}
    origin_location = locations.get(origin["location_id"])
    related = []
    for candidate in candidates:
        if candidate["asset_id"] == origin["asset_id"]:
            continue
        for kind in supported:
            if _related(kind, origin, candidate, origin_location, locations):
                related.append(
                    {
                        "asset_id": candidate["asset_id"],
                        "asset_name": candidate["asset_name"],
                        "relationship_type": kind,
                        "relationship_source": _relationship_source(kind),
                        "inferred": True,
                    }
                )
    related = related[: body.limit]
    warnings.append("Relationships come from shared stored fields. No physical link is stored.")
    return envelope(
        "get_related_assets",
        request_id,
        "success",
        {"related": related},
        evidence=[_ref("asset", row["asset_id"], row["asset_id"], None, None, "sentinel.assets") for row in related],
        warnings=warnings,
        record_count=len(related),
        truncated=len(related) == body.limit,
    )


def compare_asset_trends(conn, organization_id: str, request_id: str, body: CompareTrendsRequest) -> ToolEnvelope:
    start, end, window_warning = _window(body.start_time, body.end_time)
    if window_warning:
        return _insufficient("compare_asset_trends", request_id, window_warning)
    if body.normalization_method not in {None, "none"}:
        return _insufficient("compare_asset_trends", request_id, "Only normalization_method none is supported.")
    assets = read.assets_by_ids(conn, organization_id, body.asset_ids)
    if {row["asset_id"] for row in assets} != set(body.asset_ids):
        return _insufficient("compare_asset_trends", request_id, "One or more assets are not in this organization.")
    rows = read.readings(conn, organization_id, body.asset_ids, start, end, [body.measurement_type], 5000)
    grouped: dict[str, list[dict]] = {asset_id: [] for asset_id in body.asset_ids}
    for row in rows:
        grouped[row["asset_id"]].append(row)
    units = {row["unit"] for row in rows}
    types = {row["asset_type"] for row in assets}
    comparable = len(units) <= 1 and len(types) == 1 and all(grouped.values())
    warnings = []
    if len(units) > 1:
        warnings.append("The assets do not share one unit, so the values were not combined.")
    if len(types) > 1:
        warnings.append("The assets are different equipment types, so they were not treated as one population.")
    if not all(grouped.values()):
        warnings.append("At least one asset has no readings of this measurement in the window.")
    series = []
    evidence = []
    for asset_row in assets:
        points = [(utc(row["timestamp"]), row["value"]) for row in grouped[asset_row["asset_id"]] if row["timestamp"] is not None]
        values = [value for _, value in points]
        series.append(
            {
                "asset_id": asset_row["asset_id"],
                "asset_type": asset_row["asset_type"],
                "unit": None if not grouped[asset_row["asset_id"]] else grouped[asset_row["asset_id"]][0]["unit"],
                "summary": summarize(values),
                "change": change(points),
                "baseline_deviation": None,
            }
        )
        evidence.extend(_reading_ref(row) for row in grouped[asset_row["asset_id"]][:20])
    warnings.append("No global measurement baseline is used. An asset baseline is not computed inside the comparison window.")
    return envelope(
        "compare_asset_trends",
        request_id,
        "success" if comparable else "insufficient_data",
        {"measurement_type": body.measurement_type, "comparable": comparable, "aggregation_interval": body.aggregation_interval, "series": series},
        evidence=evidence,
        warnings=warnings,
        record_count=len(rows),
    )


def analyze_temporal_overlap(conn, organization_id: str, request_id: str, body: TemporalOverlapRequest) -> ToolEnvelope:
    start, end, window_warning = _window(body.start_time, body.end_time)
    if window_warning:
        return _insufficient("analyze_temporal_overlap", request_id, window_warning)
    assets = read.assets_by_ids(conn, organization_id, body.asset_ids)
    if {row["asset_id"] for row in assets} != set(body.asset_ids):
        return _insufficient("analyze_temporal_overlap", request_id, "One or more assets are not in this organization.")
    claim_rows = [row for row in read.claims(conn, organization_id, None, start, end) if row["asset_id"] in set(body.asset_ids)]
    if body.anomaly_types:
        claim_rows = [row for row in claim_rows if row["anomaly_type"] in set(body.anomaly_types)]
    coverage = read.reading_coverage(conn, organization_id, body.asset_ids, start, end)
    overlaps = []
    window = timedelta(minutes=body.window_minutes)
    for index, left in enumerate(claim_rows):
        if left["timestamp"] is None:
            continue
        for right in claim_rows[index + 1 :]:
            if right["asset_id"] == left["asset_id"] or right["timestamp"] is None:
                continue
            delta = abs(utc(left["timestamp"]) - utc(right["timestamp"]))
            if delta <= window:
                overlaps.append(
                    {
                        "asset_ids": sorted([left["asset_id"], right["asset_id"]]),
                        "anomaly_ids": [left["anomaly_id"], right["anomaly_id"]],
                        "minutes_apart": delta.total_seconds() / 60,
                    }
                )
    return envelope(
        "analyze_temporal_overlap",
        request_id,
        "success",
        {
            "anomaly_count": len(claim_rows),
            "overlaps": overlaps,
            "coverage": coverage,
            "causation": False,
        },
        evidence=[_ref("anomaly_claim", row["anomaly_id"], row["asset_id"], row["timestamp"], row["source"], "sentinel.anomaly_claims") for row in claim_rows],
        warnings=[NOT_CAUSAL],
        record_count=len(overlaps),
    )


def compute_measurement_correlation(conn, organization_id: str, request_id: str, body: CorrelationRequest) -> ToolEnvelope:
    start, end, window_warning = _window(body.start_time, body.end_time)
    if window_warning:
        return _insufficient("compute_measurement_correlation", request_id, window_warning)
    assets = read.assets_by_ids(conn, organization_id, body.asset_ids)
    if {row["asset_id"] for row in assets} != set(body.asset_ids):
        return _insufficient("compute_measurement_correlation", request_id, "One or more assets are not in this organization.")
    if len({row["asset_type"] for row in assets}) > 1:
        return _insufficient(
            "compute_measurement_correlation",
            request_id,
            "The two assets are different equipment types, so their measurements were not aligned.",
        )
    rows = read.readings(conn, organization_id, body.asset_ids, start, end, [body.measurement_type], 5000)
    if len({row["unit"] for row in rows}) > 1:
        return _insufficient("compute_measurement_correlation", request_id, "The readings do not share one unit.")
    series = {asset_id: [] for asset_id in body.asset_ids}
    for row in rows:
        if row["timestamp"] is not None:
            series[row["asset_id"]].append((utc(row["timestamp"]), row["value"]))
    left_id, right_id = body.asset_ids
    left, right, missing_buckets = align(series[left_id], series[right_id], body.alignment_interval)
    union = missing_buckets + len(left)
    missing_pct = None if union == 0 else (missing_buckets / union) * 100
    coefficient = correlate(left, right, body.method)
    warnings = [NOT_CAUSAL, "Missing buckets were skipped. Values were not interpolated."]
    if len(left) < MIN_CORRELATION_PAIRS or coefficient is None:
        reason = "A constant series has no correlation." if coefficient is None and len(left) >= 2 else "Fewer than 8 aligned observations."
        return envelope(
            "compute_measurement_correlation",
            request_id,
            "insufficient_data",
            {
                "coefficient": coefficient,
                "aligned_observations": len(left),
                "missing_data_pct": missing_pct,
                "method": body.method,
                "alignment_interval": body.alignment_interval,
                "causation": False,
            },
            warnings=[reason, *warnings],
            record_count=len(left),
        )
    return envelope(
        "compute_measurement_correlation",
        request_id,
        "success",
        {
            "coefficient": coefficient,
            "aligned_observations": len(left),
            "missing_data_pct": missing_pct,
            "method": body.method,
            "alignment_interval": body.alignment_interval,
            "time_start": _iso(start),
            "time_end": _iso(end),
            "causation": False,
        },
        evidence=[_reading_ref(row) for row in rows[:40]],
        warnings=warnings,
        record_count=len(left),
    )


def compare_time_periods(conn, organization_id: str, request_id: str, body: ComparePeriodsRequest) -> ToolEnvelope:
    if body.asset_id is None and body.facility_id is None:
        return _insufficient("compare_time_periods", request_id, "Provide an asset_id or a facility_id.")
    if body.facility_id and _facility(conn, organization_id, body.facility_id) == "missing":
        return _insufficient("compare_time_periods", request_id, NO_FACILITY_LINK)
    if body.asset_id and read.asset(conn, organization_id, body.asset_id) is None:
        return _insufficient("compare_time_periods", request_id, "That asset is not in this organization.")
    baseline_warning = _window(body.baseline_start, body.baseline_end)[2]
    comparison_warning = _window(body.comparison_start, body.comparison_end)[2]
    if baseline_warning or comparison_warning:
        return _insufficient("compare_time_periods", request_id, baseline_warning or comparison_warning)
    asset_ids = [body.asset_id] if body.asset_id else [row["asset_id"] for row in read.search_assets(conn, organization_id, None, None, 500)]
    baseline = _period(conn, organization_id, asset_ids, body.baseline_start, body.baseline_end, body.measurement_types)
    comparison = _period(conn, organization_id, asset_ids, body.comparison_start, body.comparison_end, body.measurement_types)
    warnings = [FACILITY_WARNING] if body.facility_id else []
    if baseline["reading_count"] == 0 or comparison["reading_count"] == 0:
        warnings.append("One of the periods has no readings.")
    return envelope(
        "compare_time_periods",
        request_id,
        "success",
        {"baseline": baseline, "comparison": comparison, "claim_count_change": comparison["claim_count"] - baseline["claim_count"], "queued_decision_change": comparison["queued_decision_count"] - baseline["queued_decision_count"]},
        warnings=warnings,
        record_count=baseline["reading_count"] + comparison["reading_count"],
    )


def investigate_hypothesis(conn, organization_id: str, request_id: str, body: HypothesisRequest) -> ToolEnvelope:
    if body.hypothesis_type == "shared_anomaly_window":
        return _shared_window(conn, organization_id, request_id, body)
    if body.hypothesis_type == "common_subsystem":
        return _common_subsystem(conn, organization_id, request_id, body)
    if body.hypothesis_type == "correlated_measurement_change":
        return _correlated_change(conn, organization_id, request_id, body)
    return _increased_frequency(conn, organization_id, request_id, body)


def _shared_window(conn, organization_id: str, request_id: str, body: HypothesisRequest) -> ToolEnvelope:
    minutes = body.parameters.get("window_minutes", 60)
    if not isinstance(minutes, int):
        return _insufficient("investigate_hypothesis", request_id, "window_minutes must be an integer.")
    overlap = analyze_temporal_overlap(
        conn,
        organization_id,
        request_id,
        TemporalOverlapRequest(asset_ids=body.asset_ids, start_time=body.start_time, end_time=body.end_time, window_minutes=minutes),
    )
    if overlap.status != "success":
        return _hypothesis(request_id, body, "inconclusive", overlap.data, overlap.evidence, overlap.warnings)
    result = "supported" if overlap.data["overlaps"] else "not_supported"
    if any(item["reading_count"] == 0 for item in overlap.data["coverage"]):
        result = "inconclusive"
    return _hypothesis(request_id, body, result, overlap.data, overlap.evidence, overlap.warnings)


def _common_subsystem(conn, organization_id: str, request_id: str, body: HypothesisRequest) -> ToolEnvelope:
    if len(body.asset_ids) < 2:
        return _hypothesis(request_id, body, "inconclusive", {}, [], [NO_SUBSYSTEM, "At least two assets are required."])
    related = get_related_assets(
        conn,
        organization_id,
        request_id,
        RelatedAssetsRequest(asset_id=body.asset_ids[0], relationship_types=["same_location", "same_zone"], limit=100),
    )
    if related.status != "success":
        return _hypothesis(request_id, body, "inconclusive", related.data, related.evidence, [NO_SUBSYSTEM, *related.warnings])
    others = set(body.asset_ids[1:])
    hits = [row for row in related.data["related"] if row["asset_id"] in others]
    result = "supported" if hits else "not_supported"
    return _hypothesis(request_id, body, result, {"shared": hits}, related.evidence, [NO_SUBSYSTEM, *related.warnings])


def _correlated_change(conn, organization_id: str, request_id: str, body: HypothesisRequest) -> ToolEnvelope:
    measurement = body.parameters.get("measurement_type")
    interval = body.parameters.get("alignment_interval", "hour")
    method = body.parameters.get("method", "pearson")
    if not isinstance(measurement, str) or interval not in {"minute", "hour", "day"} or method not in {"pearson", "spearman"}:
        return _insufficient("investigate_hypothesis", request_id, "parameters need measurement_type, alignment_interval, and method.")
    if len(body.asset_ids) != 2:
        return _insufficient("investigate_hypothesis", request_id, "correlated_measurement_change compares exactly two assets.")
    result = compute_measurement_correlation(
        conn,
        organization_id,
        request_id,
        CorrelationRequest(
            asset_ids=body.asset_ids,
            measurement_type=measurement,
            start_time=body.start_time,
            end_time=body.end_time,
            alignment_interval=interval,
            method=method,
        ),
    )
    coefficient = result.data.get("coefficient")
    if result.status != "success" or coefficient is None:
        outcome = "inconclusive"
    elif abs(coefficient) >= 0.7:
        outcome = "supported"
    elif abs(coefficient) <= 0.3:
        outcome = "not_supported"
    else:
        outcome = "inconclusive"
    return _hypothesis(request_id, body, outcome, result.data, result.evidence, result.warnings)


def _increased_frequency(conn, organization_id: str, request_id: str, body: HypothesisRequest) -> ToolEnvelope:
    try:
        period = ComparePeriodsRequest(
            asset_id=body.asset_ids[0] if body.asset_ids else None,
            baseline_start=datetime.fromisoformat(body.parameters["baseline_start"]),
            baseline_end=datetime.fromisoformat(body.parameters["baseline_end"]),
            comparison_start=datetime.fromisoformat(body.parameters["comparison_start"]),
            comparison_end=datetime.fromisoformat(body.parameters["comparison_end"]),
        )
    except (KeyError, TypeError, ValueError):
        return _insufficient("investigate_hypothesis", request_id, "parameters need baseline and comparison start and end timestamps.")
    compared = compare_time_periods(conn, organization_id, request_id, period)
    if compared.status != "success":
        return _hypothesis(request_id, body, "inconclusive", compared.data, compared.evidence, compared.warnings)
    if compared.data["baseline"]["reading_count"] == 0 or compared.data["comparison"]["reading_count"] == 0:
        outcome = "inconclusive"
    elif compared.data["claim_count_change"] > 0:
        outcome = "supported"
    else:
        outcome = "not_supported"
    return _hypothesis(request_id, body, outcome, compared.data, compared.evidence, compared.warnings)


def _hypothesis(request_id, body: HypothesisRequest, result: str, data: dict, evidence: list[EvidenceRef], warnings: list[str]) -> ToolEnvelope:
    return envelope(
        "investigate_hypothesis",
        request_id,
        "success" if result != "inconclusive" else "insufficient_data",
        {
            "hypothesis_type": body.hypothesis_type,
            "asset_ids": body.asset_ids,
            "result": result,
            "statistics": data,
            "limitations": warnings,
        },
        evidence=evidence,
        warnings=warnings,
        record_count=len(evidence),
    )


def _period(conn, organization_id: str, asset_ids: list[str], start: datetime, end: datetime, measurement_types: list[str] | None) -> dict:
    rows = read.readings(conn, organization_id, asset_ids, utc(start), utc(end), measurement_types, 5000)
    claims = [row for row in read.claims(conn, organization_id, None, utc(start), utc(end)) if row["asset_id"] in set(asset_ids)]
    decisions = read.decisions_between(conn, organization_id, utc(start), utc(end), asset_ids[0] if len(asset_ids) == 1 else None)
    if len(asset_ids) != 1:
        decisions = [row for row in decisions if row["asset_id"] in set(asset_ids)]
    grouped: dict[str, list[float]] = {}
    for row in rows:
        grouped.setdefault(row["measurement_type"], []).append(row["value"])
    return {
        "reading_count": len(rows),
        "claim_count": len(claims),
        "queued_decision_count": sum(1 for row in decisions if row["queued"]),
        "measurements": {key: summarize(values) for key, values in grouped.items()},
    }


def _capabilities(conn, organization_id: str, asset_ids: list[str]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in read.measurement_types(conn, organization_id, asset_ids):
        grouped.setdefault(row["asset_id"], []).append(
            {
                "measurement_type": row["measurement_type"],
                "unit": row["unit"],
                "reading_count": int(row["reading_count"]),
            }
        )
    return grouped


def _asset_summary(row: dict, capabilities: list[dict]) -> dict:
    return {
        "asset_id": row["asset_id"],
        "asset_name": row["asset_name"],
        "asset_type": row["asset_type"],
        "location_id": row["location_id"],
        "criticality": row["criticality"],
        "subsystem": None,
        "measurement_types": capabilities,
    }


def _observation(row: dict) -> dict:
    return {
        "reading_id": row["reading_id"],
        "timestamp": _iso(row["timestamp"]),
        "measurement_type": row["measurement_type"],
        "value": row["value"],
        "unit": row["unit"],
        "quality": row["quality"],
        "action_id": row["action_id"],
        "mission_id": row["mission_id"],
        "location_id": row["location_id"],
    }


def _related(kind: str, origin: dict, candidate: dict, origin_location: dict | None, locations: dict[str, dict]) -> bool:
    if kind == "same_location":
        return candidate["location_id"] == origin["location_id"]
    if kind == "same_asset_type":
        return candidate["asset_type"] == origin["asset_type"]
    candidate_location = locations.get(candidate["location_id"])
    if origin_location is None or candidate_location is None:
        return False
    if kind == "same_zone":
        return candidate_location["zone_type"] == origin_location["zone_type"]
    return candidate_location["environment"] == origin_location["environment"]


def _relationship_source(kind: str) -> str:
    return {
        "same_location": "assets.location_id",
        "same_asset_type": "assets.asset_type",
        "same_zone": "locations.zone_type",
        "same_environment": "locations.environment",
    }[kind]


def _facility(conn, organization_id: str, facility_id: str | None) -> str | None:
    if facility_id is None:
        return None
    if read.facility(conn, organization_id, facility_id) is None:
        return "missing"
    return FACILITY_WARNING


def _window(start: datetime | None, end: datetime | None) -> tuple[datetime | None, datetime | None, str | None]:
    if start is None and end is None:
        return None, None, None
    if start is None or end is None:
        return None, None, "Provide both start_time and end_time."
    start = utc(start)
    end = utc(end)
    if end <= start:
        return None, None, "end_time must be after start_time."
    return start, end, None


def _cursor(value: str | None) -> tuple[datetime | None, str | None, str | None]:
    if not value:
        return None, None, None
    stamp, separator, reading_id = value.partition("|")
    if not separator or not reading_id:
        return None, None, "The cursor is not valid."
    try:
        parsed = datetime.fromisoformat(stamp)
    except ValueError:
        return None, None, "The cursor is not valid."
    return utc(parsed), reading_id, None


def _unit_warnings(rows: list[dict]) -> list[str]:
    units: dict[str, set[str]] = {}
    for row in rows:
        units.setdefault(row["measurement_type"], set()).add(row["unit"])
    mixed = [measurement for measurement, values in units.items() if len(values) > 1]
    if not mixed:
        return []
    return ["These measurements have more than one unit and were not combined: " + ", ".join(mixed) + "."]


def _asset_ids(rows: list[dict]) -> list[str]:
    return list({row["asset_id"] for row in rows if row.get("asset_id")})


def _reading_ref(row: dict) -> EvidenceRef:
    return _ref("reading", row["reading_id"], row.get("asset_id"), row.get("timestamp"), row.get("source"), "sentinel.readings")


def _ref(kind: str, item_id: str, asset_id: str | None, timestamp, source: str | None, table: str) -> EvidenceRef:
    return EvidenceRef(type=kind, id=item_id, asset_id=asset_id, timestamp=timestamp, source=source, table=table)


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return utc(value).isoformat()
    return str(value)


def _insufficient(tool: str, request_id: str, reason: str, warnings: list[str] | None = None) -> ToolEnvelope:
    return envelope(tool, request_id, "insufficient_data", {"reason": reason}, warnings=[reason, *(warnings or [])], record_count=0)
