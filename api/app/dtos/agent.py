"""Inputs and outputs for the read-only agent tools.

The signed-in user supplies the organization. A tool body cannot name one.
"""
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


def _forbid():
    return ConfigDict(extra="forbid")


class EvidenceRef(BaseModel):
    type: str
    id: str
    asset_id: str | None = None
    timestamp: datetime | None = None
    source: str | None = None
    table: str


class ToolMetadata(BaseModel):
    generated_at: datetime
    record_count: int
    truncated: bool = False
    next_cursor: str | None = None


class ToolEnvelope(BaseModel):
    tool: str
    request_id: str
    status: Literal["success", "insufficient_data"]
    data: dict[str, Any]
    evidence: list[EvidenceRef] = Field(default_factory=list)
    metadata: ToolMetadata
    warnings: list[str] = Field(default_factory=list)


class SearchAssetsRequest(BaseModel):
    model_config = _forbid()
    query: str | None = None
    facility_id: str | None = None
    asset_type: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class AssetDetailsRequest(BaseModel):
    model_config = _forbid()
    asset_id: str = Field(min_length=1)


class AssetHistoryRequest(BaseModel):
    model_config = _forbid()
    asset_id: str = Field(min_length=1)
    start_time: datetime | None = None
    end_time: datetime | None = None
    measurement_types: list[str] | None = None
    limit: int = Field(default=100, ge=1, le=500)
    cursor: str | None = None


class InspectionQueueRequest(BaseModel):
    model_config = _forbid()
    facility_id: str | None = None
    status: str | None = None
    severity: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class AnomaliesRequest(BaseModel):
    model_config = _forbid()
    asset_id: str | None = None
    facility_id: str | None = None
    severity: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    limit: int = Field(default=50, ge=1, le=200)


class RuleEvaluationsRequest(BaseModel):
    model_config = _forbid()
    inspection_id: str | None = None
    event_id: str | None = None


class FacilitySummaryRequest(BaseModel):
    model_config = _forbid()
    facility_id: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None


class EvidenceRequest(BaseModel):
    model_config = _forbid()
    evidence_type: Literal["asset", "action", "reading", "anomaly_claim", "queue_item", "rule_decision"]
    evidence_ids: list[str] = Field(min_length=1, max_length=50)


class RelatedAssetsRequest(BaseModel):
    model_config = _forbid()
    asset_id: str = Field(min_length=1)
    relationship_types: list[str] | None = None
    limit: int = Field(default=20, ge=1, le=100)


class CompareTrendsRequest(BaseModel):
    model_config = _forbid()
    asset_ids: list[str] = Field(min_length=2, max_length=10)
    measurement_type: str = Field(min_length=1)
    start_time: datetime
    end_time: datetime
    aggregation_interval: Literal["hour", "day"]
    normalization_method: Literal["none"] | None = None


class TemporalOverlapRequest(BaseModel):
    model_config = _forbid()
    asset_ids: list[str] = Field(min_length=2, max_length=20)
    start_time: datetime
    end_time: datetime
    window_minutes: int = Field(ge=1, le=1440)
    anomaly_types: list[str] | None = None


class CorrelationRequest(BaseModel):
    model_config = _forbid()
    asset_ids: list[str] = Field(min_length=2, max_length=2)
    measurement_type: str = Field(min_length=1)
    start_time: datetime
    end_time: datetime
    alignment_interval: Literal["minute", "hour", "day"]
    method: Literal["pearson", "spearman"] = "pearson"


class ComparePeriodsRequest(BaseModel):
    model_config = _forbid()
    asset_id: str | None = None
    facility_id: str | None = None
    baseline_start: datetime
    baseline_end: datetime
    comparison_start: datetime
    comparison_end: datetime
    measurement_types: list[str] | None = None


class ChatRequest(BaseModel):
    model_config = _forbid()
    message: str = Field(min_length=1, max_length=4000)
    session_id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,128}$")


class ChatReply(BaseModel):
    session_id: str
    reply: str


class HypothesisRequest(BaseModel):
    model_config = _forbid()
    hypothesis_type: Literal[
        "shared_anomaly_window",
        "common_subsystem",
        "correlated_measurement_change",
        "increased_anomaly_frequency",
    ]
    asset_ids: list[str] = Field(min_length=1, max_length=20)
    start_time: datetime
    end_time: datetime
    parameters: dict[str, Any] = Field(default_factory=dict)


def envelope(
    tool: str,
    request_id: str,
    status: Literal["success", "insufficient_data"],
    data: dict[str, Any],
    evidence: list[EvidenceRef] | None = None,
    warnings: list[str] | None = None,
    record_count: int = 0,
    truncated: bool = False,
    next_cursor: str | None = None,
) -> ToolEnvelope:
    return ToolEnvelope(
        tool=tool,
        request_id=request_id,
        status=status,
        data=data,
        evidence=evidence or [],
        metadata=ToolMetadata(
            generated_at=datetime.now(timezone.utc),
            record_count=record_count,
            truncated=truncated,
            next_cursor=next_cursor,
        ),
        warnings=warnings or [],
    )
