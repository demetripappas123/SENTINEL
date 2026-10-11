import { fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import { it, expect } from "@jest/globals";

it("opens evidence and acknowledges a finding in the native review queue", async () => {
  await render(<App />);
  expect(
    screen.getByRole("button", { name: "Attention tab, 15 to review" }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getAllByRole("button", { name: /^Inspect (?!completed)/ })[0],
  );
  expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Mark reviewed" }));
  expect(
    screen.getByRole("button", { name: "Attention tab, 14 to review" }),
  ).toBeTruthy();
});

it("inspects the recorded actions behind a completed mission", async () => {
  await render(<App />);
  await fireEvent.press(screen.getByRole("button", { name: /^Missions tab/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Inspect M015" }));
  expect(screen.getByText("7 / 10 successful")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /A0146/ }));
  expect(screen.getByText("Sensor timeout")).toBeTruthy();
});

it("filters findings and navigates to mission and facility context", async () => {
  await render(<App />);
  await fireEvent.changeText(
    screen.getByLabelText("Search findings"),
    "no such asset",
  );
  expect(screen.getByText("No matching findings")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /^Missions tab/ }));
  expect(screen.getByText("Route 27")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /^Facility tab/ }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Waypoint WP12 Heat Exchanger Area" }),
  );
  expect(
    screen.getByRole("header", { name: "Heat Exchanger Area" }),
  ).toBeTruthy();
});

it("shows findings linked to the selected mission action", async () => {
  await render(<App />);
  await fireEvent.press(screen.getByRole("button", { name: /^Missions tab/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Inspect M015" }));
  await fireEvent.press(screen.getByRole("button", { name: /A0141/ }));
  expect(screen.getByText("Signal degradation")).toBeTruthy();
  expect(screen.getByText("Signal degradation detected.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /A0146/ }));
  expect(screen.queryByText("Signal degradation detected.")).toBeNull();
});

it("shows sign in before the operator console when there is no session", async () => {
  await render(<App requireAuth />);
  expect(await screen.findByRole("header", { name: "Sign in" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Attention tab/ })).toBeNull();
});
