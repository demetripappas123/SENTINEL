import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiQueuePanel } from "./api-queue";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("API queue panel", () => {
  it("loads validated queue records from the configured API URL", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "spot:A0146",
            verdict: "inspection_failure",
            cause: "SENSOR_TIMEOUT",
            explanation: "The inspection produced no reading.",
            mission_id: "M015",
            action_id: "A0146",
            asset_id: "HX-204",
            location_id: "WP05",
            evidence: { battery_pct: 47 },
          },
        ]),
      ),
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
    vi.stubGlobal("fetch", fetcher);

    render(<ApiQueuePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Load queue" }));

    expect(
      await screen.findByText("The inspection produced no reading."),
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/queue",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
    expect(screen.getByText(/"battery_pct": 47/)).toBeInTheDocument();
  });

  it("shows a visible error when the API request fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Database is unavailable" }), {
          status: 503,
        }),
      ),
    );

    render(<ApiQueuePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Load queue" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "SENTINEL API request failed (503)",
      );
    });
  });
});
