"use client";
import { useEffect, useState } from "react";

export type RequestState = {
  status: "loading" | "ready" | "error";
  retry: () => void;
};
export const readyState: RequestState = { status: "ready", retry: () => {} };

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
  useEffect(() => {
    if (initial !== undefined) return;
    if (window.location.pathname === "/login") return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request failed");
        const value: unknown = await response.json();
        if (!valid(value)) throw new Error("Invalid response");
        if (!cancelled) {
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
  const retry = () => {
    setStatus("loading");
    setAttempt((value) => value + 1);
  };
  return { data, status, retry };
}
