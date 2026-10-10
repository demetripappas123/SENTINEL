"use client";
import { useState } from "react";
import { dataset, type Configuration } from "@sentinel/core";
import { ConfigurationControl, PageHeading, Panel } from "../components/ui";
import { MissionTable } from "../components/mission-table";
export function Missions() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const missions = dataset.missions
    .filter((m) => configuration === "ALL" || m.scenario === configuration)
    .slice()
    .reverse();
  return (
    <>
      <PageHeading title="Missions" />
      <div className="toolbar">
        <ConfigurationControl
          value={configuration}
          onChange={setConfiguration}
        />
      </div>
      <Panel
        title={missions.length + " missions"}
        action={<span className="small muted">Latest first</span>}
      >
        <MissionTable missions={missions} full />
      </Panel>
    </>
  );
}
