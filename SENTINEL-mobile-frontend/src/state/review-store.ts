export interface ReviewRecord {
  findingId: string;
  reviewedAt: string;
}

export interface ReviewStore {
  load(): Promise<ReviewRecord[]>;
  acknowledge(findingId: string): Promise<ReviewRecord[]>;
  undo(findingId: string): Promise<ReviewRecord[]>;
  reset(): Promise<ReviewRecord[]>;
}

export interface ReviewStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function parseReviews(raw: string | null): ReviewRecord[] {
  if (raw === null) return [];
  const invalid = () =>
    new Error("Saved reviews are unreadable. Retry or reset local reviews.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalid();
  }
  if (!Array.isArray(value)) throw invalid();
  const ids = new Set<string>();
  return value.map((record: unknown) => {
    if (typeof record !== "object" || record === null) throw invalid();
    const { findingId, reviewedAt } = record as Partial<ReviewRecord>;
    if (
      typeof findingId !== "string" ||
      !findingId.trim() ||
      ids.has(findingId) ||
      typeof reviewedAt !== "string" ||
      !Number.isFinite(Date.parse(reviewedAt))
    )
      throw invalid();
    ids.add(findingId);
    return { findingId, reviewedAt };
  });
}

export function createReviewStore(
  storage: ReviewStorage,
  namespace: string,
  now: () => string = () => new Date().toISOString(),
): ReviewStore {
  const key = `sentinel:reviews:v1:${namespace}`;
  let queue: Promise<unknown> = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    // A failed operation must not prevent a later Retry or explicit reset.
    queue = result.catch(() => undefined);
    return result;
  }

  const read = async () => parseReviews(await storage.getItem(key));
  const write = async (reviews: ReviewRecord[]) => {
    await storage.setItem(key, JSON.stringify(reviews));
    return reviews;
  };

  return {
    load: () => serialize(read),
    acknowledge: (findingId) =>
      serialize(async () => {
        const reviews = await read();
        if (reviews.some((review) => review.findingId === findingId))
          return reviews;
        return write([...reviews, { findingId, reviewedAt: now() }]);
      }),
    undo: (findingId) =>
      serialize(async () => {
        const reviews = await read();
        const next = reviews.filter((review) => review.findingId !== findingId);
        return next.length === reviews.length ? reviews : write(next);
      }),
    // Explicit reset is the only operation allowed to replace unreadable history.
    reset: () => serialize(() => write([])),
  };
}
