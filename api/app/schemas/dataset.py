"""Response shapes for GET /dataset.

Field for field these match packages/core/src/types.ts, so the frontend
can swap its bundled fixture for the API without changing any screen.
"""
from pydantic import BaseModel, Field


class MissionOut(BaseModel):
    mission_id: str
    mission_name: str
    scenario: str
    configuration_version: str
    start_time: str
    end_time: str
    duration_min: float
    start_battery_pct: float
    end_battery_pct: float
    mission_status: str


class ActionOut(BaseModel):
    action_id: str
    mission_id: str
    sequence: int
    timestamp: str
    location_id: str
    asset_id: str
    action_type: str
    battery_pct: float
    status: str
    failure_type: str
    duration_sec: float
    scenario: str


class FindingOut(BaseModel):
    anomaly_id: str
    action_id: str
    mission_id: str
    location_id: str
    asset_id: str
    timestamp: str
    anomaly_type: str
    severity: str
    operator_review_required: bool
    description: str


class AssetOut(BaseModel):
    asset_id: str
    asset_name: str
    asset_type: str
    location_id: str
    criticality: str


class WaypointOut(BaseModel):
    location_id: str
    location_name: str
    floor: int
    environment: str
    x_coord: float
    y_coord: float


class ReadingOut(BaseModel):
    reading_id: str
    action_id: str
    measurement_type: str
    value: float
    unit: str
    quality: str


class ReplayEventOut(BaseModel):
    event_id: str
    mission_id: str
    timestamp: str
    event_type: str
    details: dict[str, str | float | int | bool | None] = Field(default_factory=dict)


class InspectionDataset(BaseModel):
    missions: list[MissionOut] = Field(default_factory=list)
    actions: list[ActionOut] = Field(default_factory=list)
    findings: list[FindingOut] = Field(default_factory=list)
    assets: list[AssetOut] = Field(default_factory=list)
    locations: list[WaypointOut] = Field(default_factory=list)
    readings: list[ReadingOut] = Field(default_factory=list)
    events: list[ReplayEventOut] = Field(default_factory=list)
