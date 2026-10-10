import challenge from "./data/challenge.json";
import type { InspectionDataset } from "./types";

export interface InspectionRepository {
  namespace: string;
  load(): Promise<InspectionDataset>;
}

export function createFixtureRepository(): InspectionRepository {
  return {
    namespace: "challenge-v1",
    async load() {
      // Each consumer owns its snapshot, including nested event details.
      return JSON.parse(JSON.stringify(challenge)) as InspectionDataset;
    },
  };
}
