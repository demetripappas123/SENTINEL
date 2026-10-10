import { describe, expect, it } from "vitest";
import { dataset, getMetrics, type InspectionDataset } from "./index";
import {
  scopeDataset,
  selectActionFindings,
  selectActionReadings,
  selectMissionActions,
  selectFindingSummary,
  selectDailyMetrics,
} from "./inspection-selectors";

function overnightDataset(): InspectionDataset {
  return {
    ...dataset,
    missions: [
      {
        ...dataset.missions[0],
        mission_id: "overnight",
        start_time: "2026-09-01T23:50:00",
        end_time: "2026-09-02T00:20:00",
      },
      {
        ...dataset.missions[0],
        mission_id: "boundary",
        start_time: "2026-09-02T23:59:59",
      },
      {
        ...dataset.missions[0],
        mission_id: "outside",
        start_time: "2026-09-03T00:00:00",
      },
    ],
    actions: [
      {
        ...dataset.actions[0],
        mission_id: "overnight",
        action_id: "late",
        timestamp: "2026-09-02T00:10:00",
        sequence: 2,
      },
      {
        ...dataset.actions[0],
        mission_id: "overnight",
        action_id: "early",
        timestamp: "2026-09-01T23:55:00",
        sequence: 1,
      },
      {
        ...dataset.actions[0],
        mission_id: "outside",
        action_id: "excluded",
        sequence: 1,
      },
    ],
    findings: [
      {
        ...dataset.findings[0],
        anomaly_id: "late-finding",
        mission_id: "overnight",
        action_id: "late",
        timestamp: "2026-09-02T00:10:00",
      },
      {
        ...dataset.findings[0],
        anomaly_id: "outside-finding",
        mission_id: "outside",
        action_id: "excluded",
      },
    ],
    readings: [
      { ...dataset.readings[0], reading_id: "late-reading", action_id: "late" },
      {
        ...dataset.readings[0],
        reading_id: "outside-reading",
        action_id: "excluded",
      },
    ],
    events: [
      {
        event_id: "late-event",
        mission_id: "overnight",
        timestamp: "2026-09-02T00:10:00",
        event_type: "ACTION_COMPLETED",
        details: {},
      },
      {
        event_id: "outside-event",
        mission_id: "outside",
        timestamp: "2026-09-03T00:10:00",
        event_type: "ACTION_COMPLETED",
        details: {},
      },
    ],
  };
}

describe("date-scoped inspection data", () => {
  it("includes both boundary dates and the entire overnight mission", () => {
    const data = overnightDataset();
    const scoped = scopeDataset(data, {
      start: "2026-09-01",
      end: "2026-09-02",
    });
    expect(scoped.missions.map((m) => m.mission_id)).toEqual([
      "overnight",
      "boundary",
    ]);
    expect(scoped.actions.map((a) => a.action_id)).toEqual(["late", "early"]);
    expect(scoped.findings.map((f) => f.anomaly_id)).toEqual(["late-finding"]);
    expect(scoped.readings.map((r) => r.reading_id)).toEqual(["late-reading"]);
    expect(scoped.events.map((e) => e.event_id)).toEqual(["late-event"]);
    expect(
      scopeDataset(data, { start: "2026-09-01", end: "2026-09-01" }).readings,
    ).toHaveLength(1);
    expect(scoped.assets).toEqual(data.assets);
    expect(scoped.locations).toEqual(data.locations);
    expect(data.missions).toHaveLength(3);
  });

  it("uses recorded calendar dates without converting timestamps to another timezone", () => {
    const data = overnightDataset();
    data.missions[0].start_time = "2026-09-01T23:50:00-05:00";
    expect(
      scopeDataset(data, {
        start: "2026-09-01",
        end: "2026-09-01",
      }).missions.map((m) => m.mission_id),
    ).toEqual(["overnight"]);
  });

  it("supports all dates and empty selections with zero metrics", () => {
    const data = overnightDataset();
    expect(scopeDataset(data, null)).toEqual(data);
    const empty = scopeDataset(data, {
      start: "2026-10-01",
      end: "2026-10-02",
    });
    expect(getMetrics(empty, "ALL")).toMatchObject({
      missionCount: 0,
      actionSuccessRate: 0,
      completionRate: 0,
    });
    expect(empty.actions).toEqual([]);
    expect(empty.readings).toEqual([]);
    expect(empty.findings).toEqual([]);
    expect(empty.events).toEqual([]);
  });

  it.each([
    { start: "2026-09-02", end: "2026-09-01" },
    { start: "2026-02-30", end: "2026-09-01" },
    { start: "invalid", end: "2026-09-01" },
    { start: "2026-9-1", end: "2026-09-01" },
  ])("rejects invalid date ranges: %j", (range) => {
    expect(() => scopeDataset(dataset, range)).toThrow(RangeError);
  });
});

