import { createApiClient, type DataSource } from "./api/client";
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

export function createApiRepository(
  baseUrl: string,
  {
    source = "kit",
    fetcher,
  }: { source?: DataSource; fetcher?: typeof fetch } = {},
): InspectionRepository {
  const client = createApiClient(baseUrl, fetcher);
  return {
    // Kept apart from the fixture so its reviews never mark API records.
    namespace: `api-${source}-v1`,
    load: () => client.getDataset(source),
  };
}
