"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  CheckCheck,
  Map,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import {
  dataset,
  getFindings,
  getMetrics,
  humanize,
  locationName,
  type Configuration,
  type Finding,
} from "@sentinel/core";
import {
  ConfigurationControl,
  PageHeading,
  Panel,
  Tag,
} from "../components/ui";
import { FindingDialog, FindingRow } from "../components/findings";
import { FacilityMap } from "../components/facility-map";
import { MissionTable } from "../components/mission-table";
import { useReviews } from "../lib/browser-state";

export function Overview() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const [waypoint, setWaypoint] = useState("WP05");
  const [selected, setSelected] = useState<Finding | null>(null);
  const { reviewedIds, markReviewed } = useReviews();
  const metrics = getMetrics(dataset, configuration);
  const pending = getFindings(dataset, { configuration, reviewedIds });
  const critical = pending.filter((f) => f.severity === "CRITICAL").length;
  const missions = dataset.missions.filter(
    (m) => configuration === "ALL" || m.scenario === configuration,
  );
  const ids = new Set(missions.map((m) => m.mission_id));
  const actions = dataset.actions.filter((a) => ids.has(a.mission_id));
  const findings = getFindings(dataset, { configuration, status: "all" });
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
      value: pending.length,
      note: critical + " critical",
      icon: TriangleAlert,
      tone: "caution",
    },
    {
      label: "Findings",
      value: findings.length,
      note: "15 waypoints · 20 assets",
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
        <Tag tone="blue">Challenge snapshot</Tag>
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
              <Map className="icon" />
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
            <FacilityMap selected={waypoint} onSelect={setWaypoint} />
            <div className="map-key">
              <span>2 floors</span>
              <span>15 waypoints</span>
            </div>
          </div>
          <div className="location-note">
            <span className="location-number">{waypoint}</span>
            <strong>{locationName(waypoint)}</strong>
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
          action={<Tag tone="red">{critical} critical</Tag>}
          footer={
            <>
              <span>{pending.length} to review</span>
              <Link href="/review" className="btn green">
                Review queue →
              </Link>
            </>
          }
        >
          <div className="finding-list">
            {pending.slice(0, 4).map((f) => (
              <FindingRow key={f.anomaly_id} finding={f} onOpen={setSelected} />
            ))}
            {!pending.length && (
              <p className="panel-body small muted">All reviewed.</p>
            )}
          </div>
        </Panel>
        <Panel
          title="Action success"
          action={<span className="small muted">By type</span>}
          footer={
            <>
              <span>V1 → V2</span>
              <Tag tone="green">+13.9 pp</Tag>
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
      <FindingDialog
        finding={selected}
        onClose={() => setSelected(null)}
        onReview={markReviewed}
        reviewed={!!selected && reviewedIds.includes(selected.anomaly_id)}
      />
    </>
  );
}
