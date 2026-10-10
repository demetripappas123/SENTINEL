"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  CheckCheck,
  Map as MapIcon,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import {
  getFindings,
  getMetrics,
  humanize,
  locationName,
  selectQueue,
  type Configuration,
} from "@sentinel/core";
import {
  ConfigurationControl,
  PageHeading,
  Panel,
  Tag,
} from "../components/ui";
import { useQueue } from "../lib/queue-data";
import { FacilityMap } from "../components/facility-map";
import { MissionTable } from "../components/mission-table";
import { useReviews } from "../lib/browser-state";
import { useInspectionData } from "../lib/inspection-data";

export function Overview() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const [waypoint, setWaypoint] = useState("WP05");
  const data = useInspectionData();
  const queue = useQueue();
  const { reviewedIds } = useReviews();
  const metrics = getMetrics(data, configuration);
  const scenarios = new Map(data.missions.map((mission) => [mission.mission_id, mission.scenario]));
  const queued = selectQueue(queue, { configuration, reviewedIds, scenarios });
  const inspectionFailures = queued.filter((item) => item.verdict === "inspection_failure").length;
  const missions = data.missions.filter(
    (m) => configuration === "ALL" || m.scenario === configuration,
  );
  const ids = new Set(missions.map((m) => m.mission_id));
  const actions = data.actions.filter((a) => ids.has(a.mission_id));
  const findings = getFindings(data, { configuration, status: "all" });
  const rateFor = (version: string) => {
    const versionIds = new Set(
      data.missions
        .filter((m) => m.configuration_version === version)
        .map((m) => m.mission_id),
    );
    const rows = data.actions.filter((a) => versionIds.has(a.mission_id));
    return rows.length
      ? (rows.filter((a) => a.status === "SUCCESS").length / rows.length) * 100
      : null;
  };
  const baseline = rateFor("V1");
  const improved = rateFor("V2");
  const versionDelta =
    baseline == null || improved == null
      ? null
      : Math.round((improved - baseline) * 10) / 10;
  const active = data.locations.some((l) => l.location_id === waypoint)
    ? waypoint
    : (data.locations[0]?.location_id ?? "");
  const cards = [
    {
      label: "Mission completion",
      value: metrics.completionRate.toFixed(1),
      percent: true,
      note:
        metrics.completedCount + " / " + metrics.missionCount + " completed",
      icon: CheckCheck,
      tone: "good",
    },
    {
      label: "Action success",
      value: metrics.actionSuccessRate.toFixed(1),
      percent: true,
      note:
        metrics.successfulActionCount + " / " + metrics.actionCount + " passed",
      icon: Activity,
      tone: "",
    },
    {
      label: "To review",
      value: queued.length,
      note: inspectionFailures + " inspection failures",
      icon: TriangleAlert,
      tone: "caution",
    },
    {
      label: "Findings",
      value: findings.length,
      note: data.locations.length + " waypoints · " + data.assets.length + " assets",
      icon: ScanLine,
      tone: "",
    },
  ];
  return (
    <>
      <PageHeading title="Operations" />
      <div className="toolbar">
        <ConfigurationControl
          value={configuration}
          onChange={setConfiguration}
        />
        <Tag tone="blue">Stored runs</Tag>
      </div>
      <section className="metrics" aria-label="Operational metrics">
        {cards.map(({ label, value, percent, note, icon: Icon, tone }) => (
          <div className={"metric " + tone} key={label}>
            <div className="metric-label">
              {label}
              <span className="metric-icon">
                <Icon className="icon" />
              </span>
            </div>
            <div className="metric-value">
              <span>{value}</span>
              {percent && <small>%</small>}
            </div>
            <div className={"metric-note " + tone}>{note}</div>
          </div>
        ))}
      </section>
      <div className="insight-strip">
        <TriangleAlert className="icon" />
        <span>
          <strong>{metrics.completedWithFailures} completed missions</strong>{" "}
          have failed actions
        </span>
        <Link href="/missions" className="link-button">
          Inspect ↗
        </Link>
      </div>
      <div className="dashboard-grid">
        <Panel
          title={
            <>
              <MapIcon className="icon" />
              Facility
            </>
          }
          action={
            <Link className="link-button" href="/facility">
              Open map ↗
            </Link>
          }
        >
          <div className="map-wrap">
            <FacilityMap selected={active} onSelect={setWaypoint} />
            <div className="map-key">
              <span>2 floors</span>
              <span>{data.locations.length} waypoints</span>
            </div>
          </div>
          <div className="location-note">
            <span className="location-number">{active}</span>
            <strong>{active ? locationName(data, active) : "No locations"}</strong>
          </div>
        </Panel>
        <Panel
          title={
            <>
              <TriangleAlert className="icon" />
              Attention
            </>
          }
          className="attention-panel"
          action={<Tag tone="red">{inspectionFailures} inspection failures</Tag>}
          footer={
            <>
              <span>{queued.length} to review</span>
              <Link href="/review" className="btn green">
                Review queue →
              </Link>
            </>
          }
        >
          <div className="finding-list">
            {queued.slice(0, 4).map((item) => (
              <Link key={item.id} className="finding-row" href={"/missions/" + item.mission_id}>
                <div className="stack">
                  <strong>{humanize(item.cause)}</strong>
                  <p className="mono">
                    {item.mission_id} · rank {item.rank}
                  </p>
                </div>
              </Link>
            ))}
            {!queued.length && (
              <p className="panel-body small muted">Queue is clear.</p>
            )}
          </div>
        </Panel>
        <Panel
          title="Action success"
          action={<span className="small muted">By type</span>}
          footer={
            <>
              <span>V1 → V2</span>
              <Tag tone="green">
                {versionDelta == null ? "—" : (versionDelta > 0 ? "+" : "") + versionDelta + " pp"}
              </Tag>
            </>
          }
        >
          <div className="reliability">
            {[
              "VISUAL_INSPECTION",
              "THERMAL_INSPECTION",
              "NAVIGATION",
              "GAUGE_READING",
              "ACOUSTIC_INSPECTION",
            ].map((type) => {
              const rows = actions.filter((a) => a.action_type === type),
                rate = rows.length
                  ? (rows.filter((a) => a.status === "SUCCESS").length /
                      rows.length) *
                    100
                  : 0;
              return (
                <div className="reliability-row" key={type}>
                  <span>
                    {humanize(type)
                      .replace(" inspection", "")
                      .replace(" reading", "")}
                  </span>
                  <div
                    className="bar"
                    role="img"
                    aria-label={
                      humanize(type) + ": " + rate.toFixed(1) + "% successful"
                    }
                  >
                    <span style={{ width: rate + "%" }} />
                  </div>
                  <span className="percent">{rate.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Recent missions"
          action={
            <Link className="link-button" href="/missions">
              View all ↗
            </Link>
          }
        >
          <MissionTable missions={missions.slice().reverse().slice(0, 4)} />
        </Panel>
      </div>
    </>
  );
}
