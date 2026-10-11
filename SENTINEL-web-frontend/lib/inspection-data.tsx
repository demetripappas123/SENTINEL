"use client";
import { createContext, useContext, type ReactNode } from "react";
import { emptyDataset, type InspectionDataset } from "@sentinel/core";
import { isInspectionDataset } from "@sentinel/core/api";
import {
  readyState,
  useApiResource,
  type RequestState,
} from "./use-api-resource";
const InspectionDataContext = createContext<InspectionDataset>(emptyDataset);
const InspectionStateContext = createContext<RequestState>(readyState);
export function InspectionDataProvider({
  initial,
  children,
}: {
  initial?: InspectionDataset;
  children: ReactNode;
}) {
  const resource = useApiResource(
    "/api/dataset",
    initial,
    emptyDataset,
    isInspectionDataset,
  );
  return (
    <InspectionStateContext.Provider value={resource}>
      <InspectionDataContext.Provider value={resource.data}>
        {children}
      </InspectionDataContext.Provider>
    </InspectionStateContext.Provider>
  );
}
export const useInspectionData = () => useContext(InspectionDataContext);
export const useInspectionState = () => useContext(InspectionStateContext);
export const useInspectionReady = () => useInspectionState().status === "ready";
