import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { dataset } from "@sentinel/core";
import { InspectionDataProvider } from "../lib/inspection-data";
import { QueueProvider } from "../lib/queue-data";
import Home from "./page";

it("shows fetched mission metrics and a working review link", () => {
  render(
    <InspectionDataProvider initial={dataset}>
      <QueueProvider initial={[]}>
        <Home />
      </QueueProvider>
    </InspectionDataProvider>,
  );
  expect(screen.getByLabelText("Operational metrics")).toHaveTextContent(
    "96.3",
  );
  expect(screen.getByLabelText("Operational metrics")).toHaveTextContent(
    "81.9",
  );
  expect(
    screen.getByRole("link", { name: /Open review queue/ }),
  ).toHaveAttribute("href", "/review?configuration=ALL");
});
