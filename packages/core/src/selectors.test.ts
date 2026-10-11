import { describe, expect, it } from "vitest";
import { dataset, getFindings, getMetrics } from "./index";

describe("operational metrics", () => {
  it.each([
    ["ALL", 96.3, 81.9, 27],
    ["V1", 94.4, 77.2, 18],
    ["V2", 100, 91.1, 9],
  ] as const)(
    "keeps completion distinct from action success for %s",
    (configuration, completion, success, missions) => {
      const metrics = getMetrics(dataset, configuration);
      expect(metrics.completionRate).toBe(completion);
      expect(metrics.actionSuccessRate).toBe(success);
      expect(metrics.missionCount).toBe(missions);
    },
  );

  it("identifies completed missions containing failed actions", () => {
    expect(getMetrics(dataset, "ALL").completedWithFailures).toBe(21);
  });

  it("returns zero rates for an empty dataset", () => {
    expect(
      getMetrics(
        { ...dataset, missions: [], actions: [], findings: [] },
        "ALL",
      ),
    ).toMatchObject({
      completionRate: 0,
      actionSuccessRate: 0,
      missionCount: 0,
      completedWithFailures: 0,
    });
  });
});

describe("finding triage", () => {
  it("prioritizes the 15 required findings with four critical findings first", () => {
    const findings = getFindings(dataset, { status: "required" });
    expect(findings).toHaveLength(15);
    expect(findings.slice(0, 4).map((f) => f.severity)).toEqual([
      "CRITICAL",
      "CRITICAL",
      "CRITICAL",
      "CRITICAL",
    ]);
  });

  it("searches waypoint names and IDs case-insensitively", () => {
    const findings = getFindings(dataset, { status: "all", query: "  wp09  " });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.location_id === "WP09")).toBe(true);
    expect(
      getFindings(dataset, { status: "all", query: "no such asset" }),
    ).toEqual([]);
  });

  it("removes reviewed findings from attention and preserves them in reviewed history", () => {
    const reviewedIds = ["AN014"];
    expect(
      getFindings(dataset, { status: "required", reviewedIds }),
    ).toHaveLength(14);
    expect(
      getFindings(dataset, { status: "reviewed", reviewedIds }).map(
        (f) => f.anomaly_id,
      ),
    ).toEqual(["AN014"]);
  });

  it("limits findings to the selected mission and configuration", () => {
    const findings = getFindings(dataset, {
      status: "all",
      configuration: "V1",
      missionId: "M015",
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.mission_id === "M015")).toBe(true);
    expect(
      getFindings(dataset, {
        status: "all",
        configuration: "V2",
        missionId: "M015",
      }),
    ).toEqual([]);
  });
});
