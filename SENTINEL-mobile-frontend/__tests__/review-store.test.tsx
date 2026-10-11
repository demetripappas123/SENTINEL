import { describe, expect, it } from "@jest/globals";
import { dataset, getFindings } from "@sentinel/core";
import { createReviewStore } from "../src/state/review-store";
import { deferred, MemoryReviewStorage } from "./helpers/review-storage";

const timestamp = "2026-10-10T12:00:00.000Z";
const key = "sentinel:reviews:v1:challenge-v1";
const makeStore = (storage: MemoryReviewStorage, namespace = "challenge-v1") =>
  createReviewStore(storage, namespace, () => timestamp);

describe("durable review acknowledgment", () => {
  it("survives restart and Undo without changing finding severity or evidence", async () => {
    const storage = new MemoryReviewStorage();
    const store = makeStore(storage);
    const original = JSON.stringify(dataset);
    expect(await store.load()).toEqual([]);
    const reviewed = await store.acknowledge("AN014");
    expect(reviewed).toEqual([{ findingId: "AN014", reviewedAt: timestamp }]);
    expect(
      getFindings(dataset, { reviewedIds: reviewed.map((r) => r.findingId) }),
    ).toHaveLength(14);
    const restarted = makeStore(storage);
    expect(await restarted.load()).toEqual(reviewed);
    const undone = await restarted.undo("AN014");
    expect(undone).toEqual([]);
    expect(
      getFindings(dataset, { reviewedIds: undone.map((r) => r.findingId) }),
    ).toHaveLength(15);
    expect(await makeStore(storage).load()).toEqual([]);
    expect(JSON.stringify(dataset)).toBe(original);
  });

  it("keeps the original timestamp on duplicate acknowledgments", async () => {
    const storage = new MemoryReviewStorage();
    await makeStore(storage).acknowledge("AN014");
    const store = createReviewStore(
      storage,
      "challenge-v1",
      () => "2026-10-11T12:00:00.000Z",
    );
    expect(await store.acknowledge("AN014")).toEqual([
      { findingId: "AN014", reviewedAt: timestamp },
    ]);
  });

  it("isolates fixture reviews from another data source", async () => {
    const storage = new MemoryReviewStorage();
    await makeStore(storage).acknowledge("AN014");
    expect(await makeStore(storage, "api-site-a").load()).toEqual([]);
    await makeStore(storage, "api-site-a").acknowledge("AN027");
    expect((await makeStore(storage).load()).map((r) => r.findingId)).toEqual([
      "AN014",
    ]);
  });

  it("serializes overlapping writes and loads so records cannot overwrite each other", async () => {
    const storage = new MemoryReviewStorage();
    const gate = deferred<void>();
    storage.beforeWrite = () => gate.promise;
    const store = makeStore(storage);
    const first = store.acknowledge("AN014");
    const second = store.acknowledge("AN027");
    const read = store.load();
    gate.resolve();
    await Promise.all([first, second]);
    expect((await read).map((r) => r.findingId)).toEqual(["AN014", "AN027"]);
    expect((await makeStore(storage).load()).map((r) => r.findingId)).toEqual([
      "AN014",
      "AN027",
    ]);
  });

  it("retains stored history after failed save and permits a successful retry", async () => {
    const storage = new MemoryReviewStorage();
    const store = makeStore(storage);
    await store.acknowledge("AN014");
    storage.writeError = new Error("Disk full");
    await expect(store.acknowledge("AN027")).rejects.toThrow("Disk full");
    expect((await store.load()).map((r) => r.findingId)).toEqual(["AN014"]);
    storage.writeError = null;
    expect((await store.acknowledge("AN027")).map((r) => r.findingId)).toEqual([
      "AN014",
      "AN027",
    ]);
  });

  it("leaves a review acknowledged when Undo cannot be persisted", async () => {
    const storage = new MemoryReviewStorage();
    const store = makeStore(storage);
    await store.acknowledge("AN014");
    storage.writeError = new Error("Disk full");
    await expect(store.undo("AN014")).rejects.toThrow();
    expect((await store.load()).map((r) => r.findingId)).toEqual(["AN014"]);
  });

  it("does not overwrite saved history when storage cannot be read", async () => {
    const storage = new MemoryReviewStorage();
    const store = makeStore(storage);
    await store.acknowledge("AN014");
    const before = storage.values.get(key);
    storage.readError = new Error("Storage unavailable");
    await expect(store.load()).rejects.toThrow();
    await expect(store.acknowledge("AN027")).rejects.toThrow();
    expect(storage.values.get(key)).toBe(before);
    storage.readError = null;
    expect((await store.load()).map((r) => r.findingId)).toEqual(["AN014"]);
  });

  it.each([
    "not json",
    "{}",
    '[{"findingId":"AN014"}]',
    '[{"findingId":"","reviewedAt":"2026-10-10T12:00:00.000Z"}]',
    '[{"findingId":"AN014","reviewedAt":"invalid"}]',
  ])("rejects malformed saved data without overwriting it: %s", async (raw) => {
    const storage = new MemoryReviewStorage();
    storage.values.set(key, raw);
    const store = makeStore(storage);
    await expect(store.load()).rejects.toThrow();
    await expect(store.acknowledge("AN027")).rejects.toThrow();
    await expect(store.undo("AN014")).rejects.toThrow();
    expect(storage.values.get(key)).toBe(raw);
    expect(await store.reset()).toEqual([]);
    expect(await store.load()).toEqual([]);
  });

  it("isolates returned records from later store operations", async () => {
    const storage = new MemoryReviewStorage();
    const store = makeStore(storage);
    const result = await store.acknowledge("AN014");
    result[0].findingId = "modified";
    expect((await store.load()).map((r) => r.findingId)).toEqual(["AN014"]);
  });
});
