import type { QueueItem } from "./api/client";
import { selectQueue } from "./queue";
import type { Action, Configuration, InspectionDataset, Mission } from "./types";

export type IssueKind =
  | "failed_action"
  | "bad_reading"
  | "anomaly_with_evidence"
  | "anomaly_without_evidence";

export interface CountBar {
  key: string;
  count: number;
}

export interface MissionInterpretation {
  lead: string;
  steps: string[];
  notes: string[];
}

export interface MissionBrief {
  failureTypes: CountBar[];
  issues: CountBar[];
  interpretation: MissionInterpretation;
}

const ISSUE_ORDER: IssueKind[] = [
  "failed_action",
  "bad_reading",
  "anomaly_with_evidence",
  "anomaly_without_evidence",
];

const HOTSPOTS = new Set(["WP05", "WP09"]);

export function missionBrief(
  data: InspectionDataset,
  queue: readonly QueueItem[],
  configuration: Configuration = "ALL",
): MissionBrief {
  const missions = data.missions.filter(
    (mission) => configuration === "ALL" || mission.scenario === configuration,
  );
  const missionIds = new Set(missions.map((mission) => mission.mission_id));
  const actions = data.actions.filter((action) => missionIds.has(action.mission_id));
  const failed = actions.filter((action) => action.status === "FAILED");
  const scenarios = new Map(missions.map((mission) => [mission.mission_id, mission.scenario]));
  const queued = selectQueue(queue, { configuration, status: "all", scenarios });
  const issues = emptyIssues();
  for (const item of queued) {
    issues[issueKind(item)] += 1;
  }
  const failureTypes = counts(
    failed.map((action) => action.failure_type || "UNSPECIFIED"),
  );
  return {
    failureTypes,
    issues: ISSUE_ORDER.map((key) => ({ key, count: issues[key] })),
    interpretation: interpretation(missions, actions, failed, queued, failureTypes, issues),
  };
}

function issueKind(item: QueueItem): IssueKind {
  if (item.verdict === "equipment_finding") return "anomaly_with_evidence";
  if (item.verdict === "unsupported_claim") return "anomaly_without_evidence";
  const status = item.evidence.action_status;
  if (item.cause === "QUESTIONABLE_READING" || status !== "FAILED") return "bad_reading";
  return "failed_action";
}

function emptyIssues(): Record<IssueKind, number> {
  return {
    failed_action: 0,
    bad_reading: 0,
    anomaly_with_evidence: 0,
    anomaly_without_evidence: 0,
  };
}

