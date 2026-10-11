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
  selectQueue,
  type Configuration,
} from "@sentinel/core";
import {
  ConfigurationControl,
  PageHeading,
  Panel,
  Tag,
} from "../components/ui";
import {
  equipmentName,
  issueDescription,
  missionName,
  operatorText,
  placeName,
} from "../lib/operator-copy";
import { useQueue } from "../lib/queue-data";
import { getDashboardAnalytics } from "../lib/dashboard-analytics";
import { DashboardAnalytics } from "../components/dashboard-analytics";
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
  const analytics = getDashboardAnalytics(data, configuration);
  const versions = new Map(
    data.missions.map((mission) => [mission.mission_id, mission.configuration_version]),
  );
  const queued = selectQueue(queue, { configuration, reviewedIds, versions });
  const inspectionFailures = queued.filter(
    (item) => item.verdict === "inspection_failure",
  ).length;
  const missions = data.missions.filter(
    (m) => configuration === "ALL" || m.configuration_version === configuration,
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
    const rows = data.actions.filter(
      (a) =>
        versionIds.has(a.mission_id) &&
        (a.status === "SUCCESS" || a.status === "FAILED"),
    );
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
  const rateTone = (rate: number) =>
    rate >= 80 ? "good" : rate >= 50 ? "mid" : "bad";
  const cards = [
    {
      label: "Mission completion",
      value: metrics.missionCount ? metrics.completionRate.toFixed(1) : "—",
      percent: metrics.missionCount > 0,
      note:
        metrics.completedCount + " / " + metrics.missionCount + " completed",
      icon: CheckCheck,
      tone: rateTone(metrics.completionRate),
    },
    {
      label: "Action success",
      value: analytics.rate == null ? "—" : analytics.rate.toFixed(1),
      percent: analytics.rate != null,
      note:
        analytics.passed +
        " / " +
        (analytics.passed + analytics.failed) +
        " recorded outcomes passed",
      icon: Activity,
      tone: analytics.rate == null ? "neutral" : rateTone(analytics.rate),
    },
    {
      label: "To review",
      value: queued.length,
      note:
        inspectionFailures +
        (inspectionFailures === 1
          ? " inspection failure"
          : " inspection failures"),
      icon: TriangleAlert,
      tone: inspectionFailures > 0 ? "bad" : queued.length > 0 ? "mid" : "good",
    },
    {
      label: "Findings",
      value: findings.length,
      note:
        data.locations.length +
        " waypoints · " +
        data.assets.length +
        " assets",
      icon: ScanLine,
      tone: findings.length === 0 ? "good" : "mid",
    },
  ];
  if (!data.missions.length)
    return (
      <>
        <PageHeading title="Operations" />
        <div className="data-message" role="status">
          <h2>No inspection data yet</h2>
          <p className="small muted">
            Missions and analytics will appear after inspection records are
            available.
          </p>
        </div>
      </>
    );
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
          <strong>
            {metrics.completedWithFailures} completed{" "}
            {metrics.completedWithFailures === 1 ? "mission" : "missions"}
          </strong>{" "}
          {metrics.completedWithFailures === 1 ? "has" : "have"} failed actions
        </span>
        <Link href="/missions" className="link-button">
          Inspect ↗
        </Link>
      </div>
      <DashboardAnalytics
        data={data}
        configuration={configuration}
        queued={queued}
      />
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
              <span>
                {new Set(data.locations.map((location) => location.floor)).size}{" "}
                floors
              </span>
              <span>{data.locations.length} waypoints</span>
            </div>
          </div>
          <div className="location-note">
            <MapIcon className="icon muted" />
            <strong>{active ? placeName(data, active) : "No locations"}</strong>
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
          action={
            <Tag tone="red">
              {inspectionFailures} inspection{" "}
              {inspectionFailures === 1 ? "failure" : "failures"}
            </Tag>
          }
          footer={
            <>
              <span>{queued.length} to review</span>
              <Link
                href={"/review?configuration=" + configuration}
                className="btn green"
              >
                Review queue →
              </Link>
            </>
          }
        >
          <div className="finding-list">
            {queued.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                className="finding-row"
                href={"/missions/" + encodeURIComponent(item.mission_id)}
              >
                <div className="stack">
                  <strong>{operatorText(humanize(item.cause))}</strong>
                  <p>{issueDescription(item).nextStep}</p>
                  <p className="small muted">
                    {item.asset_id
                      ? equipmentName(data, item.asset_id)
                      : missionName(data, item.mission_id)}
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
              <span>V1 → V2 · all recorded runs</span>
              <Tag
                tone={
                  versionDelta != null && versionDelta < 0 ? "red" : "green"
                }
              >
                {versionDelta == null
                  ? "—"
                  : (versionDelta > 0 ? "+" : "") +
                    versionDelta +
                    " percentage points"}
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
              const rows = actions.filter(
                  (a) =>
                    a.action_type === type &&
                    (a.status === "SUCCESS" || a.status === "FAILED"),
                ),
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
                      humanize(type) +
                      ": " +
                      (rows.length
                        ? rate.toFixed(1) + "% successful"
                        : "No recorded results")
                    }
                  >
                    <span style={{ width: rate + "%" }} />
                  </div>
                  <span className="percent">
                    {rows.length ? rate.toFixed(1) + "%" : "—"}
                  </span>
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
