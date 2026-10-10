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
