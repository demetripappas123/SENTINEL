import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { dataset } from "@sentinel/core";
import { getDashboardAnalytics } from "../lib/dashboard-analytics";
import type { QueueItem } from "@sentinel/core/api";
import { InspectionDataProvider } from "../lib/inspection-data";
import { QueueProvider } from "../lib/queue-data";
import { Overview } from "./overview";
import { ReviewQueue } from "./review";
import { MissionDetail } from "./mission-detail";
import { Facility } from "./facility";
import { Replay } from "./replay";
import { Missions } from "./missions";

const queued: QueueItem[] = [
  {
    id: "kit:A0146",
    verdict: "inspection_failure",
    cause: "SENSOR_TIMEOUT",
    explanation:
      "Gauge reading failed: SENSOR_TIMEOUT. Mission M015 is still completed.",
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
  it("shows an action's evidence when any part of its row is clicked", async () => {
    renderStored(<MissionDetail missionId="M027" />);
    const evidence = () =>
      screen.getByRole("complementary", { name: "Action evidence" });
    const rows = document.querySelectorAll("tr.action-row");
    for (const index of [2, 6]) {
      const cells = rows[index].querySelectorAll("td");
      await userEvent.click(cells[4]);
      expect(rows[index].querySelector("button")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(
        within(evidence()).getByText("Location").nextSibling,
      ).toHaveTextContent(cells[2].textContent!);
    }
  });
  it("opens a mission from anywhere on its row, not just the name", async () => {
    renderStored(<Missions />);
    const link = screen.getByRole("link", { name: "Route 27" });
    let opened = 0;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      opened++;
    });
    const cells = link.closest("tr")!.querySelectorAll("td");
    await userEvent.click(cells[2]);
    await userEvent.click(cells[4]);
    expect(opened).toBe(2);
    await userEvent.click(link);
    expect(opened).toBe(3);
  });
  it("shows the checks recorded on a selected weekday", async () => {
    renderStored(<Overview />);
    const weekdays = getDashboardAnalytics(dataset, "ALL").weekdays;
    const index = weekdays.findIndex((row) => row.count > 0);
    const day = weekdays[index];
    const name = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][index];
    const chart = screen.getByRole("group", {
      name: "Completed checks by weekday",
    });
    const bar = within(chart).getByRole("button", {
      name: `${name}: ${day.count} completed checks`,
    });
    await userEvent.click(bar);
    expect(bar).toHaveAttribute("aria-pressed", "true");
    const detail = screen.getByRole("region", { name: /checks$/ });
    expect(within(detail).getByText("Passed").nextSibling).toHaveTextContent(
      String(day.passed),
    );
    expect(within(detail).getByText("Failed").nextSibling).toHaveTextContent(
      String(day.failed),
    );
    expect(within(detail).getAllByRole("listitem")).toHaveLength(
      Math.min(day.dates.length, 4),
    );
    await userEvent.click(screen.getByRole("button", { name: "All days" }));
    expect(
      screen.queryByRole("region", { name: /checks$/ }),
    ).not.toBeInTheDocument();
  });
  it("changes operational metrics when selecting V2", async () => {
    renderStored(<Overview />);
    await userEvent.click(
      screen.getByRole("radio", { name: "Improved configuration" }),
    );
    expect(screen.getByText("100.0")).toBeInTheDocument();
    expect(screen.getByText("91.1")).toBeInTheDocument();
  });
  it("searches the queue, shows the item, and removes an acknowledged item", async () => {
    renderStored(<ReviewQueue />);
    await userEvent.type(screen.getByRole("searchbox"), "HX-204");
    const row = screen.getByRole("button", {
      name: /Sensor timeout.*Heat Exchanger 04/,
    });
    expect(row).toHaveAccessibleName(/Inspection failure/);
    await userEvent.click(row);
    const detail = screen.getByRole("region", { name: "Review item" });
    expect(within(detail).getByText("Heat Exchanger 04")).toBeInTheDocument();
    expect(
      within(detail).getByRole("link", { name: "Replay" }),
    ).toHaveAttribute("href", "/replay?mission=M015&action=A0146");
    await userEvent.click(
      within(detail).getByRole("button", { name: "Mark reviewed" }),
    );
    expect(screen.getByText("No matching queue items")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reviewed" }));
    expect(
      screen.getByRole("button", { name: /Sensor timeout.*Heat Exchanger 04/ }),
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
    await userEvent.click(
      screen.getByRole("button", {
        name: /Acoustic inspection check 6 at Pump Bay/,
      }),
    );
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
  it("opens a waypoint asset and links through to its findings", async () => {
    renderStored(<Facility />);
    await userEvent.click(
      screen.getByRole("button", { name: "View asset Heat Exchanger 01" }),
    );
    const asset = screen.getByRole("dialog", { name: "Heat Exchanger 01" });
    expect(within(asset).getByText("Latest readings")).toBeInTheDocument();
    const findings = within(asset).getAllByRole("button", {
      name: /Heat Exchanger 01/,
    });
    await userEvent.click(findings[0]);
    expect(
      screen.queryByRole("dialog", { name: "Heat Exchanger 01" }),
    ).not.toBeInTheDocument();
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
      screen.queryByRole("button", {
        name: /Signal degradation.*Electrical Panel 03/,
      }),
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
    expect(screen.getAllByText("Route 19").length).toBeGreaterThan(0);
    expect(screen.getByText("1 / 104")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveAttribute("max", "103");
    expect(screen.getByRole("slider")).toHaveValue("0");
    expect(
      screen.getByRole("button", { name: "Play replay" }),
    ).toBeInTheDocument();
  });
  it("shows only findings linked to the selected mission action", async () => {
    renderStored(<MissionDetail missionId="M015" />);
    await userEvent.click(screen.getByRole("button", { name: /check 1 at/ }));
    const evidence = screen.getByRole("complementary", {
      name: "Action evidence",
    });
    expect(
      within(evidence).getByText("Signal degradation"),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByText("Signal degradation detected."),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: /Acoustic inspection check 6 at Pump Bay/,
      }),
    );
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
    expect(screen.getByText(/ends during Route 23/)).toBeInTheDocument();
  });
});

it("jumps the replay to the next recorded failure and shows where it happened", async () => {
  renderStored(<Replay />);
  await userEvent.click(screen.getByRole("button", { name: "Next failure" }));
  const now = screen.getByRole("complementary", { name: "Current event" });
  expect(within(now).getAllByText("Action failed")[0].tagName).toBe("STRONG");
  expect(within(now).getByText(/\(WP\d+\)/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Previous failure" }),
  ).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Next failure" }));
  expect(
    screen.getByRole("button", { name: "Previous failure" }),
  ).toBeEnabled();
});

it("opens the replay at a linked mission action", () => {
  renderStored(<Replay initialMission="M015" initialAction="A0146" />);
  expect(screen.getByRole("combobox", { name: "Mission" })).toHaveValue("M015");
  const now = screen.getByRole("complementary", { name: "Current event" });
  expect(within(now).getAllByText("Action failed")[0].tagName).toBe("STRONG");
});

it("summarises missions in one readout and one V1 against V2 board", () => {
  renderStored(<Missions />);
  expect(
    screen.getByRole("region", { name: "Interpretation" }),
  ).toHaveTextContent(/largest mission issue/i);
  expect(
    screen.getByRole("region", { name: "V1 against V2" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("table", { name: /failed actions by cause/i }),
  ).toBeInTheDocument();
});

it("filters dashboard charts and links review priorities to the selected configuration", async () => {
  renderStored(<Overview />);
  expect(
    screen.getByRole("img", { name: /daily action success/i }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Review breakdown")).toHaveTextContent(
    "1 inspection to retry",
  );
  await userEvent.click(
    screen.getByRole("radio", { name: "Improved configuration" }),
  );
  expect(screen.getByLabelText("Review breakdown")).toHaveTextContent(
    "0 inspections to retry",
  );
  expect(
    screen.getByRole("link", { name: /open review queue/i }),
  ).toHaveAttribute("href", "/review?configuration=V2");
});
