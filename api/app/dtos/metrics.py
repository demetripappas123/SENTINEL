"""The counts returned by GET /metrics."""
from pydantic import BaseModel, Field


class VersionMetric(BaseModel):
    source: str
    configuration_version: str | None = None
    mission_count: int
    completed_missions: int
    mission_completion_pct: float | None = None
    action_count: int
    successful_actions: int
    action_success_pct: float | None = None
    avg_duration_min: float | None = None
    avg_start_battery_pct: float | None = None
    avg_end_battery_pct: float | None = None


class InspectionMetric(BaseModel):
    source: str
    action_type: str
    configuration_version: str | None = None
    action_count: int
    successful_actions: int
    success_pct: float | None = None


class LocationMetric(BaseModel):
    source: str
    location_id: str
    location_name: str
    action_count: int
    successful_actions: int
    success_pct: float | None = None
    navigation_count: int
    navigation_failures: int
    navigation_failure_pct: float | None = None


class BatteryMetric(BaseModel):
    low_pct: int
    high_pct: int
    action_count: int
    successful_actions: int
    success_pct: float | None = None


class MissionMetric(BaseModel):
    mission_count: int
    completed_count: int
    completed_with_failures: int
    failed_mission_ids: list[str] = Field(default_factory=list)


class OperationalMetrics(BaseModel):
    versions: list[VersionMetric]
    inspections: list[InspectionMetric]
    locations: list[LocationMetric]
    battery: list[BatteryMetric]
    missions: MissionMetric
