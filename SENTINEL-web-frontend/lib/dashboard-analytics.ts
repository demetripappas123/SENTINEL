import {
  missionLabel,
  type Action,
  type Configuration,
  type InspectionDataset,
} from "@sentinel/core";

// FastAPI emits offset-free timestamps in UTC. Never interpret them in browser local time.
function utcTime(timestamp: string | null) {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : timestamp + "Z",
  );
}

// The same check: one action type at one place on one piece of equipment.
const checkKey = (action: Action) =>
  [action.location_id, action.asset_id, action.action_type].join("|");

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
  // A failure is fixed once the same check has passed after it.
  const lastPass = new Map<string, number>();
  for (const action of actions) {
    const time = utcTime(action.timestamp);
    if (action.status !== "SUCCESS" || time == null) continue;
    const key = checkKey(action);
    if (time > (lastPass.get(key) ?? -Infinity)) lastPass.set(key, time);
  }
  const isFixed = (action: Action) => {
    const time = utcTime(action.timestamp);
    const passed = lastPass.get(checkKey(action));
    return (
      (action.location_id != null || action.asset_id != null) &&
      time != null &&
      passed != null &&
      passed > time
    );
  };
  let fixed = 0;
  const causes = new Map<string, number>();
  const locations = new Map<
    string | null,
    {
      locationId: string | null;
      failed: number;
      fixed: number;
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
      fixed: 0,
      total: 0,
      missionId: action.mission_id,
      causes: new Map<string, number>(),
    };
    row.total++;
    if (action.status === "FAILED" && isFixed(action)) {
      row.fixed++;
      fixed++;
    } else if (action.status === "FAILED") {
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
    (day) => ({
      day,
      count: 0,
      passed: 0,
      failed: 0,
      fixed: 0,
      dates: new Set<string>(),
      missions: new Set<string>(),
      causes: new Map<string, number>(),
    }),
  );
  const daily = new Map<
    string,
    { day: string; passed: number; failed: number }
  >();
  let undated = 0;
  for (const action of actions) {
    if (action.status !== "SUCCESS" && action.status !== "FAILED") continue;
    const time = utcTime(action.timestamp);
    if (time == null) {
      undated++;
      continue;
    }
    const day = new Date(time).toISOString().slice(0, 10);
    const weekday = weekdays[new Date(time).getUTCDay()];
    weekday.count++;
    weekday.dates.add(day);
    weekday.missions.add(action.mission_id);
    const row = daily.get(day) ?? { day, passed: 0, failed: 0 };
    if (action.status === "SUCCESS") {
      row.passed++;
      weekday.passed++;
    } else {
      const cause = action.failure_type || "UNKNOWN";
      row.failed++;
      weekday.failed++;
      if (isFixed(action)) weekday.fixed++;
      weekday.causes.set(cause, (weekday.causes.get(cause) ?? 0) + 1);
    }
    daily.set(day, row);
  }
  const openFailed = failed - fixed;
  return {
    passed,
    failed,
    fixed,
    openFailed,
    awaiting: actions.length - passed - failed,
    undated,
    rate: passed + failed ? (passed / (passed + failed)) * 100 : null,
    cleanMissions,
    completedMissions: completed.length,
    cleanRate: completed.length
      ? (cleanMissions / completed.length) * 100
      : null,
    weekdays: weekdays.map(({ dates, missions, causes: dayCauses, ...day }) => {
      const [cause, count] =
        [...dayCauses].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0] ?? [];
      return {
        ...day,
        rate: day.count ? (day.passed / day.count) * 100 : null,
        dates: [...dates].sort(),
        missions: missions.size,
        topCause: cause ? { cause, count } : null,
      };
    }),
    causes: [...causes]
      .map(([cause, count]) => ({
        cause,
        count,
        share: (count / openFailed) * 100,
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
