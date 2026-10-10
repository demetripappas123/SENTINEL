"use client";

import { useMemo, useSyncExternalStore } from "react";

const eventName = "sentinel:state";
const fallback = new Map<string, string>();
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", callback);
  };
}
function read(key: string, initial: string, persistent: boolean) {
  try {
    return (persistent ? localStorage : sessionStorage).getItem(key) ?? initial;
  } catch {
    return fallback.get(key) ?? initial;
  }
}
function write(key: string, value: string, persistent = false) {
  try {
    (persistent ? localStorage : sessionStorage).setItem(key, value);
    fallback.delete(key);
  } catch {
    fallback.set(key, value);
  }
  window.dispatchEvent(new Event(eventName));
}
export function useReviews() {
  const raw = useSyncExternalStore(
    subscribe,
    () => read("sentinel:reviews", "[]", false),
    () => "[]",
  );
  const reviewedIds = useMemo(() => {
    try {
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  }, [raw]);
  return {
    reviewedIds,
    markReviewed: (id: string) =>
      write(
        "sentinel:reviews",
        JSON.stringify([...new Set([...reviewedIds, id])]),
      ),
    resetReviews: () => write("sentinel:reviews", "[]"),
  };
}
export function useTheme() {
  const raw = useSyncExternalStore(
    subscribe,
    () => read("sentinel:theme", "light", true),
    () => "light",
  );
  const theme = raw === "dark" ? "dark" : "light";
  return {
    theme,
    toggleTheme: () =>
      write("sentinel:theme", theme === "light" ? "dark" : "light", true),
  };
}
