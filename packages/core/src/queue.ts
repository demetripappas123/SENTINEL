import type { QueueItem } from "./api/client";
import type { Configuration } from "./types";

export function selectQueue(
  items: readonly QueueItem[],
  filter: {
    configuration?: Configuration;
    status?: "required" | "all" | "reviewed";
    reviewedIds?: readonly string[];
    missionId?: string;
    query?: string;
    scenarios?: ReadonlyMap<string, string | null>;
  } = {},
): QueueItem[] {
  const {
    configuration = "ALL",
    status = "required",
    reviewedIds = [],
    missionId,
    query = "",
    scenarios,
  } = filter;
  const reviewed = new Set(reviewedIds);
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (missionId && item.mission_id !== missionId) return false;
    if (configuration !== "ALL" && scenarios?.get(item.mission_id) !== configuration)
      return false;
    if (status === "required" && reviewed.has(item.id)) return false;
    if (status === "reviewed" && !reviewed.has(item.id)) return false;
    if (!needle) return true;
    return [item.verdict, item.cause, item.explanation, item.mission_id, item.action_id, item.asset_id, item.location_id]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}
