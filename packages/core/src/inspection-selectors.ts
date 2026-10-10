import type { InspectionDataset } from "./types";

export type DateRange = { start: string; end: string } | null;

export function validateDateRange(range: DateRange): void {
  if (!range) return;
  const isDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + "T00:00:00.000Z");
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  };
  if (!isDate(range.start) || !isDate(range.end) || range.start > range.end) {
    throw new RangeError(
      "Choose valid mission dates with the end on or after the start.",
    );
  }
}

export function scopeDataset(
  data: InspectionDataset,
  range: DateRange,
): InspectionDataset {
  validateDateRange(range);
  if (!range) return data;
  const missions = data.missions.filter((mission) => {
    const day = mission.start_time?.slice(0, 10) ?? "";
    return day >= range.start && day <= range.end;
  });
  const missionIds = new Set(missions.map((mission) => mission.mission_id));
  const actions = data.actions.filter((action) =>
    missionIds.has(action.mission_id),
  );
  const actionIds = new Set(actions.map((action) => action.action_id));
  return {
    ...data,
    missions,
    actions,
    readings: data.readings.filter((reading) =>
      actionIds.has(reading.action_id),
    ),
    findings: data.findings.filter((finding) =>
      missionIds.has(finding.mission_id),
    ),
    events: data.events.filter((event) => missionIds.has(event.mission_id)),
  };
}

export function selectMissionActions(
  data: InspectionDataset,
  missionId: string,
) {
  return data.actions
    .filter((action) => action.mission_id === missionId)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

export function selectActionFindings(
  data: InspectionDataset,
  actionId: string,
) {
  return data.findings.filter((finding) => finding.action_id === actionId);
}

export function selectActionReadings(
  data: InspectionDataset,
  actionId: string,
) {
  return data.readings.filter((reading) => reading.action_id === actionId);
}

export function selectFindingSummary(data: InspectionDataset) {
  const total = data.findings.length;
  return {
    total,
    severities: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((severity) => ({
      severity,
      count: data.findings.filter((f) => f.severity === severity).length,
    })),
    types: [
      { label: "Visual", types: ["VISUAL_DEFECT", "GAUGE_OUT_OF_RANGE"] },
      { label: "Thermal", types: ["ABNORMAL_TEMPERATURE"] },
      {
        label: "Navigation",
        types: ["NAVIGATION_OBSTRUCTION", "LOCALIZATION_ISSUE"],
      },
      { label: "Signal", types: ["SIGNAL_DEGRADATION", "ABNORMAL_VIBRATION"] },
    ].map((group) => {
      const count = data.findings.filter((f) =>
        group.types.includes(f.anomaly_type),
      ).length;
      return {
        ...group,
        count,
        share: total ? Math.round((count / total) * 1000) / 10 : 0,
      };
    }),
  };
}

export function selectDailyMetrics(data: InspectionDataset) {
  return [...new Set(data.missions.map((m) => m.start_time.slice(0, 10)))]
    .sort()
    .map((date) => {
      const missions = data.missions.filter((m) =>
        m.start_time.startsWith(date),
      );
      const ids = new Set(missions.map((m) => m.mission_id));
      const actions = data.actions.filter((a) => ids.has(a.mission_id));
      return {
        date,
        runs: missions.length,
        averageDuration:
          missions.reduce((sum, mission) => sum + mission.duration_min, 0) /
          missions.length,
        actionSuccess: actions.length
          ? (actions.filter((a) => a.status === "SUCCESS").length /
              actions.length) *
            100
          : 0,
        completion: missions.length
          ? (missions.filter((m) => m.mission_status === "COMPLETED").length /
              missions.length) *
            100
          : 0,
      };
    });
}
