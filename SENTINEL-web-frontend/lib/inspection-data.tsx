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

export function InspectionDataProvider({
  initial,
  children,
}: {
  initial?: InspectionDataset;
  children: ReactNode;
}) {
  const [data, setData] = useState<InspectionDataset>(initial ?? emptyDataset);
  const [ready, setReady] = useState(initial !== undefined);
  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetch("/api/dataset")
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((value: InspectionDataset) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled) setData(emptyDataset);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);
  return (
    <InspectionReadyContext.Provider value={ready}>
      <InspectionDataContext.Provider value={data}>
        {children}
      </InspectionDataContext.Provider>
    </InspectionReadyContext.Provider>
  );
}

export function useInspectionData(): InspectionDataset {
  return useContext(InspectionDataContext);
}

export function useInspectionReady(): boolean {
  return useContext(InspectionReadyContext);
}