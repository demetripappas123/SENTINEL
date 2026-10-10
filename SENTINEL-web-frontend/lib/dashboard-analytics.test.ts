import { expect, it } from "vitest";
import { dataset, emptyDataset } from "@sentinel/core";
import { getDashboardAnalytics } from "./dashboard-analytics";

const sample = {
  ...emptyDataset,
  missions: [
    {
      ...dataset.missions[0],
      mission_id: "b",
      scenario: "BASELINE",
      start_time: "2026-09-02T10:00:00Z",
    },
    {
      ...dataset.missions[0],
      mission_id: "i",
      scenario: "IMPROVED",
      start_time: "2026-09-01T10:00:00Z",
    },
  ],
  actions: [
    {
      ...dataset.actions[0],
      action_id: "1",
      mission_id: "b",
      status: "SUCCESS",
      timestamp: "2026-09-02T10:00:00Z",
    },
    {
      ...dataset.actions[0],
      action_id: "2",
      mission_id: "b",
      status: "FAILED",
      timestamp: "2026-09-02T11:00:00Z",
    },
    {
      ...dataset.actions[0],
      action_id: "3",
      mission_id: "i",
      status: "SUCCESS",
      timestamp: "2026-09-01T10:00:00Z",
    },
    {
      ...dataset.actions[0],
      action_id: "4",
      mission_id: "i",
      status: "DEFINED",
      timestamp: null,
    },
  ],
};

it("orders daily results and calculates rates only from recorded outcomes", () => {
  const result = getDashboardAnalytics(sample, "ALL");
  expect(result.days).toEqual([
    { day: "2026-09-01", passed: 1, failed: 0, rate: 100 },
    { day: "2026-09-02", passed: 1, failed: 1, rate: 50 },
  ]);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.awaiting).toBe(1);
});

it("applies the same configuration filter to all analytics", () => {
  expect(getDashboardAnalytics(sample, "IMPROVED")).toMatchObject({
    passed: 1,
    failed: 0,
    awaiting: 1,
    days: [{ day: "2026-09-01", rate: 100 }],
  });
});

it("keeps undated outcomes in totals without inventing dates", () => {
  const result = getDashboardAnalytics(
    { ...sample, actions: [{ ...sample.actions[0], timestamp: null }] },
    "ALL",
  );
  expect(result.passed).toBe(1);
  expect(result.days).toEqual([]);
  expect(result.undated).toBe(1);
});

it("returns no fabricated rates for an empty selection", () => {
  expect(getDashboardAnalytics(emptyDataset, "ALL")).toMatchObject({
    days: [],
    passed: 0,
    failed: 0,
    awaiting: 0,
    rate: null,
  });
});

it("treats offset-free backend timestamps as UTC, including late-night results", () => {
  const result = getDashboardAnalytics(
    {
      ...sample,
      actions: [{ ...sample.actions[0], timestamp: "2026-09-02T23:30:00" }],
    },
    "ALL",
  );
  expect(result.days[0].day).toBe("2026-09-02");
});

it("traces failures to their location and cause without counting planned checks", () => {
  const actions = [
    { ...sample.actions[0], location_id: "WP01", asset_id: "PUMP-1" },
    {
      ...sample.actions[1],
      location_id: "WP01",
      asset_id: "PUMP-1",
      failure_type: "SENSOR_TIMEOUT",
    },
    {
      ...sample.actions[2],
      location_id: "WP02",
      status: "FAILED",
      failure_type: "PATH_BLOCKED",
    },
    {
      ...sample.actions[3],
      location_id: "WP01",
      failure_type: "SENSOR_TIMEOUT",
    },
  ];
  const result = getDashboardAnalytics({ ...sample, actions }, "BASELINE");
  expect(result.causes).toEqual([
    { cause: "SENSOR_TIMEOUT", count: 1, share: 100 },
  ]);
  expect(result.hotspots).toHaveLength(1);
  expect(result.hotspots[0]).toMatchObject({
    locationId: "WP01",
    failed: 1,
    total: 2,
    rate: 50,
    cause: "SENSOR_TIMEOUT",
    missionId: "b",
  });
  expect(result.weekdays.map((day) => day.count)).toEqual([
    0, 0, 0, 2, 0, 0, 0,
  ]);
});

it("only counts completed missions with every check passed as clean runs", () => {
  const result = getDashboardAnalytics(sample, "ALL");
  expect(result.cleanMissions).toBe(0);
  expect(result.completedMissions).toBe(2);
  expect(getDashboardAnalytics(emptyDataset, "ALL").cleanRate).toBeNull();
});
