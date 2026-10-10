import { describe, expect, it } from "vitest";
import { getFindings, getMetrics } from "./index";
import { createFixtureRepository } from "./repository";

describe("fixture repository", () => {
  it("provides the complete dataset for operational metrics and joins", async () => {
    const data = await createFixtureRepository().load();
    expect(getMetrics(data, "ALL")).toMatchObject({
      missionCount: 27,
      actionCount: 270,
      completionRate: 96.3,
      actionSuccessRate: 81.9,
    });
    expect(getFindings(data)).toHaveLength(15);
    expect(data.findings).toHaveLength(40);
    expect(data.assets).toHaveLength(20);
    expect(data.locations).toHaveLength(15);
    expect(data.readings).toHaveLength(220);
    expect(data.events).toHaveLength(500);
  });

  it("isolates consumer changes from subsequent loads and other consumers", async () => {
    const repository = createFixtureRepository();
    const data = await repository.load();
    data.findings[0].severity = "CHANGED";
    data.missions.length = 0;
    data.events[0].details.status = "CHANGED";
    const fresh = await repository.load();
    expect(fresh.missions).toHaveLength(27);
    expect(fresh.findings[0].severity).not.toBe("CHANGED");
    expect(fresh.events[0].details.status).not.toBe("CHANGED");
    expect((await createFixtureRepository().load()).missions).toHaveLength(27);
  });
});
