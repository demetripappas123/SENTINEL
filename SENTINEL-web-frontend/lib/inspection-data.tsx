"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { emptyDataset, type InspectionDataset } from "@sentinel/core";

const InspectionDataContext = createContext<InspectionDataset>(emptyDataset);
const InspectionReadyContext = createContext(true);
const InspectionDetailContext = createContext(true);

export const pendingCount = "—";
export const pendingRate = "--.-%";

export function InspectionDataProvider({
  initial,
  children,
}: {
  initial?: InspectionDataset;
  children: ReactNode;
}) {
  const [data, setData] = useState<InspectionDataset>(initial ?? emptyDataset);
  const [ready, setReady] = useState(initial !== undefined);
  const [detailReady, setDetailReady] = useState(initial !== undefined);
  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    const apply = (value: InspectionDataset) => {
      if (!cancelled) setData(value);
    };
    fetch("/api/dataset?detail=0")
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then(apply)
      .catch(() => apply(emptyDataset))
      .finally(() => {
        if (!cancelled) setReady(true);
      })
      .then(() => {
        if (cancelled) return null;
        return fetch("/api/dataset");
      })
      .then((response) => {
        if (!response || !response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then(apply)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDetailReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);
  return (
    <InspectionReadyContext.Provider value={ready}>
      <InspectionDetailContext.Provider value={detailReady}>
        <InspectionDataContext.Provider value={data}>
          {children}
        </InspectionDataContext.Provider>
      </InspectionDetailContext.Provider>
    </InspectionReadyContext.Provider>
  );
}

export function useInspectionData(): InspectionDataset {
  return useContext(InspectionDataContext);
}

export function useInspectionReady(): boolean {
  return useContext(InspectionReadyContext);
}

export function useInspectionDetailReady(): boolean {
  return useContext(InspectionDetailContext);
}
