from enum import Enum

from pydantic import BaseModel, Field


class Verdict(str, Enum):
    inspection_failure = "inspection_failure"
    equipment_finding = "equipment_finding"
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
    evidence: dict[str, str | float | bool | None] = Field(default_factory=dict)
