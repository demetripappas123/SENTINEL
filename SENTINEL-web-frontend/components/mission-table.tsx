"use client";

import Link from "next/link";
import {
  humanize,
  missionActions,
  missionLabel,
  pending,
  shortTime,
  type Mission,
} from "@sentinel/core";
import { useInspectionData } from "../lib/inspection-data";
import { Tag } from "./ui";

export function MissionTable({
  missions,
  full = false,
}: {
  missions: Mission[];
  full?: boolean;
}) {
  const data = useInspectionData();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mission</th>
            <th>Status</th>
            <th className="number">Passed</th>
            <th>{full ? "Configuration" : "Issues"}</th>
            {full && <th>Battery</th>}
          </tr>
        </thead>
        <tbody>
          {missions.map((m) => {
            const actions = missionActions(data, m.mission_id),
              passed = actions.filter((a) => a.status === "SUCCESS").length,
              label = missionLabel(m);
            return (
              <tr key={m.mission_id}>
                <td>
                  <Link
                    className="mission-link"
                    href={"/missions/" + m.mission_id}
                  >
                    <span className="mono">{m.mission_id}</span>
                    <span>
                      {/^M\d+$/.test(m.mission_id)
                        ? "Route " + Number(m.mission_id.slice(1))
                        : m.mission_name}
                    </span>
                  </Link>
                  {full && (
                    <small className="muted">{shortTime(m.start_time)}</small>
                  )}
                </td>
                <td>
                  <Tag
                    tone={
                      label === "COMPLETED"
                        ? "green"
                        : label === "FAILED"
                          ? "red"
                          : label === "IN_PROGRESS"
                            ? "amber"
                            : ""
                    }
                  >
                    {humanize(label)}
                  </Tag>
                </td>
                <td className="number">
                  {actions.length === 0 ? (
                    <span className="muted small">No actions</span>
                  ) : (
                    <>
                      <span className="mono">
                        {passed}/{actions.length}
                      </span>
                      <div className="mini-progress" aria-hidden="true">
                        {actions.map((a) => (
                          <i
                            key={a.action_id}
                            className={a.status === "FAILED" ? "failed" : ""}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </td>
                <td>
                  {full ? (
                    <Tag tone="blue">
                      {m.configuration_version || m.scenario
                        ? pending(m.configuration_version) +
                          " · " +
                          (m.scenario ? humanize(m.scenario) : "—")
                        : "—"}
                    </Tag>
                  ) : actions.length === 0 ? (
                    <span className="muted small">No actions</span>
                  ) : actions.length > passed ? (
                    <Tag tone="amber">{actions.length - passed} failed</Tag>
                  ) : (
                    <span className="muted small">No failures</span>
                  )}
                </td>
                {full && (
                  <td className="mono">
                    {m.start_battery_pct == null && m.end_battery_pct == null
                      ? "Pending"
                      : pending(m.start_battery_pct) +
                        "% → " +
                        pending(m.end_battery_pct) +
                        "%"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
