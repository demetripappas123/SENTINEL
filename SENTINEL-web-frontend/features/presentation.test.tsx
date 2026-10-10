import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AppShell } from "../components/app-shell";
import { ReviewQueue } from "./review";
vi.mock("next/navigation", () => ({ usePathname: () => "/review" }));
it("keeps header, finding description and accessible illustration copy clean", async () => {
  render(
    <AppShell>
      <ReviewQueue />
    </AppShell>,
  );
  expect(screen.queryByText(/synthetic/i)).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole("searchbox"), "AN014");
  await userEvent.click(
    screen.getByRole("button", { name: /Abnormal temperature/ }),
  );
  expect(
    screen.getByText("Abnormal temperature detected."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Illustrative inspection sample" }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/synthetic/i)).not.toBeInTheDocument();
});
