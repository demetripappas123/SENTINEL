"use client";
import { useState } from "react";
import { dataset, getFindings, humanize, type Configuration, type Finding } from "@sentinel/core";
import { FacilityMap } from "../components/facility-map";
import { FindingDialog, FindingRow } from "../components/findings";
import { ConfigurationControl, PageHeading, Panel, Tag } from "../components/ui";
import { useReviews } from "../lib/browser-state";
export function Facility() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const [waypoint, setWaypoint] = useState("WP05"),
    [selected, setSelected] = useState<Finding | null>(null);
  const { reviewedIds, markReviewed } = useReviews();
  const location = dataset.locations.find((l) => l.location_id === waypoint)!;
  const missionIds = new Set(dataset.missions
    .filter((m) => configuration === "ALL" || m.scenario === configuration)
    .map((m) => m.mission_id));
  const configuredActions = dataset.actions.filter((a) => missionIds.has(a.mission_id));
  const actions = configuredActions.filter((a) => a.location_id === waypoint);
  const findings = getFindings(dataset, { configuration, status: "all" }).filter(
    (f) => f.location_id === waypoint,
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
          action={<span className="small muted">15 waypoints</span>}
        >
          <div className="map-wrap">
            <FacilityMap selected={waypoint} onSelect={setWaypoint} />
          </div>
          <div className="location-note">
            <span className="location-number">{waypoint}</span>
            <div>
              <h2>{location.location_name}</h2>
              <p>
                {humanize(location.environment)} · Floor {location.floor}
              </p>
            </div>
          </div>
          <div className="summary-band" style={{ border: 0, margin: 0 }}>
            <div className="datum">
              <span className="small muted">Actions</span>
              <strong>{actions.length}</strong>
            </div>
            <div className="datum">
              <span className="small muted">Failed</span>
              <strong>
                {actions.filter((a) => a.status === "FAILED").length}
              </strong>
            </div>
            <div className="datum">
              <span className="small muted">Findings</span>
              <strong>{findings.length}</strong>
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
          {dataset.locations.map((l) => {
            const failed = configuredActions.filter(
              (a) => a.location_id === l.location_id && a.status === "FAILED",
            ).length;
            return (
              <button
                key={l.location_id}
                className={
                  "waypoint-row " + (l.location_id === waypoint ? "active" : "")
                }
                aria-pressed={l.location_id === waypoint}
                aria-label={l.location_id + " " + l.location_name}
                onClick={() => setWaypoint(l.location_id)}
              >
                <span className="mono">{l.location_id}</span>
                <span>{l.location_name}</span>
                <Tag tone={failed ? "amber" : "green"}>{failed} failed</Tag>
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
