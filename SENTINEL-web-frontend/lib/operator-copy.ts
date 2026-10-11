import {
  describeQueueItem,
  formatFindingDescription,
  humanize,
  type InspectionDataset,
  type ReplayEvent,
} from "@sentinel/core";
import type { QueueItem } from "@sentinel/core/api";

// Source names and machine identifiers belong in the data layer, not operator copy.
export function operatorText(
  value: string,
  fallback = "Inspection detail unavailable",
) {
  if (!value.trim() || /[{}]|\[object Object\]/.test(value)) return fallback;
  return (
    formatFindingDescription(value)
      .replace(/\borbit(?=\b|_)[\s:_-]*/gi, "")
      .replace(/\b(?:source|raw payload|raw data)\s*:\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (char) => char.toUpperCase()) || fallback
  );
}

export function missionName(data: InspectionDataset, id: string) {
  if (/^M\d+$/.test(id)) return "Route " + Number(id.slice(1));
  const mission = data.missions.find((row) => row.mission_id === id);
  const name = mission?.mission_name;
  if (
    !name ||
    name === id ||
    /^(?:orbit|spot|run)[-_:][\da-f-]{8,}$/i.test(name)
  )
    return "Inspection run";
  return operatorText(name, "Inspection run");
}

export function placeName(
  data: InspectionDataset,
  id: string | null | undefined,
) {
  const name = data.locations.find(
    (row) => row.location_id === id,
  )?.location_name;
  return name
    ? operatorText(name, "Location not recorded")
    : "Location not recorded";
}

export function equipmentName(
  data: InspectionDataset,
  id: string | null | undefined,
) {
  const name = data.assets.find((row) => row.asset_id === id)?.asset_name;
  return name
    ? operatorText(name, "Equipment not identified")
    : "Equipment not identified";
}

export function issueDescription(item: QueueItem) {
  const description = describeQueueItem(item);
  const fallback =
    item.verdict === "inspection_failure"
      ? "This inspection could not be completed. Review the affected check before retrying."
      : item.verdict === "unsupported_claim"
        ? "The available evidence is not sufficient to confirm an equipment problem."
        : item.verdict === "potential_anomaly"
          ? "A good reading is above the limit for this equipment, and there is not enough history to confirm it."
          : "An equipment reading needs attention. Compare it with the expected operating range.";
  return {
    ...description,
    summary: operatorText(description.summary, fallback),
    context: description.context ? operatorText(description.context, "") : "",
  };
}

export function replayDescription(data: InspectionDataset, event: ReplayEvent) {
  const action = data.actions.find(
    (row) =>
      row.action_id === event.details.action_id &&
      row.mission_id === event.mission_id,
  );
  const failure =
    typeof event.details.failure_type === "string"
      ? event.details.failure_type
      : action?.failure_type;
  if (action) {
    const check = operatorText(humanize(action.action_type));
    const location = placeName(data, action.location_id);
    return `${check} · ${location}${event.event_type.includes("FAIL") && failure ? " · " + operatorText(humanize(failure)) : ""}`;
  }
  if (failure && event.event_type.includes("FAIL"))
    return operatorText(humanize(failure));
  if (event.event_type.includes("START"))
    return "The robot started this inspection route.";
  if (event.event_type.includes("COMPLET"))
    return "The route finished. Check its inspection results for any missed checks.";
  return "Recorded update for this inspection run.";
}
