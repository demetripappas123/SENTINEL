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
    rank: int = 0
    evidence: dict[str, str | float | int | bool | None] = Field(default_factory=dict)


class QueueUpdate(BaseModel):
    upsert: list[QueueItem] = Field(default_factory=list)
    remove_ids: list[str] = Field(default_factory=list)
