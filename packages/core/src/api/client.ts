import type { InspectionDataset } from "../types";

export type DataSource = "kit" | "orbit" | "spot";

export interface VersionMetric {
  source: string;
  configuration_version: string | null;
  mission_count: number;
  completed_missions: number;
  mission_completion_pct: number | null;
  action_count: number;
  successful_actions: number;
  action_success_pct: number | null;
  avg_duration_min: number | null;
  avg_start_battery_pct: number | null;
  avg_end_battery_pct: number | null;
}
export interface InspectionMetric {
  source: string;
  action_type: string;
  configuration_version: string | null;
  action_count: number;
  successful_actions: number;
  success_pct: number | null;
}
export interface LocationMetric {
  source: string;
  location_id: string;
  location_name: string;
  action_count: number;
  successful_actions: number;
  success_pct: number | null;
  navigation_count: number;
  navigation_failures: number;
  navigation_failure_pct: number | null;
}
export interface BatteryMetric {
  low_pct: number;
  high_pct: number;
  action_count: number;
  successful_actions: number;
  success_pct: number | null;
}
export interface MissionMetric {
  mission_count: number;
  completed_count: number;
  completed_with_failures: number;
  failed_mission_ids: string[];
}
export interface OperationalMetrics {
  versions: VersionMetric[];
  inspections: InspectionMetric[];
  locations: LocationMetric[];
  battery: BatteryMetric[];
  missions: MissionMetric;
}

export interface QueueItem {
  id: string;
  verdict:
    | "inspection_failure"
    | "equipment_finding"
    | "potential_anomaly"
    | "unsupported_claim";
  cause: string;
  explanation: string;
  mission_id: string;
  action_id?: string | null;
  asset_id?: string | null;
  location_id?: string | null;
  rank: number;
  evidence: Record<string, string | number | boolean | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}
function isTextOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
function isVersionMetric(value: unknown): value is VersionMetric {
  if (!isRecord(value)) return false;
  return (
    typeof value.source === "string" &&
    isTextOrNull(value.configuration_version) &&
    [
      "mission_count",
      "completed_missions",
      "action_count",
      "successful_actions",
    ].every((key) => typeof value[key] === "number") &&
    [
      "mission_completion_pct",
      "action_success_pct",
      "avg_duration_min",
      "avg_start_battery_pct",
      "avg_end_battery_pct",
    ].every((key) => isNumberOrNull(value[key]))
  );
}
function isInspectionMetric(value: unknown): value is InspectionMetric {
  if (!isRecord(value)) return false;
  return (
    typeof value.source === "string" &&
    typeof value.action_type === "string" &&
    isTextOrNull(value.configuration_version) &&
    typeof value.action_count === "number" &&
    typeof value.successful_actions === "number" &&
    isNumberOrNull(value.success_pct)
  );
}
function isLocationMetric(value: unknown): value is LocationMetric {
  if (!isRecord(value)) return false;
  return (
    ["source", "location_id", "location_name"].every(
      (key) => typeof value[key] === "string",
    ) &&
    [
      "action_count",
      "successful_actions",
      "navigation_count",
      "navigation_failures",
    ].every((key) => typeof value[key] === "number") &&
    ["success_pct", "navigation_failure_pct"].every((key) =>
      isNumberOrNull(value[key]),
    )
  );
}
function isBatteryMetric(value: unknown): value is BatteryMetric {
  if (!isRecord(value)) return false;
  return (
    ["low_pct", "high_pct", "action_count", "successful_actions"].every(
      (key) => typeof value[key] === "number",
    ) && isNumberOrNull(value.success_pct)
  );
}
function isOperationalMetrics(value: unknown): value is OperationalMetrics {
  if (!isRecord(value) || !isRecord(value.missions)) return false;
  const missions = value.missions;
  return (
    Array.isArray(value.versions) &&
    value.versions.every(isVersionMetric) &&
    Array.isArray(value.inspections) &&
    value.inspections.every(isInspectionMetric) &&
    Array.isArray(value.locations) &&
    value.locations.every(isLocationMetric) &&
    Array.isArray(value.battery) &&
    value.battery.every(isBatteryMetric) &&
    ["mission_count", "completed_count", "completed_with_failures"].every(
      (key) => typeof missions[key] === "number",
    ) &&
    Array.isArray(missions.failed_mission_ids) &&
    missions.failed_mission_ids.every((id) => typeof id === "string")
  );
}
export function isQueueItem(value: unknown): value is QueueItem {
  if (!isRecord(value)) return false;
  return (
    ["id", "cause", "explanation", "mission_id"].every(
      (key) => typeof value[key] === "string",
    ) &&
    typeof value.verdict === "string" &&
    ["inspection_failure", "equipment_finding", "potential_anomaly", "unsupported_claim"].includes(
      value.verdict,
    ) &&
    ["action_id", "asset_id", "location_id"].every(
      (key) => value[key] == null || typeof value[key] === "string",
    ) &&
    typeof value.rank === "number" &&
    isFlatRecord(value.evidence)
  );
}

function isFlatRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (v) => v == null || ["string", "number", "boolean"].includes(typeof v),
    )
  );
}

type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "flat"
  | "string?"
  | "number?";
const s = "string",
  n = "number",
  b = "boolean",
  sNull = "string?",
  nNull = "number?";
// Mirrors ../types.ts; the API returns exactly these fields.
const DATASET_FIELDS: Record<
  keyof InspectionDataset,
  Record<string, FieldType>
> = {
  missions: {
    mission_id: s,
    mission_name: s,
    configuration_version: sNull,
    start_time: sNull,
    end_time: sNull,
    duration_min: nNull,
    start_battery_pct: nNull,
    end_battery_pct: nNull,
    mission_status: s,
  },
  actions: {
    action_id: s,
    mission_id: s,
    sequence: nNull,
    timestamp: sNull,
    location_id: sNull,
    asset_id: sNull,
    action_type: s,
    battery_pct: nNull,
    status: s,
    failure_type: s,
    duration_sec: nNull,
    configuration_version: sNull,
  },
  findings: {
    anomaly_id: s,
    action_id: s,
    mission_id: s,
    location_id: sNull,
    asset_id: sNull,
    timestamp: sNull,
    anomaly_type: s,
    severity: s,
    operator_review_required: b,
    description: s,
  },
  assets: {
    asset_id: s,
    asset_name: s,
    asset_type: s,
    location_id: s,
    criticality: s,
  },
  locations: {
    location_id: s,
    location_name: s,
    floor: n,
    environment: s,
    x_coord: n,
    y_coord: n,
  },
  readings: {
    reading_id: s,
    action_id: s,
    measurement_type: s,
    value: n,
    unit: s,
    quality: s,
  },
  events: {
    event_id: s,
    mission_id: s,
    timestamp: s,
    event_type: s,
    details: "flat",
  },
};

function fieldMatches(value: unknown, type: FieldType): boolean {
  if (type === "flat") return isFlatRecord(value);
  if (type === "string?") return value == null || typeof value === "string";
  if (type === "number?") return value == null || typeof value === "number";
  return typeof value === type;
}

export function isInspectionDataset(
  value: unknown,
): value is InspectionDataset {
  if (!isRecord(value)) return false;
  return Object.entries(DATASET_FIELDS).every(([collection, fields]) => {
    const records = value[collection];
    return (
      Array.isArray(records) &&
      records.every(
        (record) =>
          isRecord(record) &&
          Object.entries(fields).every(([key, type]) =>
            fieldMatches(record[key], type),
          ),
      )
    );
  });
}

export function createApiClient(
  baseUrl: string,
  // Resolved per request so a fetch replaced after startup is still used.
  fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
) {
  const base = baseUrl.replace(/\/+$/, "");
  async function request(path: string): Promise<unknown> {
    const response = await fetcher(base + path, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error("SENTINEL API request failed (" + response.status + ")");
    return response.json();
  }
  async function getDataset(
    source: DataSource = "kit",
  ): Promise<InspectionDataset> {
    const value = await request("/dataset?source=" + source);
    if (!isInspectionDataset(value))
      throw new Error("Invalid dataset response");
    return value;
  }
  return {
    async getQueue(): Promise<QueueItem[]> {
      const value = await request("/queue");
      if (!Array.isArray(value) || !value.every(isQueueItem))
        throw new Error("Invalid queue response");
      return value;
    },
    getDataset,
    async getLiveDataset(): Promise<InspectionDataset> {
      const parts = await Promise.all(
        (["kit", "orbit", "spot"] as const).map((source) => getDataset(source)),
      );
      return {
        missions: parts.flatMap((part) => part.missions),
        actions: parts.flatMap((part) => part.actions),
        findings: parts.flatMap((part) => part.findings),
        assets: parts.flatMap((part) => part.assets),
        locations: parts.flatMap((part) => part.locations),
        readings: parts.flatMap((part) => part.readings),
        events: parts
          .flatMap((part) => part.events)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      };
    },
    async getMetrics(): Promise<OperationalMetrics> {
      const value = await request("/metrics");
      if (!isOperationalMetrics(value))
        throw new Error("Invalid metrics response");
      return value;
    },
    async getHealth(): Promise<{ status: "ok" }> {
      const value = await request("/health");
      if (!isRecord(value) || value.status !== "ok")
        throw new Error("Invalid health response");
      return { status: "ok" };
    },
  };
}
