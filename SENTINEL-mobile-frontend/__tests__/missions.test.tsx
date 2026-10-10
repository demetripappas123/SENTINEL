import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { expect, it } from "@jest/globals";
import {
  createFixtureRepository,
  type InspectionDataset,
} from "@sentinel/core";
import App from "../App";
import { createReviewStore } from "../src/state/review-store";
import { MemoryReviewStorage } from "./helpers/review-storage";

async function openMissions(data?: InspectionDataset) {
  const repository = data
    ? { namespace: "missions-test", load: async () => data }
    : createFixtureRepository();
  await render(
    <App
      repository={repository}
      reviewStore={createReviewStore(
        new MemoryReviewStorage(),
        repository.namespace,
      )}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: /^Missions tab/ }));
}

it("keeps configuration metrics and selection when navigating between tabs", async () => {
  await openMissions();
  expect(screen.getByLabelText("27 runs, 26 completed")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Baseline" }));
  expect(screen.getByLabelText("18 runs, 17 completed")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Inspect M027" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: /^Attention tab/ }));
  await fireEvent.press(screen.getByRole("button", { name: /^Missions tab/ }));
  expect(
    screen.getByRole("button", { name: "Baseline", selected: true }),
  ).toBeTruthy();
});

it("shows only the selected action's context, readings and findings", async () => {
  await openMissions();
  await fireEvent.press(screen.getByRole("button", { name: "Inspect M015" }));
  expect(screen.getByText("7 / 10 successful")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /A0141/ }));
  expect(
    screen.getByLabelText("Selected action context").props.accessibilityValue
      .text,
  ).toBe("A0141 · PANEL-203 · WP05 Pipe Gallery");
  expect(screen.getByText("59.5 pct")).toBeTruthy();
  expect(screen.getByText("Signal degradation")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /A0146/ }));
  expect(screen.getByText("Sensor timeout")).toBeTruthy();
  expect(screen.getByText("47%")).toBeTruthy();
  expect(
    screen.getByLabelText("Selected action context").props.accessibilityValue
      .text,
  ).toBe("A0146 · COMP-214 · WP04 Pump Bay");
  expect(screen.getByText("59.8 dB")).toBeTruthy();
  expect(screen.queryByText("59.5 pct")).toBeNull();
  expect(screen.queryByText("Signal degradation")).toBeNull();
});

it("counts failures separately from pending actions and handles a mission without actions", async () => {
  const data = await createFixtureRepository().load();
  const custom = {
    ...data,
    missions: data.missions.filter((m) => m.mission_id === "M015"),
    actions: data.actions
      .filter((a) => a.mission_id === "M015")
      .slice(0, 3)
      .map((a, i) => ({ ...a, status: ["SUCCESS", "FAILED", "PENDING"][i] })),
  };
  await openMissions(custom);
  const card = screen.getByRole("button", { name: "Inspect M015" });
  expect(within(card).getByText("1 failed")).toBeTruthy();
  expect(
    screen.getByLabelText("M015 successful actions").props.accessibilityValue
      .now,
  ).toBe(1);
  await fireEvent.press(card);
  expect(screen.getByText("1 / 3 successful")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /A0143/ }));
  expect(screen.getByText("Pending")).toBeTruthy();
  expect(screen.queryByText("Sensor timeout")).toBeNull();
});

it("keeps zero-action missions inspectable with explicit missing evidence", async () => {
  const fixture = await createFixtureRepository().load();
  await openMissions({
    ...fixture,
    missions: [fixture.missions[0]],
    actions: [],
    readings: [],
    findings: [],
  });
  expect(
    screen.getByLabelText("Action success: 0%, 0 of 0 passed"),
  ).toBeTruthy();
  expect(screen.getByText("No actions recorded.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Inspect M001" }));
  expect(screen.getByText("0 / 0 successful")).toBeTruthy();
  expect(screen.getByText("No action recorded.")).toBeTruthy();
  expect(screen.getByText("No reading recorded.")).toBeTruthy();
});

it("displays repository mission names for IDs that are not route numbers", async () => {
  const data = await createFixtureRepository().load();
  await openMissions({
    ...data,
    missions: [
      {
        ...data.missions[0],
        mission_id: "inspection-east",
        mission_name: "East inspection",
      },
    ],
    actions: [],
    findings: [],
    readings: [],
  });
  expect(screen.getByText("East inspection")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Inspect inspection-east" }),
  );
  expect(screen.getByRole("header", { name: "East inspection" })).toBeTruthy();
});
