import {
  missionLabel,
  type Configuration,
  type InspectionDataset,
} from "@sentinel/core";

export function getDashboardAnalytics(
  data: InspectionDataset,
  configuration: Configuration,
) {
  const ids = new Set(
    data.missions
      .filter((m) => configuration === "ALL" || m.scenario === configuration)
      .map((m) => m.mission_id),
  );
  const actions = data.actions.filter((a) => ids.has(a.mission_id));
  const passed = actions.filter((a) => a.status === "SUCCESS").length;
  const failed = actions.filter((a) => a.status === "FAILED").length;
  const causes = new Map<string, number>();
  const locations = new Map<
    string | null,
    {
      locationId: string | null;
      failed: number;
      total: number;
      missionId: string;
      causes: Map<string, number>;
    }
  >();
  for (const action of actions) {
    if (action.status !== "SUCCESS" && action.status !== "FAILED") continue;
    const row = locations.get(action.location_id) ?? {
      locationId: action.location_id,
      failed: 0,
      total: 0,
      missionId: action.mission_id,
      causes: new Map<string, number>(),
    };
    row.total++;
    if (action.status === "FAILED") {
      const cause = action.failure_type || "UNKNOWN";
      row.failed++;
      row.missionId = action.mission_id;
      row.causes.set(cause, (row.causes.get(cause) ?? 0) + 1);
      causes.set(cause, (causes.get(cause) ?? 0) + 1);
    }
    locations.set(action.location_id, row);
  }
  const completed = data.missions.filter(
    (m) => ids.has(m.mission_id) && missionLabel(m) === "COMPLETED",
  );
  const actionsByMission = new Map<string, typeof actions>();
  for (const action of actions) {
    const rows = actionsByMission.get(action.mission_id) ?? [];
    rows.push(action);
    actionsByMission.set(action.mission_id, rows);
  }
  const cleanMissions = completed.filter((m) => {
    const rows = actionsByMission.get(m.mission_id) ?? [];
    return rows.length > 0 && rows.every((a) => a.status === "SUCCESS");
  }).length;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
    (day) => ({ day, count: 0 }),
  );
  const daily = new Map<
    string,
    { day: string; passed: number; failed: number }
  >();
  let undated = 0;
  for (const action of actions) {
    if (action.status !== "SUCCESS" && action.status !== "FAILED") continue;
    if (!action.timestamp || !Number.isFinite(Date.parse(action.timestamp))) {
      undated++;
      continue;
    }
    // FastAPI emits offset-free timestamps in UTC. Never interpret them in browser local time.
    const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(action.timestamp)
      ? action.timestamp
      : action.timestamp + "Z";
    const day = new Date(timestamp).toISOString().slice(0, 10);
    weekdays[new Date(timestamp).getUTCDay()].count++;
    const row = daily.get(day) ?? { day, passed: 0, failed: 0 };
    if (action.status === "SUCCESS") row.passed++;
    else row.failed++;
    daily.set(day, row);
  }
  return {
    passed,
    failed,
    awaiting: actions.length - passed - failed,
    undated,
    rate: passed + failed ? (passed / (passed + failed)) * 100 : null,
    cleanMissions,
    completedMissions: completed.length,
    cleanRate: completed.length
      ? (cleanMissions / completed.length) * 100
      : null,
    weekdays,
    causes: [...causes]
      .map(([cause, count]) => ({
        cause,
        count,
        share: (count / failed) * 100,
      }))
      .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause)),
    hotspots: [...locations.values()]
      .filter((row) => row.failed > 0)
      .sort(
        (a, b) =>
          b.failed - a.failed ||
          (a.locationId ?? "").localeCompare(b.locationId ?? ""),
      )
      .map(({ causes: locationCauses, ...row }) => ({
        ...row,
        rate: (row.failed / row.total) * 100,
        cause: [...locationCauses].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0][0],
      })),
    days: [...daily.values()]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((row) => ({
        ...row,
        rate: (row.passed / (row.passed + row.failed)) * 100,
      })),
  };
}
