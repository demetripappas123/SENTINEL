"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { QueueItem } from "@sentinel/core/api";

const QueueContext = createContext<QueueItem[]>([]);
const QueueReadyContext = createContext(true);

export function QueueProvider({
  initial,
  children,
}: {
  initial?: QueueItem[];
  children: ReactNode;
}) {
  const [items, setItems] = useState<QueueItem[]>(initial ?? []);
  const [ready, setReady] = useState(initial !== undefined);
  useEffect(() => {
    if (initial !== undefined) return;
    let cancelled = false;
    fetch("/api/queue")
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((value: QueueItem[]) => {
        if (!cancelled) setItems(value);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);
  return (
    <QueueReadyContext.Provider value={ready}>
      <QueueContext.Provider value={items}>{children}</QueueContext.Provider>
    </QueueReadyContext.Provider>
  );
}

export function useQueue(): QueueItem[] {
  return useContext(QueueContext);
}

export function useQueueReady(): boolean {
  return useContext(QueueReadyContext);
}
