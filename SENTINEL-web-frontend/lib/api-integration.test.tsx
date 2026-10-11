import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { dataset, emptyDataset } from "@sentinel/core";
import { GET as datasetGET } from "../app/api/dataset/route";
import { GET as queueGET } from "../app/api/queue/route";
import { AppShell } from "../components/app-shell";
import { Overview } from "../features/overview";
import { InspectionDataProvider } from "./inspection-data";
import { QueueProvider } from "./queue-data";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
// Route handlers read the session cookie, which only exists inside a request.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
afterEach(() => vi.unstubAllGlobals());

const orbit = {
  ...emptyDataset,
  missions: [
    {
      ...dataset.missions[0],
      mission_id: "orbit-run-1",
      mission_name: "Orbit: Boiler inspection",
      scenario: null,
      configuration_version: null,
      start_time: "2026-10-10T12:00:00",
      end_time: null,
      mission_status: "IN_PROGRESS",
      duration_min: null,
    },
  ],
  actions: [
    {
      ...dataset.actions[0],
      action_id: "orbit-action-1",
      mission_id: "orbit-run-1",
      status: "FAILED",
      failure_type: "SENSOR_TIMEOUT",
      timestamp: "2026-10-10T12:01:00",
      scenario: null,
    },
  ],
};

it("renders backend records through the real Next routes, API client, and providers", async () => {
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input === "/api/dataset") return datasetGET();
      if (input === "/api/queue") return queueGET();
      const path = new URL(input).pathname + new URL(input).search;
      requests.push(path);
      if (path === "/dataset?source=orbit") return Response.json(orbit);
      if (path === "/dataset?source=kit" || path === "/dataset?source=spot")
        return Response.json(emptyDataset);
      if (path === "/queue")
        return Response.json([
          {
            id: "orbit:orbit-action-1",
            mission_id: "orbit-run-1",
            action_id: "orbit-action-1",
            verdict: "inspection_failure",
            cause: "SENSOR_TIMEOUT",
            rank: 100,
            evidence: {},
            explanation: "GAUGE_READING failed: SENSOR_TIMEOUT.",
          },
        ]);
      throw new Error("Unexpected API URL: " + path);
    }),
  );
  render(
    <InspectionDataProvider>
      <QueueProvider>
        <AppShell>
          <Overview />
        </AppShell>
      </QueueProvider>
    </InspectionDataProvider>,
  );
  const metrics = await screen.findByLabelText("Operational metrics");
  // The sidebar links to the Orbit settings page; source names must not leak into content.
  expect(screen.getByRole("main")).not.toHaveTextContent(/orbit|SENSOR_TIMEOUT|raw data/i);
  expect(metrics).toHaveTextContent("0 / 1 recorded outcomes passed");
  expect(screen.getByLabelText("Review breakdown")).toHaveTextContent(
    "1 inspection to retry",
  );
  expect(
    screen.getAllByText(/check the sensor connection/i).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getByRole("link", { name: "Boiler inspection" }),
  ).toHaveAttribute("href", "/missions/orbit-run-1");
  expect(requests.sort()).toEqual([
    "/dataset?source=kit",
    "/dataset?source=orbit",
    "/dataset?source=spot",
    "/queue",
  ]);
  expect(within(metrics).queryByText("SENSOR_TIMEOUT")).not.toBeInTheDocument();
});

it("propagates an upstream source failure as 503 rather than partial success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) =>
      new URL(input).search === "?source=orbit"
        ? Response.json({ error: "unavailable" }, { status: 503 })
        : Response.json(emptyDataset),
    ),
  );
  const response = await datasetGET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Dataset is unavailable" });
});
