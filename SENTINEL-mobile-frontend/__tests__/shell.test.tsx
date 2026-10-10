import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { AccessibilityInfo } from "react-native";
import {
  createFixtureRepository,
  type InspectionDataset,
} from "@sentinel/core";
import App from "../App";
import { createReviewStore } from "../src/state/review-store";
import { deferred, MemoryReviewStorage } from "./helpers/review-storage";

function setup() {
  const storage = new MemoryReviewStorage();
  const repository = createFixtureRepository();
  const reviewStore = createReviewStore(storage, repository.namespace);
  return { storage, repository, reviewStore };
}

describe("native app shell", () => {
  it("waits for saved reviews before showing the initial queue count", async () => {
    const deps = setup();
    await deps.reviewStore.acknowledge("AN014");
    const hydration = deferred<void>();
    deps.storage.beforeRead = () => hydration.promise;
    await render(<App {...deps} />);
    expect(screen.getByLabelText("Loading inspections")).toBeTruthy();
    expect(screen.queryByRole("header", { name: "Attention" })).toBeNull();
    await act(async () => hydration.resolve());
    expect(
      screen.getByRole("button", { name: "Attention tab, 14 to review" }),
    ).toBeTruthy();
  });

  it("shows real loading state until the repository is ready", async () => {
    const deps = setup();
    const pending = deferred<InspectionDataset>();
    await render(
      <App
        {...deps}
        repository={{ ...deps.repository, load: () => pending.promise }}
      />,
    );
    expect(screen.getByLabelText("Loading inspections")).toBeTruthy();
    expect(screen.queryByRole("header", { name: "Attention" })).toBeNull();
    await act(async () => pending.resolve(await deps.repository.load()));
    expect(screen.getByRole("header", { name: "Attention" })).toBeTruthy();
    expect(screen.queryByLabelText("Loading inspections")).toBeNull();
    expect(screen.queryByText(/synthetic/i)).toBeNull();
  });

  it("retries failed loading and renders only records from its repository", async () => {
    const deps = setup();
    const data = await deps.repository.load();
    data.missions = data.missions.filter((m) => m.mission_id === "M015");
    const load = jest
      .fn<() => Promise<InspectionDataset>>()
      .mockRejectedValueOnce(new Error("Connection unavailable"))
      .mockResolvedValue(data);
    await render(<App {...deps} repository={{ ...deps.repository, load }} />);
    expect(
      screen.getByText("Could not load inspection data. Try again."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Missions tab, 1 missions" }),
    );
    expect(screen.getByText("Route 15")).toBeTruthy();
    expect(screen.queryByText("Route 27")).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("announces counted, selected tabs and preserves the finding search", async () => {
    await render(<App {...setup()} />);
    expect(
      screen.getByRole("button", {
        name: "Attention tab, 15 to review",
        selected: true,
      }),
    ).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText("Search findings"),
      "no such asset",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Missions tab, 27 missions" }),
    );
    expect(
      screen.getByRole("button", {
        name: "Missions tab, 27 missions",
        selected: true,
      }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Facility tab, 15 waypoints" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Attention tab, 15 to review" }),
    );
    expect(screen.getByLabelText("Search findings").props.value).toBe(
      "no such asset",
    );
    expect(screen.getByText("No matching findings")).toBeTruthy();
  });

  it("changes appearance while reduced motion is enabled", async () => {
    const motion = jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);
    await render(<App {...setup()} />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Switch to dark appearance" }),
    );
    expect(
      screen.getByRole("button", { name: "Switch to light appearance" }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Open preferences" }),
    );
    expect(
      screen.getByRole("button", { name: "Dark appearance", selected: true }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Light appearance" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Close preferences" }),
    );
    expect(
      screen.getByRole("button", { name: "Switch to dark appearance" }),
    ).toBeTruthy();
    motion.mockRestore();
  });

  it("clears durable reviews only after explicit confirmation", async () => {
    const deps = setup();
    await deps.reviewStore.acknowledge("AN014");
    await render(<App {...deps} />);
    expect(
      screen.getByRole("button", { name: "Attention tab, 14 to review" }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Open preferences" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Reset saved reviews" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Keep reviews" }));
    expect(await deps.reviewStore.load()).toHaveLength(1);
    await fireEvent.press(
      screen.getByRole("button", { name: "Reset saved reviews" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm reset" }),
    );
    expect(await deps.reviewStore.load()).toEqual([]);
    expect(screen.getByText("No saved reviews on this device.")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close preferences" }),
    );
    expect(
      screen.getByRole("button", { name: "Attention tab, 15 to review" }),
    ).toBeTruthy();
  });

  it("keeps saved reviews when reset fails and permits retry", async () => {
    const deps = setup();
    await deps.reviewStore.acknowledge("AN014");
    deps.storage.writeError = new Error("Device storage unavailable");
    await render(<App {...deps} />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Open preferences" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Reset saved reviews" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm reset" }),
    );
    expect(
      screen.getByText("Could not save review changes. Try again."),
    ).toBeTruthy();
    expect(await deps.reviewStore.load()).toHaveLength(1);
    deps.storage.writeError = null;
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm reset" }),
    );
    expect(await deps.reviewStore.load()).toEqual([]);
  });

  it("hydrates saved acknowledgments after the app is reopened", async () => {
    const deps = setup();
    const app = await render(<App {...deps} />);
    await fireEvent.press(
      screen.getAllByRole("button", { name: /^Inspect (?!completed)/ })[0],
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Mark reviewed" }),
    );
    expect(
      screen.getByRole("button", { name: "Attention tab, 14 to review" }),
    ).toBeTruthy();
    await app.unmount();
    await render(
      <App
        {...deps}
        reviewStore={createReviewStore(deps.storage, deps.repository.namespace)}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Attention tab, 14 to review" }),
    ).toBeTruthy();
  });

  it("keeps evidence open when an acknowledgment cannot be saved", async () => {
    const deps = setup();
    deps.storage.writeError = new Error("Disk unavailable");
    await render(<App {...deps} />);
    await fireEvent.press(
      screen.getAllByRole("button", { name: /^Inspect (?!completed)/ })[0],
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Mark reviewed" }),
    );
    expect(
      screen.getByText("Could not save review changes. Try again."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry save" })).toBeTruthy();
    expect(await deps.reviewStore.load()).toEqual([]);
    deps.storage.writeError = null;
    await fireEvent.press(screen.getByRole("button", { name: "Retry save" }));
    expect(
      screen.getByRole("button", { name: "Attention tab, 14 to review" }),
    ).toBeTruthy();
  });
});
