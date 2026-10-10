import challenge from "./data/challenge.json";
import type {
  Configuration,
  Finding,
  FindingFilter,
  InspectionDataset,
  Metrics,
} from "./types";

export * from "./types";
export * from "./theme";
export * from "./repository";
export * from "./inspection-selectors";
export * from "./queue";
export * from "./presentation";
export const dataset: InspectionDataset = challenge;
export const emptyDataset: InspectionDataset = {
  missions: [],
  actions: [],
  findings: [],
  assets: [],
  locations: [],
  readings: [],
  events: [],
};

export function getMetrics(
  data: InspectionDataset,
  configuration: Configuration,
): Metrics {
  const missions = data.missions.filter(
    (m) => configuration === "ALL" || m.scenario === configuration,
  );
  const ids = new Set(missions.map((m) => m.mission_id));
  const actions = data.actions.filter((a) => ids.has(a.mission_id));
  const completed = missions.filter((m) => m.mission_status === "COMPLETED");
  const successful = actions.filter((a) => a.status === "SUCCESS");
  const failedMissionIds = new Set(
    actions.filter((a) => a.status === "FAILED").map((a) => a.mission_id),
  );
  const rate = (count: number, total: number) =>
    total ? Math.round((count / total) * 1000) / 10 : 0;
  return {
    missionCount: missions.length,
    completedCount: completed.length,
    actionCount: actions.length,
    successfulActionCount: successful.length,
    completionRate: rate(completed.length, missions.length),
    actionSuccessRate: rate(successful.length, actions.length),
    completedWithFailures: completed.filter((m) =>
      failedMissionIds.has(m.mission_id),
    ).length,
  };
}
export function getFindings(
  data: InspectionDataset,
  filter: FindingFilter = {},
): Finding[] {
  const {
    configuration = "ALL",
    status = "required",
    reviewedIds = [],
    missionId,
  } = filter;
  const query = (filter.query || "").trim().toLowerCase();
  const reviewed = new Set(reviewedIds);
  const missionIds = new Set(
    data.missions
      .filter((m) => configuration === "ALL" || m.scenario === configuration)
      .map((m) => m.mission_id),
  );
  const assets = new Map(data.assets.map((a) => [a.asset_id, a.asset_name]));
  const locations = new Map(
    data.locations.map((l) => [l.location_id, l.location_name]),
  );
  const rank: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  return data.findings
    .filter(
      (f) =>
        missionIds.has(f.mission_id) &&
        (!missionId || f.mission_id === missionId) &&
        (status !== "required" ||
          (f.operator_review_required && !reviewed.has(f.anomaly_id))) &&
        (status !== "reviewed" || reviewed.has(f.anomaly_id)) &&
        (!query ||
          [
            f.anomaly_id,
            f.anomaly_type,
            f.asset_id,
            f.location_id,
            f.mission_id,
            f.asset_id ? assets.get(f.asset_id) : "",
            f.location_id ? locations.get(f.location_id) : "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    )
    .sort(
      (a, b) =>
        (rank[b.severity] || 0) - (rank[a.severity] || 0) ||
        (b.timestamp ?? "").localeCompare(a.timestamp ?? ""),
    );
}

export function missionLabel(mission: {
  mission_status: string;
  start_time: string | null;
  end_time: string | null;
}): string {
  if (mission.end_time || mission.mission_status === "FAILED")
    return mission.mission_status;
  return mission.start_time ? "IN_PROGRESS" : "PENDING";
}
export const humanize = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
export const pending = (value: string | number | null | undefined) =>
  value == null || value === "" ? "Pending" : String(value);
export const shortTime = (value: string | null) =>
  value ? value.slice(5, 10) + " · " + value.slice(11, 16) : "Pending";
export const missionActions = (data: InspectionDataset, missionId: string) =>
  data.actions
    .filter((a) => a.mission_id === missionId)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
export const actionFindings = (data: InspectionDataset, actionId: string) =>
  getFindings(data, { status: "all" }).filter((finding) => finding.action_id === actionId);
export const assetName = (data: InspectionDataset, id: string | null) =>
  id ? data.assets.find((a) => a.asset_id === id)?.asset_name || id : "Pending";
export const locationName = (data: InspectionDataset, id: string | null) =>
  id
    ? data.locations.find((l) => l.location_id === id)?.location_name || id
    : "Pending";
export const sampleImage = (type: string) =>
  /TEMPERATURE|THERMAL/.test(type)
    ? "thermal_pump_bearing_01.jpg"
    : /GAUGE/.test(type)
      ? "gauge_pressure_01.jpg"
      : /ACOUSTIC|VIBRATION|SIGNAL/.test(type)
        ? "acoustic_valve_01.jpg"
        : /NAVIGATION|LOCALIZATION/.test(type)
          ? "pipe_gallery_01.jpg"
          : "visual_pump_motor_01.jpg";
