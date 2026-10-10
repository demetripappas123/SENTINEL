import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Home from "./page";

it("shows real mission completion and action success rather than the starter page", () => {
  render(<Home />);
  expect(screen.getAllByText("0.0").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole("link", { name: /Review/ })).toHaveAttribute(
    "href",
    "/review",
  );
});
