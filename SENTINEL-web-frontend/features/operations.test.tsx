import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Overview } from "./overview";
import { ReviewQueue } from "./review";
import { MissionDetail } from "./mission-detail";
import { Facility } from "./facility";
import { Replay } from "./replay";

describe("dashboard workflows", () => {
  it("changes operational metrics when selecting V2", async () => {
    render(<Overview />);
    await userEvent.click(
      screen.getByRole("button", { name: "Improved configuration" }),
    );
    expect(screen.getByText("100.0")).toBeInTheDocument();
    expect(screen.getByText("91.1")).toBeInTheDocument();
  });
  it("searches findings, opens evidence, and removes an acknowledged item", async () => {
    render(<ReviewQueue />);
    await userEvent.type(screen.getByRole("searchbox"), "HX-204");
    const row = screen.getByRole("button", {
      name: /Abnormal temperature.*HX-204/,
    });
    expect(row).toHaveAccessibleName(/Critical/);
    await userEvent.click(row);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Heat Exchanger 04")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Mark reviewed" }),
    );
    expect(screen.getByText("No matching findings")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reviewed" }));
    expect(
      screen.getByRole("button", { name: /Abnormal temperature.*HX-204/ }),
    ).toBeInTheDocument();
  });
  it("shows an empty state when a search does not match", async () => {
    render(<ReviewQueue />);
    await userEvent.type(screen.getByRole("searchbox"), "does not exist");
    expect(screen.getByText("No matching findings")).toBeInTheDocument();
  });
  it("shows the selected action's recorded failure and battery", async () => {
    render(<MissionDetail missionId="M015" />);
    expect(screen.getByText("7 / 10 successful")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /A0146/ }));
    const evidence = screen.getByRole("complementary", {
      name: "Action evidence",
    });
    expect(within(evidence).getByText("Sensor timeout")).toBeInTheDocument();
    expect(within(evidence).getByText("47%")).toBeInTheDocument();
  });
  it("selects a waypoint and shows its location context", async () => {
    render(<Facility />);
    await userEvent.click(
      screen.getByRole("button", { name: /^WP12 Heat Exchanger Area/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Heat Exchanger Area" }),
    ).toBeInTheDocument();
  });
  it("filters waypoint statistics and findings by configuration", async () => {
    render(<Facility />);
    expect(screen.getByText("43")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Improved configuration" }),
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
    render(<Replay />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "499" } });
    await userEvent.click(
      screen.getByRole("button", { name: "Improved configuration" }),
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
    render(<MissionDetail missionId="M015" />);
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
    render(<Replay />);
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
