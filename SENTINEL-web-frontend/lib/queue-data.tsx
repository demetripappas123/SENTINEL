"use client";
import { createContext, useContext, type ReactNode } from "react";
import { isQueueItem, type QueueItem } from "@sentinel/core/api";
import {
  readyState,
  useApiResource,
  type RequestState,
} from "./use-api-resource";
const emptyQueue: QueueItem[] = [];
const QueueContext = createContext<QueueItem[]>(emptyQueue);
const QueueStateContext = createContext<RequestState>(readyState);
const isQueue = (value: unknown): value is QueueItem[] =>
  Array.isArray(value) && value.every(isQueueItem);
export function QueueProvider({
  initial,
  children,
}: {
  initial?: QueueItem[];
  children: ReactNode;
}) {
  const resource = useApiResource("/api/queue", initial, emptyQueue, isQueue);
  return (
    <QueueStateContext.Provider value={resource}>
      <QueueContext.Provider value={resource.data}>
        {children}
      </QueueContext.Provider>
    </QueueStateContext.Provider>
  );
}
export const useQueue = () => useContext(QueueContext);
export const useQueueState = () => useContext(QueueStateContext);
