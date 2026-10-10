import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Home from "./page";

it("shows real mission completion and action success rather than the starter page", () => {
  render(<Home />);
  expect(screen.getByText("96.3")).toBeInTheDocument();
  expect(screen.getByText("81.9")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Review/ })).toHaveAttribute(
    "href",
    "/review",
  );
});