function counts(keys: string[]): CountBar[] {
  const totals = new Map<string, number>();
  for (const key of keys) totals.set(key, (totals.get(key) ?? 0) + 1);
  return [...totals.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const ISSUE_LABEL: Record<IssueKind, string> = {
  failed_action: "Failed Action",
  bad_reading: "Bad Reading",
  anomaly_with_evidence: "Anomaly With Evidence",
  anomaly_without_evidence: "Anomaly Without Evidence",
};

const ISSUE_MEANING: Record<IssueKind, string> = {
  failed_action: "the action status is failed",
  bad_reading: "the reading is questionable, separate from a stored action failure",
  anomaly_with_evidence:
    "a successful action has a good reading outside the other readings of that measurement",
  anomaly_without_evidence:
    "the action did not fail, and the anomaly label is not backed by a good reading outside the normal range",
};

const LOW_BATTERY = 40;

function interpretation(
  missions: Mission[],
  actions: Action[],
  failed: Action[],
  queued: QueueItem[],
  failureTypes: CountBar[],
  issues: Record<IssueKind, number>,
): MissionInterpretation {
  const total = ISSUE_ORDER.reduce((sum, key) => sum + issues[key], 0);
  const largest = ISSUE_ORDER.reduce((best, key) => (issues[key] > issues[best] ? key : best), ISSUE_ORDER[0]);
  if (!total) {
    return { lead: "No mission issues are recorded for this configuration.", steps: [], notes: [] };
  }
  const lead = [`The largest mission issue is ${ISSUE_LABEL[largest]}, ${issues[largest]} of ${total}.`];
  if (largest === "failed_action" && failureTypes.length) {
    const top = failureTypes.slice(0, 2).map((row) => `${titleCase(row.key)} (${row.count})`);
    lead.push(
      top.length === 1 ? `It is ${top[0]}.` : `It breaks down into ${top[0]} and ${top[1]}.`,
    );
  }
  const steps: string[] = [];
  const repeatedReasons = repeatCount(
    failed.filter((action) => action.asset_id && action.failure_type),
    (action) => `${action.asset_id}:${action.failure_type}`,
  );
  if (repeatedReasons) {
    steps.push(`Review ${plural(repeatedReasons, "asset")} that failed the same way more than once.`);
  }
  const hotspots = failed.filter((action) => action.location_id != null && HOTSPOTS.has(action.location_id));
  if (hotspots.length) {
    steps.push(`Check the ${hotspots.length} failures at WP05 and WP09 before the other waypoints.`);
  }
  const critical = failed.filter((action) =>
    queued.some(
      (item) => item.action_id === action.action_id && item.evidence.asset_criticality === "CRITICAL",
    ),
  ).length;
  if (critical) steps.push(`Start with the ${critical} failed actions on a critical asset.`);
  const battery = batterySuggestion(failed, failureTypes);
  if (battery) steps.push(battery);
  else {
    const lowBattery = failed.filter((action) => action.battery_pct != null && action.battery_pct < LOW_BATTERY);
    if (lowBattery.length) {
      steps.push(`Check the ${lowBattery.length} of ${failed.length} failed actions below 40% battery.`);
    }
  }
  const notes: string[] = [];
  for (const key of ISSUE_ORDER) {
    if (key === largest || !issues[key]) continue;
    notes.push(`Missions also have ${ISSUE_LABEL[key]} (${issues[key]}), which means ${ISSUE_MEANING[key]}.`);
  }
  const completedWithFailures = missions.filter(
    (mission) =>
      mission.mission_status === "COMPLETED" &&
      failed.some((action) => action.mission_id === mission.mission_id),
  ).length;
  if (completedWithFailures) {
    notes.push(
      `${completedWithFailures} completed missions still contain a failed action. Completion is not a clean run.`,
    );
  }
  notes.push(...longMissions(missions));
  notes.push(...versionGap(actions));
  return { lead: lead.join(" "), steps, notes };
}

function batterySuggestion(failed: Action[], failureTypes: CountBar[]): string | null {
  const named = failureTypes.filter((row) => row.count >= 4).slice(0, 2);
  if (named.length < 2) return null;
  const keys = new Set(named.map((row) => row.key));
  const focus = failed.filter((action) => keys.has(action.failure_type || "UNSPECIFIED") && action.battery_pct != null);
  const rest = failed.filter((action) => !keys.has(action.failure_type || "UNSPECIFIED") && action.battery_pct != null);
  if (focus.length < 4 || rest.length < 4) return null;
  const focusLow = focus.filter((action) => (action.battery_pct ?? 0) < LOW_BATTERY);
  const restLow = rest.filter((action) => (action.battery_pct ?? 0) < LOW_BATTERY);
  const focusRate = focusLow.length / focus.length;
  const restRate = restLow.length / rest.length;
  if (focusRate < 0.5 || focusRate - restRate < 0.15) return null;
  const names = named.map((row) => titleCase(row.key)).join(" and ");
  const contrast = failureTypes.find((row) => {
    if (keys.has(row.key) || row.count < 4) return false;
    const rows = failed.filter((action) => action.failure_type === row.key && action.battery_pct != null);
    return rows.length >= 4 && rows.every((action) => (action.battery_pct ?? 0) >= LOW_BATTERY);
  });
  const contrastText = contrast
    ? ` ${titleCase(contrast.key)} does not follow that pattern (0 of ${contrast.count} below 40%).`
    : "";
  return (
    `${names} are below 40% battery more often than the other failures ` +
    `(${focusLow.length} of ${focus.length} versus ${restLow.length} of ${rest.length}). ` +
    `Check battery before treating them as separate faults. The counts show a pattern, not a confirmed battery fault.` +
    contrastText
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function repeatCount(actions: Action[], key: (action: Action) => string | null): number {
  const totals = new Map<string, number>();
  for (const action of actions) {
    const id = key(action);
    if (!id) continue;
    totals.set(id, (totals.get(id) ?? 0) + 1);
  }
  return [...totals.values()].filter((count) => count > 1).length;
}

function longMissions(missions: Mission[]): string[] {
  const groups = new Map<string, Mission[]>();
  for (const mission of missions) {
    if (mission.duration_min == null || !mission.configuration_version) continue;
    const group = groups.get(mission.configuration_version) ?? [];
    group.push(mission);
    groups.set(mission.configuration_version, group);
  }
  const lines: string[] = [];
  for (const [version, group] of groups) {
    if (group.length < 4) continue;
    const typical = median(group.map((mission) => mission.duration_min ?? 0));
    const longest = group.reduce((best, mission) =>
      (mission.duration_min ?? 0) > (best.duration_min ?? 0) ? mission : best,
    );
    const duration = longest.duration_min ?? 0;
    if (duration < typical + 8) continue;
    lines.push(
      `${longest.mission_id} ran ${duration} min, which is long for ${version} (typical ${Math.round(typical)} min).`,
    );
  }
  return lines;
}

function versionGap(actions: Action[]): string[] {
  const rate = (version: string) => {
    const rows = actions.filter((action) => action.scenario === versionScenario(version));
    if (!rows.length) return null;
    return (rows.filter((action) => action.status === "SUCCESS").length / rows.length) * 100;
  };
  const baseline = rate("V1");
  const improved = rate("V2");
  if (baseline == null || improved == null) return [];
  const gap = Math.round((improved - baseline) * 10) / 10;
  if (Math.abs(gap) < 5) return [];
  const higher = gap > 0 ? "V2" : "V1";
  return [
    `${higher} action success is ${Math.abs(gap)} points above the other configuration.`,
  ];
}

function versionScenario(version: string): string {
  return version === "V1" ? "BASELINE" : "IMPROVED";
}

function median(values: number[]): number {
  const ordered = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2) return ordered[middle];
  return (ordered[middle - 1] + ordered[middle]) / 2;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
