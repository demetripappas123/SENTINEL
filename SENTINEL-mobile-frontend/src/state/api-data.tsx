import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createApiClient } from "@sentinel/core/api";
import { emptyDataset, type InspectionDataset } from "@sentinel/core";

const InspectionDataContext = createContext<InspectionDataset>(emptyDataset);

export function InspectionDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<InspectionDataset>(emptyDataset);
  useEffect(() => {
    let cancelled = false;
    const baseUrl =
      process.env.EXPO_PUBLIC_SENTINEL_API_URL ?? "http://127.0.0.1:8000";
    createApiClient(baseUrl)
      .getLiveDataset()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled) setData(emptyDataset);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <InspectionDataContext.Provider value={data}>
      {children}
    </InspectionDataContext.Provider>
  );
}

export function useInspectionData(): InspectionDataset {
  return useContext(InspectionDataContext);
}