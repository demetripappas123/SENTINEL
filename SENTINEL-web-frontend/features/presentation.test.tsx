import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { dataset } from "@sentinel/core";
import { AppShell } from "../components/app-shell";
import { FindingDialog } from "../components/findings";
import { InspectionDataProvider } from "../lib/inspection-data";
import { QueueProvider } from "../lib/queue-data";
import { ReviewQueue } from "./review";
import { MissionDetail } from "./mission-detail";
import { MissionTable } from "../components/mission-table";

vi.mock("next/navigation", () => ({ usePathname: () => "/review" }));

it("keeps finding descriptions and illustrative evidence readable", () => {
  render(
    <InspectionDataProvider initial={dataset}>
      <AppShell>
        <FindingDialog
          finding={
            dataset.findings.find((finding) => finding.anomaly_id === "AN014")!
          }
          onClose={() => {}}
          onReview={() => {}}
          reviewed={false}
        />
      </AppShell>
    </InspectionDataProvider>,
  );
  expect(
    screen.getByText("Abnormal temperature detected."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Illustrative inspection sample" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText(/synthetic/i)).toHaveLength(1);
});

it("explains Orbit failures and next steps throughout the review dialog", async () => {
  render(
    <InspectionDataProvider initial={dataset}>
      <QueueProvider
        initial={[
          {
            id: "orbit:A0146",
            mission_id: "M015",
            action_id: "A0146",
            asset_id: "HX-204",
            location_id: "WP09",
            rank: 100,
            cause: "SENSOR_TIMEOUT",
            verdict: "inspection_failure",
            evidence: { mission_status: "COMPLETED" },
            explanation:
              "GAUGE_READING failed: SENSOR_TIMEOUT. Mission M015 is still completed.",
          },
        ]}
      >
        <ReviewQueue />
      </QueueProvider>
    </InspectionDataProvider>,
  );
  await userEvent.type(screen.getByRole("searchbox"), "sensor timeout");
  await userEvent.click(screen.getByRole("button", { name: /Sensor timeout/ }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent(/sensor did not respond/i);
  expect(dialog).toHaveTextContent(/check the sensor connection/i);
  expect(dialog).not.toHaveTextContent("SENSOR_TIMEOUT");
  expect(
    within(dialog).getByRole("link", { name: "Open mission" }),
  ).toHaveAttribute("href", "/missions/M015");
});

it("does not report planned actions as failures", () => {
  const planned = {
    ...dataset,
    actions: [{ ...dataset.actions[0], status: "DEFINED" }],
  };
  render(
    <InspectionDataProvider initial={planned}>
      <MissionDetail missionId={planned.actions[0].mission_id} />
    </InspectionDataProvider>,
  );
  expect(screen.getByText("Failed").parentElement).toHaveTextContent("0");
});

it("does not label unfinished actions as failed in mission summaries", () => {
  const planned = {
    ...dataset,
    actions: [{ ...dataset.actions[0], status: "DEFINED" }],
  };
  render(
    <InspectionDataProvider initial={planned}>
      <MissionTable missions={[dataset.missions[0]]} />
    </InspectionDataProvider>,
  );
  expect(screen.queryByText("1 failed")).not.toBeInTheDocument();
  expect(screen.getByText(/awaiting outcome/i)).toBeInTheDocument();
});

import { Overview } from "./overview";
it("uses recorded outcomes for the action-success indicator as well as its percentage", () => {
  const partial = {
    ...dataset,
    actions: [
      { ...dataset.actions[0], status: "SUCCESS" },
      ...Array.from({ length: 9 }, (_, index) => ({
        ...dataset.actions[0],
        action_id: `planned-${index}`,
        status: "DEFINED",
      })),
    ],
  };
  render(
    <InspectionDataProvider initial={partial}>
      <QueueProvider initial={[]}>
        <Overview />
      </QueueProvider>
    </InspectionDataProvider>,
  );
  const metrics = screen.getByLabelText("Operational metrics");
  expect(
    within(metrics).getByText("Action success").closest(".metric"),
  ).toHaveClass("good");
});

it("renders inspection data with locations absent from the illustrative map", () => {
  const live = {
    ...dataset,
    locations: [
      {
        ...dataset.locations[0],
        location_id: "live-location",
        location_name: "Turbine bay",
      },
    ],
  };
  render(
    <InspectionDataProvider initial={live}>
      <QueueProvider initial={[]}>
        <Overview />
      </QueueProvider>
    </InspectionDataProvider>,
  );
  expect(screen.getByLabelText("Operational metrics")).toBeInTheDocument();
  expect(screen.getByText("Turbine bay")).toBeInTheDocument();
});
