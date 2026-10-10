import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createApiClient, type QueueItem } from "@sentinel/core/api";

const QueueContext = createContext<QueueItem[]>([]);

export function QueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    const baseUrl =
      process.env.EXPO_PUBLIC_SENTINEL_API_URL ?? "http://127.0.0.1:8000";
    createApiClient(baseUrl)
      .getQueue()
      .then((value) => {
        if (!cancelled) setItems(value);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return <QueueContext.Provider value={items}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueItem[] {
  return useContext(QueueContext);
}
