export type Configuration = "ALL" | "BASELINE" | "IMPROVED";
export type FindingStatus = "required" | "all" | "reviewed";

export interface Mission {
  mission_id: string;
  mission_name: string;
  scenario: string | null;
  configuration_version: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_min: number | null;
  start_battery_pct: number | null;
  end_battery_pct: number | null;
  mission_status: string;
}
export interface Action {
  action_id: string;
  mission_id: string;
  sequence: number | null;
  timestamp: string | null;
  location_id: string | null;
  asset_id: string | null;
  action_type: string;
  battery_pct: number | null;
  status: string;
  failure_type: string;
  duration_sec: number | null;
  scenario: string | null;
}
export interface Finding {
  anomaly_id: string;
  action_id: string;
  mission_id: string;
  location_id: string | null;
  asset_id: string | null;
  timestamp: string | null;
  anomaly_type: string;
  severity: string;
  operator_review_required: boolean;
  description: string;
}
export interface Asset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  location_id: string;
  criticality: string;
}
export interface Waypoint {
  location_id: string;
  location_name: string;
  floor: number;
  environment: string;
  x_coord: number;
  y_coord: number;
}
export interface Reading {
  reading_id: string;
  action_id: string;
  measurement_type: string;
  value: number;
  unit: string;
  quality: string;
}
export interface ReplayEvent {
  event_id: string;
  mission_id: string;
  timestamp: string;
  event_type: string;
  details: Record<string, string | number | boolean | null | undefined>;
}
export interface InspectionDataset {
  missions: Mission[];
  actions: Action[];
  findings: Finding[];
  assets: Asset[];
  locations: Waypoint[];
  readings: Reading[];
  events: ReplayEvent[];
}
export interface Metrics {
  missionCount: number;
  completedCount: number;
  actionCount: number;
  successfulActionCount: number;
  completionRate: number;
  actionSuccessRate: number;
  completedWithFailures: number;
}
export interface FindingFilter {
  configuration?: Configuration;
  status?: FindingStatus;
  query?: string;
  reviewedIds?: readonly string[];
  missionId?: string;
}
