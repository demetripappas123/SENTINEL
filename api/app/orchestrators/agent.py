"""Read-only agent tools.

The caller is a signed-in user. The organization on that user is the only
tenant scope. A tool argument cannot name a different organization.
"""
import logging
import os
import secrets
import time

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth.deps import require_user
from app.auth.store import UserAccount
from app.db import connect
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
    ChatReply,
    ChatRequest,
)
from app.services.agent import tools
from app.services.agent.chat import AgentFailed, AgentUnavailable, ask, operator_context
from app.services.agent.registry import manifest

logger = logging.getLogger("sentinel.agent")
router = APIRouter(tags=["agent"])
_calls: dict[str, list[float]] = {}


@router.get("/internal/agent/tools")
def read_manifest(user: UserAccount = Depends(require_user)) -> dict:
    _limit(user.id)
    return manifest()


@router.post("/internal/agent/tools/search-assets", response_model=ToolEnvelope)
def search_assets(body: SearchAssetsRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("search_assets", tools.search_assets, body, user)


@router.post("/internal/agent/tools/get-asset-details", response_model=ToolEnvelope)
def asset_details(body: AssetDetailsRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("get_asset_details", tools.get_asset_details, body, user)


@router.post("/internal/agent/tools/get-asset-history", response_model=ToolEnvelope)
def asset_history(body: AssetHistoryRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("get_asset_history", tools.get_asset_history, body, user)


@router.post("/internal/agent/tools/get-inspection-queue", response_model=ToolEnvelope)
def inspection_queue(body: InspectionQueueRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("get_inspection_queue", tools.get_inspection_queue, body, user)


@router.post("/internal/agent/tools/get-anomalies", response_model=ToolEnvelope)
def anomalies(body: AnomaliesRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("get_anomalies", tools.get_anomalies, body, user)


@router.post("/internal/agent/tools/get-rule-evaluations", response_model=ToolEnvelope)
def rule_evaluations(body: RuleEvaluationsRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("get_rule_evaluations", tools.get_rule_evaluations, body, user)


@router.post("/internal/agent/tools/get-facility-summary", response_model=ToolEnvelope)
def facility_summary(body: FacilitySummaryRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("get_facility_summary", tools.get_facility_summary, body, user)


@router.post("/internal/agent/tools/get-evidence", response_model=ToolEnvelope)
def evidence(body: EvidenceRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("get_evidence", tools.get_evidence, body, user)


@router.post("/internal/agent/tools/get-related-assets", response_model=ToolEnvelope)
def related_assets(body: RelatedAssetsRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("get_related_assets", tools.get_related_assets, body, user)


@router.post("/internal/agent/tools/compare-asset-trends", response_model=ToolEnvelope)
def compare_trends(body: CompareTrendsRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("compare_asset_trends", tools.compare_asset_trends, body, user)


@router.post("/internal/agent/tools/analyze-temporal-overlap", response_model=ToolEnvelope)
def temporal_overlap(body: TemporalOverlapRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("analyze_temporal_overlap", tools.analyze_temporal_overlap, body, user)


@router.post("/internal/agent/tools/compute-measurement-correlation", response_model=ToolEnvelope)
def correlation(body: CorrelationRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("compute_measurement_correlation", tools.compute_measurement_correlation, body, user)


@router.post("/internal/agent/tools/compare-time-periods", response_model=ToolEnvelope)
def compare_periods(body: ComparePeriodsRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("compare_time_periods", tools.compare_time_periods, body, user)


@router.post("/internal/agent/tools/investigate-hypothesis", response_model=ToolEnvelope)
def hypothesis(body: HypothesisRequest, user: UserAccount = Depends(require_user)) -> ToolEnvelope:
    return _run("investigate_hypothesis", tools.investigate_hypothesis, body, user)


def _run(name: str, handler, body, user: UserAccount) -> ToolEnvelope:
    _limit(user.id)
    request_id = "req_" + secrets.token_hex(8)
    started = time.perf_counter()
    status = "error"
    try:
        with connect() as conn:
            _readonly(conn)
            result = handler(conn, user.organization_id, request_id, body)
            status = result.status
            return result
    except (psycopg.Error, RuntimeError) as exc:
        logger.info(
            "agent_tool tool=%s user=%s organization=%s request=%s status=unavailable latency_ms=%s",
            name,
            user.id,
            user.organization_id,
            request_id,
            int((time.perf_counter() - started) * 1000),
        )
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    finally:
        if status != "error":
            logger.info(
                "agent_tool tool=%s user=%s organization=%s request=%s status=%s latency_ms=%s",
                name,
                user.id,
                user.organization_id,
                request_id,
                status,
                int((time.perf_counter() - started) * 1000),
            )


@router.post("/api/agent/chat", response_model=ChatReply)
def chat(
    body: ChatRequest,
    user: UserAccount = Depends(require_user),
    authorization: str | None = Header(default=None),
) -> ChatReply:
    """Forward the operator's message to the LangGraph app for this session."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in required")
    started = time.perf_counter()
    try:
        reply = ask(body.message, body.session_id, user.id, authorization, operator_context(user))
    except AgentUnavailable as exc:
        raise HTTPException(status_code=503, detail="The inspection assistant is not running.") from exc
    except AgentFailed as exc:
        raise HTTPException(status_code=502, detail=exc.detail) from exc
    logger.info(
        "agent_chat user=%s organization=%s session=%s latency_ms=%s",
        user.id,
        user.organization_id,
        body.session_id,
        int((time.perf_counter() - started) * 1000),
    )
    return ChatReply(session_id=body.session_id, reply=reply)


def _readonly(conn) -> None:
    timeout = int(os.environ.get("SENTINEL_AGENT_STATEMENT_TIMEOUT_MS", "5000"))
    if timeout < 100 or timeout > 30000:
        timeout = 5000
    conn.execute(f"SET statement_timeout = {timeout}")
    conn.execute("SET default_transaction_read_only = on")


def _limit(user_id: str) -> None:
    allowed = int(os.environ.get("SENTINEL_AGENT_RATE_LIMIT", "60"))
    now = time.monotonic()
    recent = [stamp for stamp in _calls.get(user_id, []) if now - stamp < 60]
    if len(recent) >= allowed:
        raise HTTPException(status_code=429, detail="Agent tool rate limit exceeded")
    recent.append(now)
    _calls[user_id] = recent
