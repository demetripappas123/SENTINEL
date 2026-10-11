"use client";
import { useEffect, useRef, useState } from "react";

export type RequestState = {
  status: "loading" | "ready" | "error";
  retry: () => void;
};
export const readyState: RequestState = { status: "ready", retry: () => {} };

// New results (a retried inspection that now passes, a fresh mission) are
// written by ingest at any time, so screens re-check quietly while open.
const refreshInterval = 15_000;

export function useApiResource<T>(
  url: string,
  initial: T | undefined,
  empty: T,
  valid: (value: unknown) => value is T,
) {
  const [data, setData] = useState(initial ?? empty);
  const [status, setStatus] = useState<RequestState["status"]>(
    initial === undefined ? "loading" : "ready",
  );
  const [attempt, setAttempt] = useState(0);
  // The last response body, so an unchanged refresh doesn't re-render.
  const body = useRef<string | null>(null);
  useEffect(() => {
    if (initial !== undefined) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request failed");
        const text = await response.text();
        const value: unknown = JSON.parse(text);
        if (!valid(value)) throw new Error("Invalid response");
        if (!cancelled) {
          body.current = text;
          setData(value);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [url, initial, valid, attempt]);
  useEffect(() => {
    if (initial !== undefined || status !== "ready") return;
    let controller: AbortController | null = null;
    // A failed refresh keeps the last good data on screen; the next one retries.
    const refresh = () => {
      if (controller || document.visibilityState === "hidden") return;
      const current = (controller = new AbortController());
      const timeout = setTimeout(() => current.abort(), 15_000);
      fetch(url, { signal: current.signal, cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const text = await response.text();
          if (text === body.current) return;
          const value: unknown = JSON.parse(text);
          if (!valid(value) || current.signal.aborted) return;
          body.current = text;
          setData(value);
        })
        .catch(() => {})
        .finally(() => {
          clearTimeout(timeout);
          if (controller === current) controller = null;
        });
    };
    const interval = setInterval(refresh, refreshInterval);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      controller?.abort();
    };
  }, [url, initial, valid, status]);
  const retry = () => {
    setStatus("loading");
    setAttempt((value) => value + 1);
  };
  return { data, status, retry };
}
