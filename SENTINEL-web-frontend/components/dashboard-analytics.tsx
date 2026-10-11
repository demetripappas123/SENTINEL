"use client";
import Link from "next/link";
import { useId, useState, type CSSProperties } from "react";
import { ArrowUpRight, CheckCheck, MapPin, TriangleAlert } from "lucide-react";
import {
  humanize,
  nextStepForFailure,
  type Configuration,
  type InspectionDataset,
} from "@sentinel/core";
import type { QueueItem } from "@sentinel/core/api";
import { getDashboardAnalytics } from "../lib/dashboard-analytics";
import { operatorText, placeName } from "../lib/operator-copy";
import { forwardRowClick } from "../lib/row-link";
import { Panel, Tag } from "./ui";

const weekdayNames: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

const dayLabel = (day: string) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function DashboardAnalytics({
  data,
  configuration,
  queued,
}: {
  data: InspectionDataset;
  configuration: Configuration;
  queued: QueueItem[];
}) {
  const analytics = getDashboardAnalytics(data, configuration);
  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const gradient = useId();
  const { days } = analytics;
  const firstTime = days.length ? Date.parse(days[0].day) : 0;
  const span =
    days.length > 1 ? Date.parse(days[days.length - 1].day) - firstTime : 0;
  const x = (day: string) =>
    span ? 44 + ((Date.parse(day) - firstTime) / span) * 588 : 338;
  const y = (rate: number) => 162 - rate * 1.32;
  const points = days.map((row) => `${x(row.day)},${y(row.rate)}`).join(" ");
  const total = analytics.passed + analytics.failed + analytics.awaiting;
  const retries = queued.filter(
    (item) => item.verdict === "inspection_failure",
  ).length;
  const equipment = queued.filter(
    (item) => item.verdict === "equipment_finding",
  ).length;
  const verification = queued.length - retries - equipment;
  const retryEnd = queued.length ? (retries / queued.length) * 100 : 0;
  const equipmentEnd = queued.length
    ? ((retries + equipment) / queued.length) * 100
    : 0;
  const busiest = Math.max(...analytics.weekdays.map((day) => day.count));
  const busiestDays = analytics.weekdays.filter(
    (day) => day.count === busiest && busiest > 0,
  );
  const [selectedDayName, setSelectedDayName] = useState<string | null>(null);
  // Cleared automatically if a filter leaves the chosen day without checks.
  const selectedDay = analytics.weekdays.find(
    (day) => day.day === selectedDayName && day.count > 0,
  );
  const dayRows = selectedDay
    ? days.filter((row) => selectedDay.dates.includes(row.day))
    : [];
  const visibleCauses = analytics.causes.slice(0, 5);
  const cause =
    visibleCauses.find((row) => row.cause === selectedCause) ??
    visibleCauses[0];
  const reviewUrl = "/review?configuration=" + configuration;
  return (
    <div className="analytics-grid">
      <div className="analytics-column">
        <Panel
          title="Inspection performance"
          action={
            <span className="small muted">
              {days.length
                ? `${dayLabel(days[0].day)} – ${dayLabel(days[days.length - 1].day)}`
                : "Recorded checks"}
            </span>
          }
        >
          <div className="performance-main">
            <div className="trend-summary">
              <span className="small muted">Successful checks</span>
              <strong>
                {analytics.rate == null ? "—" : analytics.rate.toFixed(1) + "%"}
              </strong>
              <p className="small muted">
                {analytics.passed.toLocaleString()} of{" "}
                {(analytics.passed + analytics.failed).toLocaleString()}{" "}
                completed checks
              </p>
              <div className="trend-counts">
                <span>
                  <i className="legend-dot verify" />
                  Daily success rate
                </span>
              </div>
            </div>
            {days.length ? (
              <svg
                key={configuration}
                className="trend-chart"
                viewBox="0 0 660 198"
                role="img"
                aria-label={`Daily action success across ${days.length} recorded ${days.length === 1 ? "day" : "days"}. ${analytics.passed} passed, ${analytics.failed} failed.`}
              >
                <defs>
                  <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--chart-accent)"
                      stopOpacity="0.22"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--chart-accent)"
                      stopOpacity="0.02"
                    />
                  </linearGradient>
                </defs>
                {[0, 25, 50, 75, 100].map((rate) => (
                  <g key={rate}>
                    <line
                      x1="44"
                      x2="632"
                      y1={y(rate)}
                      y2={y(rate)}
                      className="chart-gridline"
                    />
                    <text x="34" y={y(rate) + 4} textAnchor="end">
                      {rate}%
                    </text>
                  </g>
                ))}
                {days.length > 1 && (
                  <polygon
                    points={`${x(days[0].day)},162 ${points} ${x(days[days.length - 1].day)},162`}
                    className="trend-area"
                    fill={`url(#${gradient})`}
                  />
                )}
                <polyline
                  className="trend-line"
                  pathLength={1}
                  points={points}
                  fill="none"
                  stroke="var(--chart-accent)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {days.map((row) => (
                  <circle
                    key={row.day}
                    cx={x(row.day)}
                    cy={y(row.rate)}
                    className="trend-point"
                    r="3.5"
                    fill="var(--chart-accent)"
                  >
                    <title>
                      {dayLabel(row.day)}: {row.rate.toFixed(1)}% · {row.passed}{" "}
                      passed · {row.failed} failed
                    </title>
                  </circle>
                ))}
                {days
                  .filter(
                    (_, i) =>
                      i === 0 ||
                      i === days.length - 1 ||
                      (days.length > 3 && i === Math.floor(days.length / 2)),
                  )
                  .map((row) => (
                    <text
                      key={row.day}
                      x={x(row.day)}
                      y="186"
                      textAnchor={
                        days.length === 1
                          ? "middle"
                          : row === days[0]
                            ? "start"
                            : row === days[days.length - 1]
                              ? "end"
                              : "middle"
                      }
                    >
                      {dayLabel(row.day)}
                    </text>
                  ))}
              </svg>
            ) : (
              <p className="panel-body small muted">
                No dated inspection results for this configuration.
              </p>
            )}
          </div>
          <div className="outcome-summary" aria-label="Inspection outcomes">
            {[
              {
                label: "Passed",
                count: analytics.passed,
                tone: "passed",
                icon: CheckCheck,
              },
              {
                label: "Failed checks",
                count: analytics.failed,
                tone: "failed",
                icon: TriangleAlert,
              },
              {
                label: "Awaiting result",
                count: analytics.awaiting,
                tone: "pending",
                icon: MapPin,
              },
            ].map(({ label, count, tone, icon: Icon }) => (
              <div className={"outcome-stat " + tone} key={label}>
                <div>
                  <Icon className="icon" />
                  <strong>{count.toLocaleString()}</strong>
                </div>
                <span>{label}</span>
                <div className="outcome-track">
                  <i
                    style={{ width: (total ? (count / total) * 100 : 0) + "%" }}
                  />
                </div>
              </div>
            ))}
          </div>
          {analytics.undated > 0 && (
            <p className="analytics-note">
              {analytics.undated} checks have no recorded date and are included
              in totals only.
            </p>
          )}
        </Panel>

        <Panel
          title="Where checks are failing"
          action={<span className="small muted">Most failures first</span>}
        >
          {analytics.hotspots.length ? (
            <div className="table-wrap">
              <table className="hotspot-table">
                <caption className="sr-only">
                  Locations with failed inspections and their most frequent
                  recorded cause
                </caption>
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Open failures</th>
                    <th>Main cause</th>
                    <th>
                      <span className="sr-only">Inspect</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.hotspots.slice(0, 5).map((row) => (
                    <tr
                      key={row.locationId ?? "unknown"}
                      className="linked-row"
                      onClick={forwardRowClick}
                    >
                      <td>
                        <strong>{placeName(data, row.locationId)}</strong>
                        <small>{row.total} completed checks</small>
                      </td>
                      <td>
                        <strong className="failure-number">{row.failed}</strong>
                        <small>
                          {row.fixed
                            ? `${row.fixed} since fixed`
                            : `${row.rate.toFixed(0)}% at this location`}
                        </small>
                      </td>
                      <td>{operatorText(humanize(row.cause))}</td>
                      <td>
                        <Link
                          className="hotspot-link"
                          href={
                            "/missions/" + encodeURIComponent(row.missionId)
                          }
                          aria-label={`Inspect failures at ${placeName(data, row.locationId)}`}
                        >
                          <ArrowUpRight className="icon" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-body small muted">
              {analytics.fixed
                ? "Every failed check here has since passed."
                : "No failed checks in this selection."}
            </p>
          )}
        </Panel>

        <Panel
          title="Review priorities"
          action={<Tag>{queued.length} to review</Tag>}
          footer={
            <Link className="link-button" href={reviewUrl}>
              Open review queue →
            </Link>
          }
        >
          <section className="review-breakdown" aria-label="Review breakdown">
            <div
              key={configuration}
              className="review-ring"
              style={{
                background: queued.length
                  ? `conic-gradient(var(--mid) 0% ${retryEnd}%, var(--bad) ${retryEnd}% ${equipmentEnd}%, var(--chart-accent) ${equipmentEnd}% 100%)`
                  : "var(--border)",
              }}
              aria-hidden="true"
            >
              <div>
                <strong>{queued.length}</strong>
                <span>to review</span>
              </div>
            </div>
            <ul className="review-legend">
              <li>
                <i className="legend-dot retry" />
                <span>
                  <strong>{retries}</strong>{" "}
                  {retries === 1
                    ? "inspection to retry"
                    : "inspections to retry"}
                  <small>Check the robot, sensor, or route.</small>
                </span>
              </li>
              <li>
                <i className="legend-dot failed" />
                <span>
                  <strong>{equipment}</strong> equipment{" "}
                  {equipment === 1 ? "finding" : "findings"}
                  <small>Check the equipment’s condition.</small>
                </span>
              </li>
              <li>
                <i className="legend-dot verify" />
                <span>
                  <strong>{verification}</strong> to verify
                  <small>Collect clearer evidence before deciding.</small>
                </span>
              </li>
            </ul>
          </section>
        </Panel>
      </div>
      <div className="analytics-column">
        <Panel
          title="Inspection activity"
          action={
            selectedDay ? (
              <button
                className="link-button"
                onClick={() => setSelectedDayName(null)}
              >
                All days
              </button>
            ) : (
              <span className="small muted">By weekday · UTC</span>
            )
          }
        >
          <div className="activity-summary">
            <strong>
              {selectedDay
                ? weekdayNames[selectedDay.day]
                : busiest
                  ? busiestDays.length === 1
                    ? busiestDays[0].day
                    : "Peak days"
                  : "—"}
            </strong>
            <span className="small muted">
              {selectedDay
                ? `${selectedDay.count.toLocaleString()} checks · ${selectedDay.rate!.toFixed(1)}% passed`
                : busiest
                  ? `${busiest.toLocaleString()} checks${busiestDays.length > 1 ? " each" : ""}`
                  : "No dated checks yet"}
            </span>
          </div>
          <div
            className={"weekday-chart" + (selectedDay ? " has-selection" : "")}
            role="group"
            aria-label="Completed checks by weekday"
          >
            {analytics.weekdays.map((day) => (
              <button
                className={
                  "weekday" +
                  (day.count === busiest && busiest > 0 ? " peak" : "") +
                  (selectedDay?.day === day.day ? " selected" : "")
                }
                key={day.day}
                disabled={!day.count}
                aria-pressed={selectedDay?.day === day.day}
                aria-label={`${weekdayNames[day.day]}: ${day.count} completed checks`}
                onClick={() =>
                  setSelectedDayName(
                    selectedDay?.day === day.day ? null : day.day,
                  )
                }
              >
                <span className="weekday-value">{day.count || "—"}</span>
                <span className="weekday-track">
                  <i
                    style={{
                      height: (busiest ? (day.count / busiest) * 100 : 0) + "%",
                    }}
                  />
                </span>
                <span>{day.day}</span>
              </button>
            ))}
          </div>
          {selectedDay ? (
            <section
              className="activity-detail"
              key={selectedDay.day}
              aria-label={`${weekdayNames[selectedDay.day]} checks`}
            >
              <dl className="activity-stats">
                <div>
                  <dt>Passed</dt>
                  <dd className="good">{selectedDay.passed}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd className={selectedDay.failed ? "bad" : ""}>
                    {selectedDay.failed}
                  </dd>
                </div>
                <div>
                  <dt>Missions</dt>
                  <dd>{selectedDay.missions}</dd>
                </div>
              </dl>
              <p className="small muted">
                {selectedDay.topCause
                  ? `Most common failure: ${operatorText(humanize(selectedDay.topCause.cause))} (${selectedDay.topCause.count})`
                  : "No failed checks on this day."}
                {selectedDay.fixed > 0 &&
                  ` · ${selectedDay.fixed} since fixed by a passing check`}
              </p>
              <ul className="activity-dates">
                {dayRows
                  .slice(-4)
                  .reverse()
                  .map((row) => (
                    <li key={row.day}>
                      <span>{dayLabel(row.day)}</span>
                      <span
                        className="activity-split"
                        role="img"
                        aria-label={`${row.passed} passed, ${row.failed} failed`}
                      >
                        <i
                          className="passed"
                          style={{ flexGrow: row.passed }}
                        />
                        <i
                          className="failed"
                          style={{ flexGrow: row.failed }}
                        />
                      </span>
                      <span className="mono">
                        {row.passed}/{row.passed + row.failed}
                      </span>
                    </li>
                  ))}
              </ul>
              {dayRows.length > 4 && (
                <p className="analytics-note">
                  Showing the four most recent of {dayRows.length}{" "}
                  {weekdayNames[selectedDay.day]}s.
                </p>
              )}
            </section>
          ) : (
            busiest > 0 && (
              <p className="analytics-note">Select a day to see its checks.</p>
            )
          )}
        </Panel>

        <Panel
          title="Runs without issues"
          action={<CheckCheck className="icon muted" />}
        >
          <div
            className="clean-gauge"
            role="img"
            aria-label={
              analytics.cleanRate == null
                ? "No completed missions to assess"
                : `${analytics.cleanRate.toFixed(1)}% of completed missions passed every check`
            }
          >
            <svg viewBox="0 0 280 156" aria-hidden="true">
              {Array.from({ length: 36 }, (_, i) => {
                const angle = Math.PI - ((i + 0.5) / 36) * Math.PI;
                const active =
                  analytics.cleanRate != null &&
                  ((i + 0.5) / 36) * 100 <= analytics.cleanRate;
                return (
                  <line
                    key={i}
                    x1={140 + 100 * Math.cos(angle)}
                    y1={137 - 100 * Math.sin(angle)}
                    x2={140 + 120 * Math.cos(angle)}
                    y2={137 - 120 * Math.sin(angle)}
                    stroke={active ? "var(--good)" : "var(--border)"}
                    strokeWidth="5"
                    style={{ "--i": i } as CSSProperties}
                  />
                );
              })}
            </svg>
            <div className="gauge-value">
              <strong>
                {analytics.cleanRate == null
                  ? "—"
                  : Math.round(analytics.cleanRate) + "%"}
              </strong>
              <span>
                {analytics.cleanMissions} of {analytics.completedMissions}{" "}
                completed runs
              </span>
            </div>
          </div>
          <p className="gauge-note">
            Every inspection passed, with no missing results.
          </p>
          <Link className="gauge-link link-button" href="/missions">
            Inspect missions <ArrowUpRight className="icon" />
          </Link>
        </Panel>

        <Panel
          title="What’s going wrong"
          action={
            <span className="small muted">
              {analytics.openFailed} open{" "}
              {analytics.openFailed === 1 ? "failure" : "failures"}
            </span>
          }
        >
          <div className="cause-list" aria-label="Recorded failure causes">
            {visibleCauses.map((row) => (
              <button
                className={
                  "cause-row " + (cause?.cause === row.cause ? "selected" : "")
                }
                key={row.cause}
                aria-pressed={cause?.cause === row.cause}
                onClick={() => setSelectedCause(row.cause)}
              >
                <span>
                  <strong>{operatorText(humanize(row.cause))}</strong>
                  <small>
                    {row.count} · {row.share.toFixed(0)}%
                  </small>
                </span>
                <span className="cause-track">
                  <i style={{ width: row.share + "%" }} />
                </span>
              </button>
            ))}
            {!cause && (
              <p className="small muted">
                {analytics.fixed
                  ? "Every recorded failure has since passed."
                  : "No failures recorded for this selection."}
              </p>
            )}
          </div>
          {cause && (
            <div className="cause-guidance">
              <span className="small muted">
                Next step · {operatorText(humanize(cause.cause))}
              </span>
              <p>{nextStepForFailure(cause.cause)}</p>
            </div>
          )}
          {analytics.causes.length > 5 && (
            <p className="analytics-note">
              Showing the five most frequent recorded causes.
            </p>
          )}
          {analytics.fixed > 0 && (
            <p className="analytics-note">
              {analytics.fixed} earlier{" "}
              {analytics.fixed === 1 ? "failure has" : "failures have"} since
              passed and {analytics.fixed === 1 ? "is" : "are"} not counted.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
