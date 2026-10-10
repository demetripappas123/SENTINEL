import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";

const item = {
  id: "Q1",
  verdict: "inspection_failure",
  cause: "SENSOR_TIMEOUT",
  explanation: "No reading",
  mission_id: "M015",
  action_id: "A0146",
  asset_id: null,
  location_id: "WP05",
  evidence: { battery_pct: 47 },
};
const response = (body: unknown, status = 200) =>
  vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("initial FastAPI client", () => {
  it("uses the configured queue endpoint and returns validated records", async () => {
    const fetcher = response([item]);
    expect(
      await createApiClient("http://localhost:8000/", fetcher).getQueue(),
    ).toEqual([item]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/queue",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });
  it("supports a health check and an empty queue", async () => {
    expect(
      await createApiClient(
        "http://localhost:8000",
        response({ status: "ok" }),
      ).getHealth(),
    ).toEqual({ status: "ok" });
    expect(
      await createApiClient("http://localhost:8000", response([])).getQueue(),
    ).toEqual([]);
  });
  it("exposes server errors rather than pretending the queue is empty", async () => {
    await expect(
      createApiClient("http://localhost:8000", response({}, 503)).getQueue(),
    ).rejects.toThrow("503");
  });
  it.each([
    {},
    [null],
    [{ ...item, verdict: "unknown" }],
    [{ ...item, verdict: ["inspection_failure"] }],
    [{ ...item, verdict: { value: "inspection_failure" } }],
    [{ ...item, mission_id: 17 }],
    [{ ...item, evidence: [] }],
  ])("rejects a malformed queue response %#", async (body) => {
    await expect(
      createApiClient("http://localhost:8000", response(body)).getQueue(),
    ).rejects.toThrow("Invalid queue response");
  });
  it("rejects an unhealthy response", async () => {
    await expect(
      createApiClient(
        "http://localhost:8000",
        response({ status: "offline" }),
      ).getHealth(),
    ).rejects.toThrow("Invalid health response");
  });
});
