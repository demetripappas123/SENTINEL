import { fireEvent, render, screen } from "@testing-library/react-native";
import { expect, it } from "@jest/globals";
import {
  createFixtureRepository,
  type InspectionDataset,
} from "@sentinel/core";
import App from "../App";
import { createReviewStore } from "../src/state/review-store";
import { MemoryReviewStorage } from "./helpers/review-storage";

export function testDependencies(data?: InspectionDataset) {
  const fixture = createFixtureRepository();
  const repository = data
    ? { namespace: "test", load: async () => data }
    : fixture;
  const storage = new MemoryReviewStorage();
  return {
    repository,
    storage,
    reviewStore: createReviewStore(storage, repository.namespace),
  };
}

it("combines severity, type, search and review status without changing summaries", async () => {
  await render(<App {...testDependencies()} />);
  expect(screen.getByLabelText("15 to review, 4 critical")).toBeTruthy();
  expect(screen.getByLabelText("40 total findings")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Filter Critical findings" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Filter Thermal findings" }),
  );
  await fireEvent.changeText(screen.getByLabelText("Search findings"), "AN014");
  expect(
    screen.getAllByRole("button", { name: /^Inspect Abnormal/ }),
  ).toHaveLength(1);
  await fireEvent.press(screen.getByRole("button", { name: "Review queue" }));
  expect(screen.getByText(/M020 · WP07/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  await fireEvent.changeText(
    screen.getByLabelText("Search findings"),
    "does not exist",
  );
  expect(screen.getByText("No matching findings")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Review queue" }).props
      .accessibilityState.disabled,
  ).toBe(true);
  expect(screen.getByLabelText("40 total findings")).toBeTruthy();
});

it("rejects invalid dates, scopes summaries and resets to all dates", async () => {
  await render(<App {...testDependencies()} />);
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
  await fireEvent.press(
    screen.getByRole("button", { name: "Choose mission dates" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "All dates" }));
  expect(
    screen.getByRole("button", { name: "Missions tab, 27 missions" }),
  ).toBeTruthy();
});

it("keeps empty datasets usable with zero metrics", async () => {
  await render(
    <App
      {...testDependencies({
        missions: [],
        actions: [],
        readings: [],
        findings: [],
        events: [],
        assets: [],
        locations: [],
      })}
    />,
  );
  expect(screen.getByLabelText("0 to review, 0 critical")).toBeTruthy();
  expect(
    screen.getByLabelText("Action success: 0%, 0 of 0 passed"),
  ).toBeTruthy();
  expect(screen.getByText("No matching findings")).toBeTruthy();
});

it("filters the queue when a severity chart sector is tapped", async () => {
  await render(<App {...testDependencies()} />);
  await fireEvent.press(screen.getByLabelText("Critical chart segment"));
  expect(
    screen.getByRole("button", { name: "Clear Critical filter" }),
  ).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: /^Inspect (?!completed)/ }),
  ).toHaveLength(4);
});
