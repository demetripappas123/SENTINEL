import { fireEvent, render, screen, act } from "@testing-library/react-native";
import { expect, it, jest } from "@jest/globals";
import { Linking } from "react-native";
import { createFixtureRepository } from "@sentinel/core";
import App from "../App";
import { createReviewStore } from "../src/state/review-store";
import { MemoryReviewStorage } from "./helpers/review-storage";

function deps() {
  const repository = createFixtureRepository();
  const storage = new MemoryReviewStorage();
  return {
    repository,
    reviewStore: createReviewStore(storage, repository.namespace),
  };
}

it("renders dataset metrics and lets severity charts filter the finding queue", async () => {
  await render(<App {...deps()} />);
  expect(
    screen.getByLabelText("Action success: 81.9%, 221 of 270 passed"),
  ).toBeTruthy();
  expect(
    screen.getByLabelText("Mission completion: 96.3%, 26 of 27 completed"),
  ).toBeTruthy();
  expect(screen.getByLabelText("40 total findings")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Filter Critical findings" }),
  );
  expect(
    screen.getByRole("button", { name: "Clear Critical filter" }),
  ).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Search findings"), "AN005");
  expect(screen.getByText("No matching findings")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Clear Critical filter" }),
  );
  expect(
    screen.getByRole("button", { name: /Inspect Abnormal vibration HX-202/ }),
  ).toBeTruthy();
});

it("opens the first matching review and supports durable undo without removing severity", async () => {
  const state = deps();
  await render(<App {...state} />);
  await fireEvent.press(screen.getByRole("button", { name: "Review queue" }));
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  expect(await state.reviewStore.load()).toHaveLength(1);
  await fireEvent.press(screen.getByRole("button", { name: "Reviewed" }));
  expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
  await fireEvent.press(
    screen.getAllByRole("button", { name: /^Inspect (?!completed)/ })[0],
  );
  await fireEvent.press(screen.getByRole("button", { name: "Undo review" }));
  expect(await state.reviewStore.load()).toEqual([]);
  expect(
    screen.getByRole("button", { name: "Attention tab, 15 to review" }),
  ).toBeTruthy();
});

it("routes the failed-actions warning to only completed missions with failed actions", async () => {
  await render(<App {...deps()} />);
  await fireEvent.press(
    screen.getByRole("button", {
      name: "Inspect completed missions with failed actions",
    }),
  );
  expect(
    screen.getByRole("button", { name: "Clear completed missions filter" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Inspect M015" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Inspect M017" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Clear completed missions filter" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Improved" }));
  expect(screen.getByRole("button", { name: "Inspect M027" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Inspect M015" })).toBeNull();
});

it("synchronizes map pins, waypoint details, and floor filters", async () => {
  await render(<App {...deps()} />);
  await fireEvent.press(screen.getByRole("button", { name: /^Facility tab/ }));
  expect(
    screen.getByRole("button", {
      name: "Map waypoint WP05 Pipe Gallery",
      selected: true,
    }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", {
      name: "Map waypoint WP12 Heat Exchanger Area",
    }),
  );
  expect(
    screen.getByRole("header", { name: "Heat Exchanger Area" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", {
      name: "Waypoint WP12 Heat Exchanger Area",
      selected: true,
    }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Choose floor" }));
  await fireEvent.press(screen.getByRole("button", { name: "Floor 1" }));
  expect(
    screen.queryByRole("button", {
      name: "Map waypoint WP12 Heat Exchanger Area",
    }),
  ).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Waypoint WP05 Pipe Gallery" }),
  );
  expect(
    screen.getByRole("button", {
      name: "Map waypoint WP05 Pipe Gallery",
      selected: true,
    }),
  ).toBeTruthy();
  expect(screen.getByText(/Floor 1 · High noise/)).toBeTruthy();
});

it("keeps location finding totals unchanged after acknowledgment", async () => {
  const state = deps();
  await render(<App {...state} />);
  await fireEvent.press(screen.getByRole("button", { name: /^Facility tab/ }));
  const before = screen.getByLabelText("Selected waypoint finding counts").props
    .accessibilityValue.text;
  await fireEvent.press(
    screen.getAllByRole("button", { name: /^Inspect location finding / })[0],
  );
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  const after = screen.getByLabelText("Selected waypoint finding counts").props
    .accessibilityValue.text;
  expect(before).toBe("8 findings, 1 to review");
  expect(after).toBe("8 findings, 0 to review");
});

it("rejects reversed dates and scopes all tab summaries using mission dates", async () => {
  await render(<App {...deps()} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Choose mission dates" }),
  );
  await fireEvent.changeText(screen.getByLabelText("Start date"), "2026-09-10");
  await fireEvent.changeText(screen.getByLabelText("End date"), "2026-09-01");
  await fireEvent.press(screen.getByRole("button", { name: "Apply dates" }));
  expect(screen.getByRole("alert")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("End date"), "2026-09-10");
  await fireEvent.press(screen.getByRole("button", { name: "Apply dates" }));
  expect(
    screen.getByRole("button", { name: "Missions tab, 2 missions" }),
  ).toBeTruthy();
});

it("opens a supported screen from an app link and ignores an unrelated URL", async () => {
  jest
    .spyOn(Linking, "getInitialURL")
    .mockResolvedValue("com.sentinel.inspections://facility");
  await render(<App {...deps()} />);
  expect(
    screen.getByRole("button", { name: /^Facility tab/, selected: true }),
  ).toBeTruthy();
});
