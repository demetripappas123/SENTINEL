"use client";
import { useState } from "react";
import { getFindings, humanize, type Configuration, type Finding } from "@sentinel/core";
import { FacilityMap } from "../components/facility-map";
import { FindingDialog, FindingRow } from "../components/findings";
import { ConfigurationControl, PageHeading, Panel, Tag } from "../components/ui";
import { useReviews } from "../lib/browser-state";
import { pendingCount, useInspectionData, useInspectionReady } from "../lib/inspection-data";
export function Facility() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const [waypoint, setWaypoint] = useState("WP05"),
    [selected, setSelected] = useState<Finding | null>(null);
  const data = useInspectionData();
  const ready = useInspectionReady();
  const { reviewedIds, markReviewed } = useReviews();
  const active = data.locations.some((l) => l.location_id === waypoint)
    ? waypoint
    : (data.locations[0]?.location_id ?? "");
  const location = data.locations.find((l) => l.location_id === active);
  const missionIds = new Set(data.missions
    .filter((m) => configuration === "ALL" || m.scenario === configuration)
    .map((m) => m.mission_id));
  const configuredActions = data.actions.filter((a) => missionIds.has(a.mission_id));
  const actions = configuredActions.filter((a) => a.location_id === active);
  const findings = getFindings(data, { configuration, status: "all" }).filter(
    (f) => f.location_id === active,
  );
  return (
    <>
      <PageHeading title="Facility" />
      <div className="toolbar">
        <ConfigurationControl value={configuration} onChange={setConfiguration} />
        <Tag>Illustrative layout · 2 floors</Tag>
      </div>
      <div className="facility-layout">
        <Panel
          title="Floor plan"
          action={<span className="small muted">{ready ? data.locations.length : pendingCount} waypoints</span>}
        >
          <div className="map-wrap">
            <FacilityMap selected={active} onSelect={setWaypoint} />
          </div>
          <div className="location-note">
            <span className="location-number">{ready ? active : pendingCount}</span>
            <div>
              <h2>{ready ? (location ? location.location_name : "No locations") : pendingCount}</h2>
              <p>
                {!ready
                  ? pendingCount
                  : location
                    ? humanize(location.environment) + " · Floor " + location.floor
                    : "No stored locations"}
              </p>
            </div>
          </div>
          <div className="summary-band" style={{ border: 0, margin: 0 }}>
            <div className="datum">
              <span className="small muted">Actions</span>
              <strong>{ready ? actions.length : pendingCount}</strong>
            </div>
            <div className="datum">
              <span className="small muted">Failed</span>
              <strong>
                {ready ? actions.filter((a) => a.status === "FAILED").length : pendingCount}
              </strong>
            </div>
            <div className="datum">
              <span className="small muted">Findings</span>
              <strong>{ready ? findings.length : pendingCount}</strong>
            </div>
          </div>
          {findings.slice(0, 3).map((f) => (
            <FindingRow
              key={f.anomaly_id}
              finding={f}
              onOpen={setSelected}
              reviewed={reviewedIds.includes(f.anomaly_id)}
            />
          ))}
        </Panel>
        <Panel
          title="Waypoints"
          action={<span className="small muted">Failures</span>}
        >
          {data.locations.map((l) => {
            const failed = configuredActions.filter(
              (a) => a.location_id === l.location_id && a.status === "FAILED",
            ).length;
            return (
              <button
                key={l.location_id}
                className={
                  "waypoint-row " + (l.location_id === active ? "active" : "")
                }
                aria-pressed={l.location_id === waypoint}
                aria-label={l.location_id + " " + l.location_name}
                onClick={() => setWaypoint(l.location_id)}
              >
                <span className="mono">{l.location_id}</span>
                <span>{l.location_name}</span>
                <Tag tone={ready && failed ? "amber" : "green"}>{ready ? failed + " failed" : pendingCount}</Tag>
              </button>
            );
          })}
        </Panel>
      </div>
      <FindingDialog
        finding={selected}
        onClose={() => setSelected(null)}
        onReview={markReviewed}
        reviewed={!!selected && reviewedIds.includes(selected.anomaly_id)}
      />
    </>
  );
}
