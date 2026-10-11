import { describe, expect, it, vi } from "vitest";
import challenge from "../data/challenge.json";
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
  rank: 140,
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
    [{ ...item, rank: undefined }],
    [{ ...item, rank: "140" }],
  ])("rejects a malformed queue response %#", async (body) => {
    await expect(
      createApiClient("http://localhost:8000", response(body)).getQueue(),
    ).rejects.toThrow("Invalid queue response");
  });
  it("reads operational metrics from the API", async () => {
    const body = {
      versions: [],
      inspections: [],
      locations: [],
      battery: [],
      missions: {
        mission_count: 27,
        completed_count: 26,
        completed_with_failures: 21,
        failed_mission_ids: ["M017"],
      },
    };
    const fetcher = response(body);
    expect(await createApiClient("http://localhost:8000", fetcher).getMetrics()).toEqual(body);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/metrics",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });
  it("rejects an unhealthy response", async () => {
    await expect(
      createApiClient(
        "http://localhost:8000",
        response({ status: "offline" }),
      ).getHealth(),
    ).rejects.toThrow("Invalid health response");
  });

  it("uses the global fetch current at request time, not at creation", async () => {
    const original = globalThis.fetch;
    const client = createApiClient("http://localhost:8000");
    const replaced = response({ status: "ok" });
    globalThis.fetch = replaced;
    try {
      await client.getHealth();
      expect(replaced).toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });

  describe("dataset", () => {
    const dataset = { ...challenge, events: [] };

    it("reads the kit dataset from a base URL with a trailing slash", async () => {
      const fetcher = response(dataset);
      expect(
        await createApiClient("http://localhost:8000/", fetcher).getDataset(),
      ).toEqual(dataset);
      expect(fetcher).toHaveBeenCalledWith(
        "http://localhost:8000/dataset?source=kit",
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
    });
    it("loads kit, orbit, and spot together", async () => {
      const empty = {
        missions: [],
        actions: [],
        findings: [],
        assets: [],
        locations: [],
        readings: [],
        events: [],
      };
      const fetcher = vi.fn<typeof fetch>(async (input) => {
        const source = new URL(String(input)).searchParams.get("source");
        return new Response(
          JSON.stringify(source === "orbit" ? dataset : empty),
          { status: 200 },
        );
      });
      const live = await createApiClient(
        "http://localhost:8000",
        fetcher,
      ).getLiveDataset();
      expect(live.missions).toEqual(dataset.missions);
      expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual([
        "http://localhost:8000/dataset?source=kit",
        "http://localhost:8000/dataset?source=orbit",
        "http://localhost:8000/dataset?source=spot",
      ]);
    });
    it("accepts a mission that has not received kit-only fields", async () => {
      const partial = {
        ...dataset,
        missions: [
          {
            ...challenge.missions[0],
            scenario: null,
            configuration_version: null,
            duration_min: null,
            start_battery_pct: null,
            end_battery_pct: null,
          },
        ],
      };
      await expect(
        createApiClient("http://localhost:8000", response(partial)).getDataset(
          "orbit",
        ),
      ).resolves.toEqual(partial);
    });
    it("exposes server errors rather than an empty dataset", async () => {
      await expect(
        createApiClient(
          "http://localhost:8000",
          response({}, 503),
        ).getDataset(),
      ).rejects.toThrow("503");
    });
    it.each([
      ["a missing collection", { ...dataset, readings: undefined }],
      ["a collection that is not a list", { ...dataset, missions: {} }],
      [
        "a mission with a missing field",
        {
          ...dataset,
          missions: [{ ...challenge.missions[0], mission_name: undefined }],
        },
      ],
      [
        "an action with a mistyped field",
        { ...dataset, actions: [{ ...challenge.actions[0], sequence: "1" }] },
      ],
      [
        "a finding with a string flag",
        {
          ...dataset,
          findings: [
            { ...challenge.findings[0], operator_review_required: "true" },
          ],
        },
      ],
      [
        "an event with nested details",
        {
          ...dataset,
          events: [
            { ...challenge.events[0], details: { battery: { pct: 1 } } },
          ],
        },
      ],
      ["a null record", { ...dataset, assets: [null] }],
    ])("rejects %s", async (_, body) => {
      await expect(
        createApiClient("http://localhost:8000", response(body)).getDataset(),
      ).rejects.toThrow("Invalid dataset response");
    });
  });
});
