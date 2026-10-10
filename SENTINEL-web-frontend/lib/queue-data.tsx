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

export function QueueProvider({
  initial,
  children,
}: {
  initial?: QueueItem[];
  children: ReactNode;
}) {
  const [items, setItems] = useState<QueueItem[]>(initial ?? []);
  useEffect(() => {
    if (initial) return;
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
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);
  return <QueueContext.Provider value={items}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueItem[] {
  return useContext(QueueContext);
}
