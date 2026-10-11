"""Records that match the sentinel tables: locations, assets, missions, actions, readings, claims."""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Source(str, Enum):
    kit = "kit"
    orbit = "orbit"
    spot = "spot"


class Mission(BaseModel):
    source: Source
    mission_id: str
    mission_name: str
    scenario: str | None = None
    configuration_version: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    duration_min: float | None = None
    start_battery_pct: float | None = None
    end_battery_pct: float | None = None
    mission_status: str
    operator_mode: str | None = None


class Action(BaseModel):
    source: Source
    action_id: str
    mission_id: str
    sequence: int | None = None
    timestamp: datetime | None = None
    location_id: str | None = None
    asset_id: str | None = None
    action_type: str
    battery_pct: float | None = None
    status: str
    failure_type: str | None = None
    duration_sec: float | None = None
    scenario: str | None = None
    configuration_version: str | None = None


class Reading(BaseModel):
    source: Source
    reading_id: str
    action_id: str
    mission_id: str
    asset_id: str | None = None
    location_id: str | None = None
    timestamp: datetime | None = None
    measurement_type: str
    value: float
    unit: str
    quality: str


class AnomalyClaim(BaseModel):
    source: Source
    anomaly_id: str
    action_id: str
    mission_id: str
    location_id: str | None = None
    asset_id: str | None = None
    timestamp: datetime | None = None
    anomaly_type: str
    severity: str
    operator_review_required: bool
    description: str


class Asset(BaseModel):
    source: Source
    asset_id: str
    asset_name: str
    asset_type: str
    location_id: str
    criticality: str


class Location(BaseModel):
    source: Source
    location_id: str
    location_name: str
    zone_type: str
    floor: int
    x_coord: float
    y_coord: float
    environment: str


class ReplayEvent(BaseModel):
    source: Source
    event_id: str
    mission_id: str
    timestamp: datetime | None = None
    event_type: str
    details: dict[str, str | float | int | bool | None] = Field(default_factory=dict)


class CanonicalBatch(BaseModel):
    missions: list[Mission] = Field(default_factory=list)
    actions: list[Action] = Field(default_factory=list)
    readings: list[Reading] = Field(default_factory=list)
    anomaly_claims: list[AnomalyClaim] = Field(default_factory=list)
    assets: list[Asset] = Field(default_factory=list)
    locations: list[Location] = Field(default_factory=list)
    events: list[ReplayEvent] = Field(default_factory=list)
