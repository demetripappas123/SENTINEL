import type { ReviewStorage } from "../../src/state/review-store";

/** Storage boundary double; all review logic runs in the real store. */
export class MemoryReviewStorage implements ReviewStorage {
  values = new Map<string, string>();
  readError: Error | null = null;
  writeError: Error | null = null;
  beforeRead: (() => Promise<void>) | null = null;
  beforeWrite: (() => Promise<void>) | null = null;

  async getItem(key: string) {
    await this.beforeRead?.();
    if (this.readError) throw this.readError;
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    await this.beforeWrite?.();
    if (this.writeError) throw this.writeError;
    this.values.set(key, value);
  }
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
