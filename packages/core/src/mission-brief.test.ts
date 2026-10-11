import { describe, expect, it } from "vitest";
import type { QueueItem } from "./api/client";
import { missionBrief } from "./mission-brief";
import type { InspectionDataset } from "./types";

const data: InspectionDataset = {
  missions: [
    mission("M1", "V1", "COMPLETED", 20),
    mission("M2", "V1", "COMPLETED", 22),
    mission("M3", "V1", "COMPLETED", 21),
    mission("M4", "V1", "COMPLETED", 40),
    mission("M5", "V2", "FAILED", 18),
  ],
  actions: [
    action("A1", "M1", "FAILED", "OBSTACLE_DETECTION", "WP05", 30),
    action("A2", "M2", "FAILED", "OBSTACLE_DETECTION", "WP01", 80),
    action("A3", "M3", "FAILED", "SENSOR_TIMEOUT", "WP09", 70),
    action("A4", "M1", "SUCCESS", "", "WP02", 80),
    action("A5", "M5", "SUCCESS", "", "WP02", 90),
    action("A6", "M5", "SUCCESS", "", "WP03", 90),
  ],
  findings: [],
  assets: [],
  locations: [],
  readings: [],
  events: [],
};

const queue: QueueItem[] = [
  item("kit:A1", "inspection_failure", "OBSTACLE_DETECTION", "M1", "A1", "FAILED"),
  item("kit:A2", "inspection_failure", "OBSTACLE_DETECTION", "M2", "A2", "FAILED", {
    asset_criticality: "CRITICAL",
  }),
  item("kit:A3", "inspection_failure", "QUESTIONABLE_READING", "M3", "A3", "SUCCESS"),
  item("kit:A4", "equipment_finding", "TEMPERATURE_C", "M1", "A4", "SUCCESS"),
  item("kit:A5", "unsupported_claim", "ABNORMAL_TEMPERATURE", "M5", "A5", "SUCCESS"),
];

describe("mission brief", () => {
  it("counts failure types, issue kinds, and the rules that fired", () => {
    const brief = missionBrief(data, queue);
    expect(brief.failureTypes.map((bar) => bar.key)).toEqual([
      "OBSTACLE_DETECTION",
      "SENSOR_TIMEOUT",
    ]);
    expect(brief.issues).toEqual([
      { key: "failed_action", count: 2 },
      { key: "bad_reading", count: 1 },
      { key: "anomaly_with_evidence", count: 1 },
      { key: "potential_anomaly", count: 0 },
      { key: "anomaly_without_evidence", count: 1 },
    ]);
    const text = [
      brief.interpretation.lead,
      ...brief.interpretation.steps,
      ...brief.interpretation.notes,
    ].join(" ");
    expect(brief.interpretation.lead).toMatch(/Failed Action, 2 of 5/);
    expect(brief.interpretation.lead).toMatch(/Obstacle Detection \(2\) and Sensor Timeout \(1\)/);
    expect(text).toMatch(/below 40% battery/);
    expect(text).toMatch(/completed missions still contain/);
    expect(text).toMatch(/outside the other readings/);
    expect(text).toMatch(/not backed by a good reading/);
    expect(text).toMatch(/questionable/);
    expect(text).toMatch(/critical asset/);
    expect(text).toMatch(/M4 ran 40 min/);
    expect(text).toMatch(/V2 action success/);
  });
});

function mission(
  mission_id: string,
  configuration_version: string,
  mission_status: string,
  duration_min: number,
) {
  return {
    mission_id,
    mission_name: mission_id,
    configuration_version,
    start_time: null,
    end_time: null,
    duration_min,
    start_battery_pct: null,
    end_battery_pct: null,
    mission_status,
  };
}

function action(
  action_id: string,
  mission_id: string,
  status: string,
  failure_type: string,
  location_id: string,
  battery_pct: number,
) {
  return {
    action_id,
    mission_id,
    sequence: 1,
    timestamp: null,
    location_id,
    asset_id: "HX-1",
    action_type: "NAVIGATION",
    battery_pct,
    status,
    failure_type,
    duration_sec: 10,
    configuration_version: mission_id === "M5" ? "V2" : "V1",
  };
}

function item(
  id: string,
  verdict: QueueItem["verdict"],
  cause: string,
  mission_id: string,
  action_id: string,
  action_status: string,
  evidence: QueueItem["evidence"] = {},
): QueueItem {
  return {
    id,
    verdict,
    cause,
    explanation: cause,
    mission_id,
    action_id,
    asset_id: "HX-1",
    location_id: "WP01",
    rank: 100,
    evidence: { action_status, ...evidence },
  };
}
