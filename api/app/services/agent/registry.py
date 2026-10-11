"""Tool manifest a Databricks agent can import.

The schemas come from the same Pydantic models the routes validate.
"""
from app.dtos.agent import (
    AnomaliesRequest,
    AssetDetailsRequest,
    AssetHistoryRequest,
    ComparePeriodsRequest,
    CompareTrendsRequest,
    CorrelationRequest,
    EvidenceRequest,
    FacilitySummaryRequest,
    HypothesisRequest,
    InspectionQueueRequest,
    RelatedAssetsRequest,
    RuleEvaluationsRequest,
    SearchAssetsRequest,
    TemporalOverlapRequest,
    ToolEnvelope,
)

TIMEOUT_SECONDS = 8
READ_ONLY = True


def manifest() -> dict:
    return {
        "version": "agent-tools-v1",
        "authentication": "Bearer session token. The organization is taken from that user. Tool arguments cannot select an organization.",
        "tools": [_tool(*item) for item in TOOLS],
    }


def _tool(name: str, path: str, description: str, model, limit: int) -> dict:
    return {
        "name": name,
        "description": description,
        "path": path,
        "method": "POST",
        "input_schema": model.model_json_schema(),
        "output_schema": ToolEnvelope.model_json_schema(),
        "permissions": ["organization:read"],
        "timeout_seconds": TIMEOUT_SECONDS,
        "maximum_result_size": limit,
        "read_only": READ_ONLY,
    }


TOOLS = [
    ("search_assets", "/internal/agent/tools/search-assets", "Resolve an equipment name, type, or location to asset ids in the signed-in organization.", SearchAssetsRequest, 100),
    ("get_asset_details", "/internal/agent/tools/get-asset-details", "Return one asset's type, location, measurement types, and observation range.", AssetDetailsRequest, 1),
    ("get_asset_history", "/internal/agent/tools/get-asset-history", "Return timestamped readings for one asset. Units are kept as stored.", AssetHistoryRequest, 500),
    ("get_inspection_queue", "/internal/agent/tools/get-inspection-queue", "Return the stored operator queue. This does not rescore it.", InspectionQueueRequest, 100),
    ("get_anomalies", "/internal/agent/tools/get-anomalies", "Return Spot labels and queued rule verdicts. Labels, asset-fence findings, and sanity ceilings stay distinct.", AnomaliesRequest, 200),
    ("get_rule_evaluations", "/internal/agent/tools/get-rule-evaluations", "Return the stored rule firings for one action.", RuleEvaluationsRequest, 50),
    ("get_facility_summary", "/internal/agent/tools/get-facility-summary", "Summarize the signed-in organization's assets, queue, and claims for a facility the organization owns.", FacilitySummaryRequest, 50),
    ("get_evidence", "/internal/agent/tools/get-evidence", "Load records cited by an earlier tool, limited to this organization.", EvidenceRequest, 50),
    ("get_related_assets", "/internal/agent/tools/get-related-assets", "Find assets that share a stored location, type, zone, or environment. No physical link is invented.", RelatedAssetsRequest, 100),
    ("compare_asset_trends", "/internal/agent/tools/compare-asset-trends", "Summarize one measurement across assets. Different units or equipment types are not combined.", CompareTrendsRequest, 5000),
    ("analyze_temporal_overlap", "/internal/agent/tools/analyze-temporal-overlap", "Find anomaly labels within a time window. Overlap is not causation.", TemporalOverlapRequest, 200),
    ("compute_measurement_correlation", "/internal/agent/tools/compute-measurement-correlation", "Compute Pearson or Spearman correlation on bucket means. Missing buckets are not interpolated.", CorrelationRequest, 5000),
    ("compare_time_periods", "/internal/agent/tools/compare-time-periods", "Compare reading and anomaly counts between two time windows.", ComparePeriodsRequest, 5000),
    ("investigate_hypothesis", "/internal/agent/tools/investigate-hypothesis", "Evaluate one named hypothesis with the deterministic tools. The result is supported, not_supported, or inconclusive.", HypothesisRequest, 5000),
]
