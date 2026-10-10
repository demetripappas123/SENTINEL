import type { InspectionDataset } from "../types";

export type DataSource = "kit" | "orbit" | "spot";

export interface QueueItem {
  id: string;
  verdict: "inspection_failure" | "equipment_finding" | "unsupported_claim";
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
function isQueueItem(value: unknown): value is QueueItem {
  if (!isRecord(value)) return false;
  return (
    ["id", "cause", "explanation", "mission_id"].every(
      (key) => typeof value[key] === "string",
    ) &&
    typeof value.verdict === "string" &&
    ["inspection_failure", "equipment_finding", "unsupported_claim"].includes(
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

type FieldType = "string" | "number" | "boolean" | "flat";
const s = "string",
  n = "number",
  b = "boolean";
// Mirrors ../types.ts; the API returns exactly these fields.
const DATASET_FIELDS: Record<
  keyof InspectionDataset,
  Record<string, FieldType>
> = {
  missions: {
    mission_id: s,
    mission_name: s,
    scenario: s,
    configuration_version: s,
    start_time: s,
    end_time: s,
    duration_min: n,
    start_battery_pct: n,
    end_battery_pct: n,
    mission_status: s,
  },
  actions: {
    action_id: s,
    mission_id: s,
    sequence: n,
    timestamp: s,
    location_id: s,
    asset_id: s,
    action_type: s,
    battery_pct: n,
    status: s,
    failure_type: s,
    duration_sec: n,
    scenario: s,
  },
  findings: {
    anomaly_id: s,
    action_id: s,
    mission_id: s,
    location_id: s,
    asset_id: s,
    timestamp: s,
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

function isInspectionDataset(value: unknown): value is InspectionDataset {
  if (!isRecord(value)) return false;
  return Object.entries(DATASET_FIELDS).every(([collection, fields]) => {
    const records = value[collection];
    return (
      Array.isArray(records) &&
      records.every(
        (record) =>
          isRecord(record) &&
          Object.entries(fields).every(([key, type]) =>
            type === "flat"
              ? isFlatRecord(record[key])
              : typeof record[key] === type,
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
  return {
    async getQueue(): Promise<QueueItem[]> {
      const value = await request("/queue");
      if (!Array.isArray(value) || !value.every(isQueueItem))
        throw new Error("Invalid queue response");
      return value;
    },
    async getDataset(source: DataSource = "kit"): Promise<InspectionDataset> {
      const value = await request("/dataset?source=" + source);
      if (!isInspectionDataset(value))
        throw new Error("Invalid dataset response");
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
