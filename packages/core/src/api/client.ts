export interface QueueItem {
  id: string;
  verdict: "inspection_failure" | "equipment_finding" | "unsupported_claim";
  cause: string;
  explanation: string;
  mission_id: string;
  action_id?: string | null;
  asset_id?: string | null;
  location_id?: string | null;
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
    isRecord(value.evidence) &&
    Object.values(value.evidence).every(
      (v) => v === null || ["string", "number", "boolean"].includes(typeof v),
    )
  );
}

export function createApiClient(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
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
    async getHealth(): Promise<{ status: "ok" }> {
      const value = await request("/health");
      if (!isRecord(value) || value.status !== "ok")
        throw new Error("Invalid health response");
      return { status: "ok" };
    },
  };
}
