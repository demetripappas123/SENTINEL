"""LangChain tools for the Sentinel inspection API.

Each tool posts to one Railway route. The signed-in session is taken from the
request that started the turn, not from the model.
"""
import asyncio
import json
import os
import urllib.error
import urllib.request

from langchain_core.tools import tool

from agent.sentinel_session import authorization


def _omit(body: dict) -> dict:
    return {key: value for key, value in body.items() if value is not None}


def _post_sync(path: str, body: dict, header: str) -> str:
    origin = os.environ.get("SENTINEL_API_URL", "http://127.0.0.1:8000").rstrip("/")
    request = urllib.request.Request(
        origin + path,
        data=json.dumps(_omit(body)).encode(),
        headers={"Authorization": header, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.read().decode()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        return json.dumps({"status": "insufficient_data", "http_status": exc.code, "detail": detail[:2000]})
    except urllib.error.URLError:
        return json.dumps({"status": "insufficient_data", "detail": "The inspection API is unavailable."})


async def _call(path: str, body: dict) -> str:
    header = authorization()
    if not header:
        return json.dumps(
            {"status": "insufficient_data", "detail": "The signed-in session was not forwarded."}
        )
    if not header.lower().startswith("bearer "):
        header = "Bearer " + header
    return await asyncio.to_thread(_post_sync, path, body, header)


@tool
async def search_assets(
    query: str | None = None,
    facility_id: str | None = None,
    asset_type: str | None = None,
    limit: int = 20,
) -> str:
    """Resolve an equipment name, type, or location to asset ids in the signed-in organization."""
    return await _call(
        "/internal/agent/tools/search-assets",
        {"query": query, "facility_id": facility_id, "asset_type": asset_type, "limit": limit},
    )


@tool
async def get_asset_details(asset_id: str) -> str:
    """Return one asset's type, location, measurement types, and observation range."""
    return await _call("/internal/agent/tools/get-asset-details", {"asset_id": asset_id})


@tool
async def get_asset_history(
    asset_id: str,
    start_time: str | None = None,
    end_time: str | None = None,
    measurement_types: list[str] | None = None,
    limit: int = 100,
    cursor: str | None = None,
) -> str:
    """Return timestamped readings for one asset. Units stay as stored. Times are ISO-8601."""
    return await _call(
        "/internal/agent/tools/get-asset-history",
        {
            "asset_id": asset_id,
            "start_time": start_time,
            "end_time": end_time,
            "measurement_types": measurement_types,
            "limit": limit,
            "cursor": cursor,
        },
    )


@tool
async def get_inspection_queue(
    facility_id: str | None = None,
    status: str | None = None,
    severity: str | None = None,
    limit: int = 20,
) -> str:
    """Return the stored operator queue, highest rank first. Use this for what needs attention. Status, when set, must be a verdict name: inspection_failure, equipment_finding, potential_anomaly, or unsupported_claim. This does not rescore the queue."""
    return await _call(
        "/internal/agent/tools/get-inspection-queue",
        {"facility_id": facility_id, "status": status, "severity": severity, "limit": limit},
    )


@tool
async def get_anomalies(
    asset_id: str | None = None,
    facility_id: str | None = None,
    severity: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    limit: int = 50,
) -> str:
    """Return every stored Spot label, including unbacked claims. When both start_time and end_time are set, also return queued equipment findings, potential anomalies, and unsupported claims. Failed inspections are not included. A Spot label is not confirmed by a failed check. There is no machine-learning score."""
    return await _call(
        "/internal/agent/tools/get-anomalies",
        {
            "asset_id": asset_id,
            "facility_id": facility_id,
            "severity": severity,
            "start_time": start_time,
            "end_time": end_time,
            "limit": limit,
        },
    )


@tool
async def get_rule_evaluations(inspection_id: str | None = None, event_id: str | None = None) -> str:
    """Return the stored rule firings for one action. inspection_id is the action id. inspection_failure means the check failed or a reading was questionable. It is not an anomaly and does not confirm a Spot label. equipment_finding is a confirmed out-of-range reading. potential_anomaly is above the equipment limit and not confirmed. unsupported_claim is an unbacked Spot label."""
    return await _call(
        "/internal/agent/tools/get-rule-evaluations",
        {"inspection_id": inspection_id, "event_id": event_id},
    )


@tool
async def get_facility_summary(
    facility_id: str,
    start_time: str | None = None,
    end_time: str | None = None,
) -> str:
    """Summarize assets, the queue, and claims for a facility the signed-in organization owns."""
    return await _call(
        "/internal/agent/tools/get-facility-summary",
        {"facility_id": facility_id, "start_time": start_time, "end_time": end_time},
    )


@tool
async def get_evidence(evidence_type: str, evidence_ids: list[str]) -> str:
    """Load records cited by an earlier tool. evidence_type is asset, action, reading, anomaly_claim, queue_item, or rule_decision."""
    return await _call(
        "/internal/agent/tools/get-evidence",
        {"evidence_type": evidence_type, "evidence_ids": evidence_ids},
    )


@tool
async def get_related_assets(
    asset_id: str,
    relationship_types: list[str] | None = None,
    limit: int = 20,
) -> str:
    """Find assets that share a stored location, type, zone, or environment. No physical link is invented."""
    return await _call(
        "/internal/agent/tools/get-related-assets",
        {"asset_id": asset_id, "relationship_types": relationship_types, "limit": limit},
    )


@tool
async def compare_asset_trends(
    asset_ids: list[str],
    measurement_type: str,
    start_time: str,
    end_time: str,
    aggregation_interval: str,
    normalization_method: str | None = None,
) -> str:
    """Summarize one measurement across assets. Different units or equipment types are not combined. Interval is hour or day."""
    return await _call(
        "/internal/agent/tools/compare-asset-trends",
        {
            "asset_ids": asset_ids,
            "measurement_type": measurement_type,
            "start_time": start_time,
            "end_time": end_time,
            "aggregation_interval": aggregation_interval,
            "normalization_method": normalization_method,
        },
    )


@tool
async def analyze_temporal_overlap(
    asset_ids: list[str],
    start_time: str,
    end_time: str,
    window_minutes: int,
    anomaly_types: list[str] | None = None,
) -> str:
    """Find anomaly labels within a time window. Overlap is not causation."""
    return await _call(
        "/internal/agent/tools/analyze-temporal-overlap",
        {
            "asset_ids": asset_ids,
            "start_time": start_time,
            "end_time": end_time,
            "window_minutes": window_minutes,
            "anomaly_types": anomaly_types,
        },
    )


@tool
async def compute_measurement_correlation(
    asset_ids: list[str],
    measurement_type: str,
    start_time: str,
    end_time: str,
    alignment_interval: str,
    method: str = "pearson",
) -> str:
    """Compute Pearson or Spearman correlation on bucket means for exactly two assets. Missing buckets are not interpolated."""
    return await _call(
        "/internal/agent/tools/compute-measurement-correlation",
        {
            "asset_ids": asset_ids,
            "measurement_type": measurement_type,
            "start_time": start_time,
            "end_time": end_time,
            "alignment_interval": alignment_interval,
            "method": method,
        },
    )


@tool
async def compare_time_periods(
    baseline_start: str,
    baseline_end: str,
    comparison_start: str,
    comparison_end: str,
    asset_id: str | None = None,
    facility_id: str | None = None,
    measurement_types: list[str] | None = None,
) -> str:
    """Compare reading and anomaly counts between two time windows for one asset or one facility."""
    return await _call(
        "/internal/agent/tools/compare-time-periods",
        {
            "asset_id": asset_id,
            "facility_id": facility_id,
            "baseline_start": baseline_start,
            "baseline_end": baseline_end,
            "comparison_start": comparison_start,
            "comparison_end": comparison_end,
            "measurement_types": measurement_types,
        },
    )


@tool
async def investigate_hypothesis(
    hypothesis_type: str,
    asset_ids: list[str],
    start_time: str,
    end_time: str,
    parameters: dict | None = None,
) -> str:
    """Evaluate one named hypothesis. hypothesis_type is shared_anomaly_window, common_subsystem, correlated_measurement_change, or increased_anomaly_frequency. The result is supported, not_supported, or inconclusive."""
    return await _call(
        "/internal/agent/tools/investigate-hypothesis",
        {
            "hypothesis_type": hypothesis_type,
            "asset_ids": asset_ids,
            "start_time": start_time,
            "end_time": end_time,
            "parameters": parameters,
        },
    )
