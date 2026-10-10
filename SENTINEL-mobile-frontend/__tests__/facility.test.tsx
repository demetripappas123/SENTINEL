import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { expect, it } from "@jest/globals";
import {
  createFixtureRepository,
  type InspectionDataset,
} from "@sentinel/core";
import App from "../App";
import { createReviewStore } from "../src/state/review-store";
import { MemoryReviewStorage } from "./helpers/review-storage";

async function openFacility(data?: InspectionDataset) {
  const repository = data
    ? { namespace: "facility-test", load: async () => data }
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
  await fireEvent.press(screen.getByRole("button", { name: /^Facility tab/ }));
}

it("defaults to WP05 and keeps pin/list selections synchronized across floor changes", async () => {
  await openFacility();
  expect(
    screen.getAllByRole("button", { name: /^Map waypoint / }),
  ).toHaveLength(15);
  expect(
    screen.getByRole("button", {
      name: "Map waypoint WP05 Pipe Gallery",
      selected: true,
    }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Waypoint WP12 Heat Exchanger Area" }),
  );
  expect(
    screen.getByRole("button", {
      name: "Map waypoint WP12 Heat Exchanger Area",
      selected: true,
    }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Choose floor" }));
  await fireEvent.press(screen.getByRole("button", { name: "Floor 1" }));
  expect(
    screen.getAllByRole("button", { name: /^Map waypoint / }),
  ).toHaveLength(10);
  expect(
    screen.queryByRole("button", { name: "Waypoint WP12 Heat Exchanger Area" }),
  ).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Map waypoint WP05 Pipe Gallery" }),
  );
  expect(
    screen.getByRole("button", {
      name: "Waypoint WP05 Pipe Gallery",
      selected: true,
    }),
  ).toBeTruthy();
});

it("retains total findings when reviewing location evidence and scopes counts by dates", async () => {
  await openFacility();
  expect(
    screen.getByLabelText("Selected waypoint finding counts").props
      .accessibilityValue.text,
  ).toBe("8 findings, 1 to review");
  await fireEvent.press(
    screen.getAllByRole("button", { name: /^Inspect location finding / })[0],
  );
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  expect(
    screen.getByLabelText("Selected waypoint finding counts").props
      .accessibilityValue.text,
  ).toBe("8 findings, 0 to review");
  await fireEvent.press(screen.getByRole("button", { name: /^Attention tab/ }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Choose mission dates" }),
  );
  await fireEvent.changeText(screen.getByLabelText("Start date"), "2026-09-10");
  await fireEvent.changeText(screen.getByLabelText("End date"), "2026-09-10");
  await fireEvent.press(screen.getByRole("button", { name: "Apply dates" }));
  await fireEvent.press(screen.getByRole("button", { name: /^Facility tab/ }));
  expect(
    screen.getByLabelText("Selected waypoint finding counts").props
      .accessibilityValue.text,
  ).toBe("0 findings, 0 to review");
});

it("keeps a waypoint with an unknown display position accessible in the list", async () => {
  const data = await createFixtureRepository().load();
  await openFacility({
    ...data,
    locations: [
      {
        ...data.locations[0],
        location_id: "WP99",
        location_name: "Roof access",
      },
    ],
  });
  expect(screen.queryByRole("button", { name: /^Map waypoint / })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Waypoint WP99 Roof access" }),
  );
  expect(screen.getByRole("header", { name: "Roof access" })).toBeTruthy();
  expect(screen.getByText("Map position unavailable for WP99.")).toBeTruthy();
});

it("handles no locations and falls back if the selected waypoint disappears on refresh", async () => {
  const data = await createFixtureRepository().load();
  let current = data;
  const repository = {
    namespace: "facility-refresh",
    load: async () => current,
  };
  await render(
    <App
      repository={repository}
      reviewStore={createReviewStore(
        new MemoryReviewStorage(),
        repository.namespace,
      )}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: /^Facility tab/ }));
  current = { ...data, locations: [] };
  const refresh =
    screen.getByLabelText("facility content").props.refreshControl.props
      .onRefresh;
  await act(async () => {
    await refresh();
  });
  expect(screen.getByText("No waypoints available.")).toBeTruthy();
  expect(
    screen.queryByLabelText("Selected waypoint finding counts"),
  ).toBeNull();
});

it("clears a floor filter removed by refresh so remaining waypoints stay visible", async () => {
  const fixture = await createFixtureRepository().load();
  let current = fixture;
  const repository = { namespace: "floor-refresh", load: async () => current };
  await render(
    <App
      repository={repository}
      reviewStore={createReviewStore(
        new MemoryReviewStorage(),
        repository.namespace,
      )}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: /^Facility tab/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Choose floor" }));
  await fireEvent.press(screen.getByRole("button", { name: "Floor 1" }));
  current = {
    ...fixture,
    locations: fixture.locations.filter((l) => l.floor === 2),
  };
  await act(async () => {
    await screen
      .getByLabelText("facility content")
      .props.refreshControl.props.onRefresh();
  });
  expect(screen.queryByText("No waypoints available.")).toBeNull();
  expect(
    screen.getByRole("button", {
      name: "Map waypoint WP11 Battery Room",
      selected: true,
    }),
  ).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: /^Map waypoint / }),
  ).toHaveLength(5);
});
