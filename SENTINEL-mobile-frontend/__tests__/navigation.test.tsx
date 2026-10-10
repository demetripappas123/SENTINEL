import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { expect, it, jest } from "@jest/globals";
import { createFixtureRepository } from "@sentinel/core";
import App from "../App";
import { createReviewStore } from "../src/state/review-store";
import { MemoryReviewStorage } from "./helpers/review-storage";

function deps() {
  const repository = createFixtureRepository();
  return {
    repository,
    reviewStore: createReviewStore(
      new MemoryReviewStorage(),
      repository.namespace,
    ),
  };
}
it("opens linked finding evidence after repository hydration", async () => {
  jest
    .spyOn(Linking, "getInitialURL")
    .mockResolvedValue("com.sentinel.inspections://findings/AN014");
  await render(<App {...deps()} />);
  expect(screen.getByText(/M020 · WP07/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeTruthy();
});
it("handles later screen links and ignores other hosts and missing records", async () => {
  let onURL: (event: { url: string }) => void = () => {};
  // Native event delivery is the boundary; route parsing and navigation stay real.
  jest
    .spyOn(Linking, "addEventListener")
    .mockImplementation((_event, listener) => {
      onURL = listener;
      return { remove: () => {} } as ReturnType<
        typeof Linking.addEventListener
      >;
    });
  await render(<App {...deps()} />);
  await act(() =>
    onURL({ url: "com.sentinel.inspections://missions/M015?action=A0146" }),
  );
  expect(screen.getByText("Sensor timeout")).toBeTruthy();
  expect(screen.getByText("47%")).toBeTruthy();
  await act(() =>
    onURL({ url: "com.sentinel.inspections://missions/M015?action=A0141" }),
  );
  expect(screen.getByText("59.5 pct")).toBeTruthy();
  expect(screen.queryByText("59.8 dB")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: /A0146/ }));
  await act(() =>
    onURL({ url: "com.sentinel.inspections://missions/M015?action=A0141" }),
  );
  expect(screen.getByText("59.5 pct")).toBeTruthy();
  expect(screen.queryByText("59.8 dB")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  await act(() => onURL({ url: "https://example.com/facility" }));
  expect(
    screen.getByRole("button", { name: /^Missions tab/, selected: true }),
  ).toBeTruthy();
  await act(() =>
    onURL({ url: "com.sentinel.inspections://findings/unknown" }),
  );
  expect(screen.queryByRole("button", { name: "Mark reviewed" })).toBeNull();
  await act(() => onURL({ url: "com.sentinel.inspections://facility" }));
  expect(
    screen.getByRole("button", { name: /^Facility tab/, selected: true }),
  ).toBeTruthy();
});
