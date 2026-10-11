"""A queue row and the decision that justified it.

Verdict and rank are set together. An action that stays off the queue still
gets a decision, with both of those empty.
"""
from enum import Enum

from pydantic import BaseModel, Field


class Verdict(str, Enum):
    inspection_failure = "inspection_failure"
    equipment_finding = "equipment_finding"
    potential_anomaly = "potential_anomaly"
    unsupported_claim = "unsupported_claim"


class QueueItem(BaseModel):
    id: str
    verdict: Verdict
    cause: str
    explanation: str
    mission_id: str
    action_id: str | None = None
    asset_id: str | None = None
    location_id: str | None = None
    rank: int = 0
    evidence: dict[str, str | float | int | bool | None] = Field(default_factory=dict)


class RuleFiring(BaseModel):
    rule_id: str
    matched: bool
    observed_value: str | None = None
    threshold: str | None = None
    rank_delta: int = 0


class RuleDecision(BaseModel):
    source: str
    action_id: str
    rule_set_version: str
    queued: bool
    verdict: Verdict | None = None
    rank: int | None = None
    firings: list[RuleFiring] = Field(default_factory=list)


class QueueUpdate(BaseModel):
    upsert: list[QueueItem] = Field(default_factory=list)
    remove_ids: list[str] = Field(default_factory=list)
    decisions: list[RuleDecision] = Field(default_factory=list)