describe("dashboard chart aggregation", () => {
  it("counts all findings by severity and type, independently of acknowledgment", () => {
    const summary = selectFindingSummary(dataset);
    expect(summary.total).toBe(40);
    expect(summary.severities.map((s) => s.count)).toEqual([4, 11, 14, 11]);
    expect(summary.types.reduce((sum, group) => sum + group.count, 0)).toBe(40);
    expect(summary.types.map((group) => group.share)).toEqual([30, 15, 15, 40]);
  });
  it("uses mission start dates for overnight action results", () => {
    const data = overnightDataset();
    data.actions.forEach((action) => {
      action.status = "SUCCESS";
    });
    expect(selectDailyMetrics(data)[0]).toMatchObject({
      date: "2026-09-01",
      runs: 1,
      actionSuccess: 100,
      completion: 100,
    });
    expect(selectDailyMetrics(data)[1]).toMatchObject({
      date: "2026-09-02",
      runs: 1,
      actionSuccess: 0,
    });
  });
  it("supports an empty date scope without NaN values", () => {
    const empty = scopeDataset(dataset, {
      start: "2027-01-01",
      end: "2027-01-01",
    });
    expect(selectDailyMetrics(empty)).toEqual([]);
    expect(
      selectFindingSummary(empty).types.map((group) => group.share),
    ).toEqual([0, 0, 0, 0]);
  });
});

describe("injected evidence selectors", () => {
  it("uses the supplied records and sorts actions without mutating them", () => {
    const data = overnightDataset();
    expect(
      selectMissionActions(data, "overnight").map((a) => a.action_id),
    ).toEqual(["early", "late"]);
    expect(data.actions.map((a) => a.action_id)).toEqual([
      "late",
      "early",
      "excluded",
    ]);
    expect(selectActionFindings(data, "late").map((f) => f.anomaly_id)).toEqual(
      ["late-finding"],
    );
    expect(selectActionReadings(data, "late").map((r) => r.reading_id)).toEqual(
      ["late-reading"],
    );
  });

  it("returns empty evidence for missing joins and missions without actions", () => {
    const data = overnightDataset();
    expect(selectMissionActions(data, "boundary")).toEqual([]);
    expect(selectMissionActions(data, "missing")).toEqual([]);
    expect(selectActionFindings(data, "missing")).toEqual([]);
    expect(selectActionReadings(data, "missing")).toEqual([]);
  });
});

it("aggregates recorded duration by mission start date for the duration sparkline", () => {
  const data = {
    ...dataset,
    missions: [
      {
        ...dataset.missions[0],
        start_time: "2026-09-01T23:00:00",
        duration_min: 10,
      },
      {
        ...dataset.missions[1],
        start_time: "2026-09-01T04:00:00",
        duration_min: 30,
      },
      {
        ...dataset.missions[2],
        start_time: "2026-09-02T04:00:00",
        duration_min: 40,
      },
    ],
  };
  expect(selectDailyMetrics(data)).toMatchObject([
    { date: "2026-09-01", averageDuration: 20 },
    { date: "2026-09-02", averageDuration: 40 },
  ]);
});
