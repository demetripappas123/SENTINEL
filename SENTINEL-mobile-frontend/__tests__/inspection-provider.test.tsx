import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react-native";
import { describe, expect, it } from "@jest/globals";
import {
  createFixtureRepository,
  getFindings,
  type InspectionDataset,
  type InspectionRepository,
} from "@sentinel/core";
import {
  InspectionProvider,
  useInspection,
} from "../src/state/inspection-provider";
import { createReviewStore } from "../src/state/review-store";
import { deferred, MemoryReviewStorage } from "./helpers/review-storage";

async function mount(
  storage = new MemoryReviewStorage(),
  repository: InspectionRepository = createFixtureRepository(),
) {
  const store = createReviewStore(storage, repository.namespace);
  const view = await renderHook(() => useInspection(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <InspectionProvider repository={repository} reviewStore={store}>
        {children}
      </InspectionProvider>
    ),
  });
  return { ...view, storage, store };
}

describe("inspection state", () => {
  it("waits for saved reviews before permitting acknowledgment", async () => {
    const storage = new MemoryReviewStorage();
    const gate = deferred<void>();
    storage.beforeRead = () => gate.promise;
    const { result, store } = await mount(storage);
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await expect(result.current.acknowledge("AN014")).rejects.toThrow();
    });
    await act(async () => {
      gate.resolve();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.missions).toHaveLength(27);
    expect(await store.load()).toEqual([]);
  });

  it("publishes a review only after the write completes and retains it after remount", async () => {
    const { result, storage, unmount } = await mount();
    const gate = deferred<void>();
    storage.beforeWrite = () => gate.promise;
    let save!: Promise<void>;
    await act(() => {
      save = result.current.acknowledge("AN014");
    });
    expect(result.current.saving).toBe(true);
    expect(result.current.reviews).toEqual([]);
    await act(async () => {
      gate.resolve();
      await save;
    });
    expect(result.current.saving).toBe(false);
    expect(result.current.reviews.map((r) => r.findingId)).toEqual(["AN014"]);
    expect(
      getFindings(result.current.data!, { reviewedIds: ["AN014"] }),
    ).toHaveLength(14);
    await unmount();
    const restarted = await mount(storage);
    expect(restarted.result.current.reviews.map((r) => r.findingId)).toEqual([
      "AN014",
    ]);
    await act(async () => {
      await restarted.result.current.undo("AN014");
    });
    expect(restarted.result.current.reviews).toEqual([]);
    expect(await restarted.store.load()).toEqual([]);
    expect(getFindings(restarted.result.current.data!)).toHaveLength(15);
    expect(restarted.result.current.data!.findings).toHaveLength(40);
  });

  it("shows a failed save without acknowledging the finding and allows Retry", async () => {
    const { result, storage } = await mount();
    storage.writeError = new Error("Disk full");
    await act(async () => {
      await expect(result.current.acknowledge("AN014")).rejects.toThrow();
    });
    expect(result.current.reviews).toEqual([]);
    expect(result.current.reviewError).toBeTruthy();
    expect(result.current.saving).toBe(false);
    storage.writeError = null;
    await act(async () => {
      await result.current.acknowledge("AN014");
    });
    expect(result.current.reviews.map((r) => r.findingId)).toEqual(["AN014"]);
    expect(result.current.reviewError).toBeNull();
  });

  it("keeps acknowledgment when Undo fails and persists a later successful Undo", async () => {
    const { result, storage } = await mount();
    await act(async () => {
      await result.current.acknowledge("AN014");
    });
    storage.writeError = new Error("Disk full");
    await act(async () => {
      await expect(result.current.undo("AN014")).rejects.toThrow();
    });
    expect(result.current.reviews.map((r) => r.findingId)).toEqual(["AN014"]);
    expect(result.current.reviewError).toBeTruthy();
    storage.writeError = null;
    await act(async () => {
      await result.current.undo("AN014");
    });
    expect(result.current.reviews).toEqual([]);
  });

  it("blocks writes after review hydration fails while still exposing inspection data", async () => {
    const storage = new MemoryReviewStorage();
    storage.readError = new Error("Unavailable");
    const { result } = await mount(storage);
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.findings).toHaveLength(40);
    expect(result.current.error).toBeNull();
    expect(result.current.reviewError).toBeTruthy();
    await act(async () => {
      await expect(result.current.acknowledge("AN014")).rejects.toThrow();
    });
    expect(storage.values.size).toBe(0);
    storage.readError = null;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.reviewError).toBeNull();
    await act(async () => {
      await result.current.acknowledge("AN014");
    });
    expect(result.current.reviews).toHaveLength(1);
  });

  it("recovers corrupt reviews only through explicit reset or successful reload", async () => {
    const storage = new MemoryReviewStorage();
    const key = "sentinel:reviews:v1:challenge-v1";
    storage.values.set(key, "corrupt history");
    const { result } = await mount(storage);
    expect(result.current.reviewError).toBeTruthy();
    await act(async () => {
      await expect(result.current.acknowledge("AN014")).rejects.toThrow();
    });
    expect(storage.values.get(key)).toBe("corrupt history");
    await act(async () => {
      await result.current.resetReviews();
    });
    expect(result.current.reviewError).toBeNull();
    await act(async () => {
      await result.current.acknowledge("AN014");
    });
    expect(result.current.reviews).toHaveLength(1);
  });

  it("reports repository failure and clears it when Retry succeeds", async () => {
    const fixture = createFixtureRepository();
    let fail = true;
    const repository = {
      ...fixture,
      load: async () => {
        if (fail) throw new Error("Unavailable");
        return fixture.load();
      },
    };
    const { result } = await mount(new MemoryReviewStorage(), repository);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.loading).toBe(false);
    fail = false;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.data?.missions).toHaveLength(27);
  });

  it("preserves saved reviews and date selection through refresh", async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.setRange({ start: "2026-09-01", end: "2026-09-02" });
      await result.current.acknowledge("AN014");
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.reviews.map((r) => r.findingId)).toEqual(["AN014"]);
    expect(result.current.range).toEqual({
      start: "2026-09-01",
      end: "2026-09-02",
    });
    expect(result.current.data?.missions).toHaveLength(27);
  });

  it("rejects invalid ranges without replacing the current date selection", async () => {
    const { result } = await mount();
    await act(() => {
      expect(() =>
        result.current.setRange({ start: "2026-09-03", end: "2026-09-01" }),
      ).toThrow(RangeError);
    });
    expect(result.current.range).toBeNull();
  });

  it("keeps the newest dataset when earlier refresh requests finish later", async () => {
    const fixture = createFixtureRepository();
    const first = deferred<InspectionDataset>();
    const second = deferred<InspectionDataset>();
    let calls = 0;
    const repository = {
      ...fixture,
      load: () => {
        calls += 1;
        return calls === 1
          ? fixture.load()
          : calls === 2
            ? first.promise
            : second.promise;
      },
    };
    const { result } = await mount(new MemoryReviewStorage(), repository);
    let older!: Promise<void>, newer!: Promise<void>;
    await act(() => {
      older = result.current.refresh();
      newer = result.current.refresh();
    });
    const empty = { ...(await fixture.load()), missions: [] };
    await act(async () => {
      second.resolve(empty);
      await newer;
    });
    expect(result.current.data?.missions).toHaveLength(0);
    expect(result.current.loading).toBe(false);
    await act(async () => {
      first.resolve(await fixture.load());
      await older;
    });
    expect(result.current.data?.missions).toHaveLength(0);
  });

  it("does not lose an in-flight acknowledgment when refreshing", async () => {
    const { result, storage } = await mount();
    const gate = deferred<void>();
    storage.beforeWrite = () => gate.promise;
    let save!: Promise<void>, refresh!: Promise<void>;
    await act(() => {
      save = result.current.acknowledge("AN014");
    });
    await act(() => {
      refresh = result.current.refresh();
    });
    await act(async () => {
      gate.resolve();
      await Promise.all([save, refresh]);
    });
    expect(result.current.reviews.map((r) => r.findingId)).toEqual(["AN014"]);
    expect(result.current.saving).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("rejects acknowledgments for findings outside the loaded dataset", async () => {
    const { result, store } = await mount();
    await act(async () => {
      await expect(result.current.acknowledge("missing")).rejects.toThrow();
    });
    expect(await store.load()).toEqual([]);
  });
});
