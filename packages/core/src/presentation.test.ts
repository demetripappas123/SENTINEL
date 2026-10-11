import { describe, expect, it } from "vitest";
import { formatFindingDescription } from "./presentation";

describe("finding description presentation", () => {
  it.each([
    ["Synthetic signal degradation detected.", "Signal degradation detected."],
    ["Synthetic abnormal vibration detected.", "Abnormal vibration detected."],
    ["", ""],
    ["Temperature increased.", "Temperature increased."],
    [
      "Recorded synthetic calibration signal.",
      "Recorded synthetic calibration signal.",
    ],
  ])("formats %j without rewriting unrelated provenance", (value, want) => {
    expect(formatFindingDescription(value)).toBe(want);
  });
});

import { humanize, selectQueue } from "./index";
import { describeQueueItem, nextStepForFailure } from "./presentation";
import type { QueueItem } from "./api/client";
const failure: QueueItem = {
  id: "orbit:run-event-1",
  mission_id: "M015",
  action_id: "A0146",
  asset_id: "HX-204",
  verdict: "inspection_failure",
  cause: "SENSOR_TIMEOUT",
  rank: 100,
  explanation:
    "GAUGE_READING failed: SENSOR_TIMEOUT. Mission M015 is still completed.",
  evidence: { mission_status: "COMPLETED", other_failures_on_asset: 2 },
};

it.each([
  ["STATUS_FAILED", "Failed"],
  ["visualInspection", "Visual inspection"],
  ["LOCALIZATION_CONFIDENCE_PCT", "Position confidence"],
  ["unsupported_claim", "Finding needs verification"],
  ["potential_anomaly", "Potential anomaly"],
  ["FUTURE_SENSOR_CONDITION", "Future sensor condition"],
])("makes source label %s readable", (value, want) =>
  expect(humanize(value)).toBe(want),
);

it("preserves mission IDs and measurements while translating embedded codes", () => {
  expect(
    formatFindingDescription(
      "GAUGE_READING failed: SENSOR_TIMEOUT. Mission M015 is still completed.",
    ),
  ).toBe(
    "Gauge reading failed: sensor timeout. Mission M015 is still completed.",
  );
  expect(formatFindingDescription("TEMPERATURE_C 92.5 C on HX-204")).toBe(
    "Temperature 92.5 C on HX-204",
  );
});

it("explains failed inspections without claiming equipment is faulty", () => {
  const description = describeQueueItem(failure);
  expect(description.summary).toMatch(/sensor did not respond/i);
  expect(description.context).toMatch(/mission completed/i);
  expect(description.context).toContain("2 other failed inspections");
  expect(description.nextStep).toMatch(/sensor connection/i);
  expect(nextStepForFailure("FUTURE_SENSOR_CONDITION")).toMatch(
    /review.*inspection/i,
  );
});

it("keeps unsupported findings distinct from verified equipment findings", () => {
  expect(
    describeQueueItem({
      ...failure,
      verdict: "unsupported_claim",
      evidence: {},
    }).summary,
  ).toMatch(/not enough reliable evidence/i);
  expect(
    describeQueueItem({
      ...failure,
      verdict: "equipment_finding",
      cause: "TEMPERATURE_C",
      explanation: "TEMPERATURE_C 92.5 C is outside the other good readings.",
    }).summary,
  ).toContain("92.5 C");
});

it("searches readable cause and verdict labels while retaining raw-code searches", () => {
  expect(selectQueue([failure], { query: "sensor timeout" })).toHaveLength(1);
  expect(selectQueue([failure], { query: "SENSOR_TIMEOUT" })).toHaveLength(1);
  expect(
    selectQueue([{ ...failure, verdict: "unsupported_claim" }], {
      query: "needs verification",
    }),
  ).toHaveLength(1);
});
