import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  validateDateRange,
  type DateRange,
  type InspectionDataset,
  type InspectionRepository,
} from "@sentinel/core";
import type { ReviewRecord, ReviewStore } from "./review-store";

interface InspectionState {
  data: InspectionDataset | null;
  reviews: ReviewRecord[];
  loading: boolean;
  error: string | null;
  reviewError: string | null;
  reviewStorageReady: boolean;
  saving: boolean;
  range: DateRange;
}

interface InspectionContextValue extends InspectionState {
  setRange(range: DateRange): void;
  refresh(): Promise<void>;
  acknowledge(findingId: string): Promise<void>;
  undo(findingId: string): Promise<void>;
  resetReviews(): Promise<void>;
}

const initialState: InspectionState = {
  data: null,
  reviews: [],
  loading: true,
  error: null,
  reviewError: null,
  reviewStorageReady: false,
  saving: false,
  range: null,
};
const InspectionContext = createContext<InspectionContextValue | null>(null);

export function InspectionProvider({
  repository,
  reviewStore,
  children,
}: {
  repository: InspectionRepository;
  reviewStore: ReviewStore;
  children: ReactNode;
}) {
  const [state, setState] = useState(initialState);
  const latest = useRef(state);
  const active = useRef(false);
  const session = useRef(0);
  const loadRequest = useRef(0);
  const reviewRevision = useRef(0);
  const reviewsReady = useRef(false);
  const pendingWrites = useRef(0);

  const update = useCallback((patch: Partial<InspectionState>) => {
    latest.current = { ...latest.current, ...patch };
    setState(latest.current);
  }, []);

  const refresh = useCallback(async () => {
    const request = ++loadRequest.current;
    const sourceSession = session.current;
    const revision = reviewRevision.current;
    const isCurrent = () =>
      active.current &&
      session.current === sourceSession &&
      loadRequest.current === request;
    update({ loading: true, error: null });

    // Publish each result independently: a slow dataset load must not later
    // replace a review that was successfully saved while the load was running.
    await Promise.all([
      Promise.resolve()
        .then(() => repository.load())
        .then(
          (data) => {
            if (isCurrent()) update({ data, error: null });
          },
          () => {
            if (isCurrent())
              update({ error: "Could not load inspection data. Try again." });
          },
        ),
      Promise.resolve()
        .then(() => reviewStore.load())
        .then(
          (reviews) => {
            if (!isCurrent() || revision !== reviewRevision.current) return;
            reviewsReady.current = true;
            update({ reviews, reviewError: null, reviewStorageReady: true });
          },
          () => {
            if (!isCurrent()) return;
            reviewsReady.current = false;
            update({
              reviewStorageReady: false,
              reviewError:
                "Could not load saved reviews. Retry or reset local reviews.",
            });
          },
        ),
    ]);
    if (isCurrent()) update({ loading: false });
  }, [repository, reviewStore, update]);

  useEffect(() => {
    active.current = true;
    session.current += 1;
    reviewsReady.current = false;
    pendingWrites.current = 0;
    update(initialState);
    void refresh();
    return () => {
      active.current = false;
      session.current += 1;
      loadRequest.current += 1;
    };
  }, [refresh, update]);

  const changeReview = useCallback(
    async (operation: "acknowledge" | "undo" | "reset", findingId = "") => {
      if (!active.current || latest.current.loading) {
        throw new Error("Wait for inspection data and saved reviews to load.");
      }
      if (
        operation !== "reset" &&
        (!reviewsReady.current || !latest.current.data)
      ) {
        throw new Error("Reload saved reviews before changing review state.");
      }
      if (
        operation === "acknowledge" &&
        !latest.current.data?.findings.some(
          (finding) => finding.anomaly_id === findingId,
        )
      ) {
        throw new Error("This finding is no longer available.");
      }
      const sourceSession = session.current;
      const isCurrent = () =>
        active.current && session.current === sourceSession;
      pendingWrites.current += 1;
      update({ saving: true });
      try {
        const reviews =
          operation === "reset"
            ? await reviewStore.reset()
            : await reviewStore[operation](findingId);
        if (isCurrent()) {
          reviewRevision.current += 1;
          reviewsReady.current = true;
          update({ reviews, reviewError: null, reviewStorageReady: true });
        }
      } catch (error) {
        if (isCurrent())
          update({ reviewError: "Could not save review changes. Try again." });
        // Callers close their sheet only after success, and render reviewError on failure.
        throw error;
      } finally {
        if (isCurrent()) {
          pendingWrites.current -= 1;
          update({ saving: pendingWrites.current > 0 });
        }
      }
    },
    [reviewStore, update],
  );

  const setRange = useCallback(
    (range: DateRange) => {
      validateDateRange(range);
      update({ range });
    },
    [update],
  );
  const acknowledge = useCallback(
    (id: string) => changeReview("acknowledge", id),
    [changeReview],
  );
  const undo = useCallback(
    (id: string) => changeReview("undo", id),
    [changeReview],
  );
  const resetReviews = useCallback(() => changeReview("reset"), [changeReview]);
  const value = useMemo(
    () => ({
      ...state,
      setRange,
      refresh,
      acknowledge,
      undo,
      resetReviews,
    }),
    [state, setRange, refresh, acknowledge, undo, resetReviews],
  );

  return (
    <InspectionContext.Provider value={value}>
      {children}
    </InspectionContext.Provider>
  );
}

export function useInspection(): InspectionContextValue {
  const value = useContext(InspectionContext);
  if (!value)
    throw new Error("useInspection must be used within InspectionProvider.");
  return value;
}
