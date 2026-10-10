"use client";
import { useState } from "react";
import { MapPin } from "lucide-react";
import {
  getFindings,
  humanize,
  type Configuration,
  type Finding,
} from "@sentinel/core";
import { operatorText, placeName } from "../lib/operator-copy";
import { FacilityMap } from "../components/facility-map";
import { FindingDialog, FindingRow } from "../components/findings";
import {
  ConfigurationControl,
  PageHeading,
  Panel,
  Tag,
} from "../components/ui";
import { useReviews } from "../lib/browser-state";
import { useInspectionData } from "../lib/inspection-data";
export function Facility() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const [waypoint, setWaypoint] = useState("WP05"),
    [selected, setSelected] = useState<Finding | null>(null);
  const data = useInspectionData();
  const { reviewedIds, markReviewed } = useReviews();
  const active = data.locations.some((l) => l.location_id === waypoint)
    ? waypoint
    : (data.locations[0]?.location_id ?? "");
  const location = data.locations.find((l) => l.location_id === active);
  const missionIds = new Set(
    data.missions
      .filter((m) => configuration === "ALL" || m.scenario === configuration)
      .map((m) => m.mission_id),
  );
  const configuredActions = data.actions.filter((a) =>
    missionIds.has(a.mission_id),
  );
  const actions = configuredActions.filter((a) => a.location_id === active);
  const findings = getFindings(data, { configuration, status: "all" }).filter(
    (f) => f.location_id === active,
  );
  return (
    <>
      <PageHeading title="Facility" />
      <div className="toolbar">
        <ConfigurationControl
          value={configuration}
          onChange={setConfiguration}
        />
        <Tag>Illustrative layout · 2 floors</Tag>
      </div>
      <div className="facility-layout">
        <Panel
          title="Floor plan"
          action={
            <span className="small muted">
              {data.locations.length} waypoints
            </span>
          }
        >
          <div className="map-wrap">
            <FacilityMap selected={active} onSelect={setWaypoint} />
          </div>
          <div className="location-note">
            <span className="location-number">
              {/^WP\d+$/.test(active) ? active : <MapPin className="icon" />}
            </span>
            <div>
              <h2>{location ? placeName(data, active) : "No locations"}</h2>
              <p>
                {location
                  ? operatorText(humanize(location.environment)) +
                    " · Floor " +
                    location.floor
                  : "No stored locations"}
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
                aria-label={
                  (/^WP\d+$/.test(l.location_id) ? l.location_id + " " : "") +
                  placeName(data, l.location_id)
                }
                onClick={() => setWaypoint(l.location_id)}
              >
                <span className="mono">
                  {/^WP\d+$/.test(l.location_id) ? (
                    l.location_id
                  ) : (
                    <MapPin className="icon" />
                  )}
                </span>
                <span>{placeName(data, l.location_id)}</span>
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
