import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dataset } from "@sentinel/core";
import type { QueueItem } from "@sentinel/core/api";
import { InspectionDataProvider } from "../lib/inspection-data";
import { QueueProvider } from "../lib/queue-data";
import { Overview } from "./overview";
import { ReviewQueue } from "./review";
import { MissionDetail } from "./mission-detail";
import { Facility } from "./facility";
import { Replay } from "./replay";

const queued: QueueItem[] = [
  {
    id: "kit:A0146",
    verdict: "inspection_failure",
    cause: "SENSOR_TIMEOUT",
    explanation: "Gauge reading failed: SENSOR_TIMEOUT. Mission M015 is still completed.",
    mission_id: "M015",
    action_id: "A0146",
    asset_id: "HX-204",
    location_id: "WP09",
    rank: 100,
    evidence: {},
  },
];

function renderStored(ui: ReactNode) {
  return render(
    <InspectionDataProvider initial={dataset}>
      <QueueProvider initial={queued}>{ui}</QueueProvider>
    </InspectionDataProvider>,
  );
}

describe("dashboard workflows", () => {
  it("shows a loading state instead of zero counts before data arrives", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    render(
      <InspectionDataProvider>
        <QueueProvider>
          <Overview />
        </QueueProvider>
      </InspectionDataProvider>,
    );
    expect(screen.getByRole("region", { name: "Operational metrics" })).toBeInTheDocument();
    expect(screen.getAllByText("--.-%").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("changes operational metrics when selecting V2", async () => {
    renderStored(<Overview />);
    await userEvent.click(
      screen.getByRole("radio", { name: "Improved configuration" }),
    );
    expect(screen.getByText("100.0")).toBeInTheDocument();
    expect(screen.getByText("91.1")).toBeInTheDocument();
  });
  it("searches the queue, opens the item, and removes an acknowledged item", async () => {
    renderStored(<ReviewQueue />);
    await userEvent.type(screen.getByRole("searchbox"), "HX-204");
    const row = screen.getByRole("button", {
      name: /Sensor timeout.*HX-204/,
    });
    expect(row).toHaveAccessibleName(/Inspection failure/);
    await userEvent.click(row);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Heat Exchanger 04")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Mark reviewed" }),
    );
    expect(screen.getByText("No matching queue items")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reviewed" }));
    expect(
      screen.getByRole("button", { name: /Sensor timeout.*HX-204/ }),
    ).toBeInTheDocument();
  });
  it("shows an empty state when a search does not match", async () => {
    renderStored(<ReviewQueue />);
    await userEvent.type(screen.getByRole("searchbox"), "does not exist");
    expect(screen.getByText("No matching queue items")).toBeInTheDocument();
  });
  it("shows the selected action's recorded failure and battery", async () => {
    renderStored(<MissionDetail missionId="M015" />);
    expect(screen.getByText("7 / 10 successful")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /A0146/ }));
    const evidence = screen.getByRole("complementary", {
      name: "Action evidence",
    });
    expect(within(evidence).getByText("Sensor timeout")).toBeInTheDocument();
    expect(within(evidence).getByText("47%")).toBeInTheDocument();
  });
  it("selects a waypoint and shows its location context", async () => {
    renderStored(<Facility />);
    await userEvent.click(
      screen.getByRole("button", { name: /^WP12 Heat Exchanger Area/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Heat Exchanger Area" }),
    ).toBeInTheDocument();
  });
  it("filters waypoint statistics and findings by configuration", async () => {
    renderStored(<Facility />);
    expect(screen.getByText("43")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("radio", { name: "Improved configuration" }),
    );
    expect(screen.queryByText("43")).not.toBeInTheDocument();
    expect(screen.getByText("Actions").parentElement).toHaveTextContent("9");
    expect(screen.getByText("Findings").parentElement).toHaveTextContent("1");
    expect(
      screen.queryByRole("button", { name: /Signal degradation.*PANEL-203/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^WP05/ })).toHaveTextContent(
      "1 failed",
    );
  });
  it("resets replay to the selected configuration's recorded events", async () => {
    renderStored(<Replay />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "499" } });
    await userEvent.click(
      screen.getByRole("radio", { name: "Improved configuration" }),
    );
    expect(screen.getAllByText("M019").length).toBeGreaterThan(0);
    expect(screen.getByText("1 / 104")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveAttribute("max", "103");
    expect(screen.getByRole("slider")).toHaveValue("0");
    expect(
      screen.getByRole("button", { name: "Play replay" }),
    ).toBeInTheDocument();
  });
  it("shows only findings linked to the selected mission action", async () => {
    renderStored(<MissionDetail missionId="M015" />);
    await userEvent.click(screen.getByRole("button", { name: /A0141/ }));
    const evidence = screen.getByRole("complementary", {
      name: "Action evidence",
    });
    expect(
      within(evidence).getByText("Signal degradation"),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByText("Signal degradation detected."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /A0146/ }));
    expect(
      within(evidence).queryByText("Signal degradation"),
    ).not.toBeInTheDocument();
  });
  it("scrubs recorded events and identifies the partial replay", async () => {
    renderStored(<Replay />);
    const slider = screen.getByRole("slider");
    // Keyboard control must update the same recorded position as pointer input.
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    // jsdom does not implement native range keyboard behavior; exercise its input boundary.
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(slider, { target: { value: "15" } });
    expect(screen.getByText("16 / 500")).toBeInTheDocument();
    expect(screen.getByText(/ends during M023/)).toBeInTheDocument();
  });
});
