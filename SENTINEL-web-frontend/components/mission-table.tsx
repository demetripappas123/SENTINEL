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
import { missionName, operatorText } from "../lib/operator-copy";
import { forwardRowClick } from "../lib/row-link";
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
              failed = actions.filter((a) => a.status === "FAILED").length,
              awaiting = actions.length - passed - failed,
              label = missionLabel(m);
            return (
              <tr
                key={m.mission_id}
                className="linked-row"
                onClick={forwardRowClick}
              >
                <td>
                  <Link
                    className="mission-link"
                    href={"/missions/" + encodeURIComponent(m.mission_id)}
                  >
                    <span>{missionName(data, m.mission_id)}</span>
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
                    {operatorText(humanize(label))}
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
                            className={
                              a.status === "FAILED"
                                ? "failed"
                                : a.status === "SUCCESS"
                                  ? ""
                                  : "awaiting"
                            }
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
                        ? operatorText(
                            pending(m.configuration_version),
                            "Not specified",
                          ) +
                          " · " +
                          (m.scenario
                            ? operatorText(
                                humanize(m.scenario),
                                "Not specified",
                              )
                            : "—")
                        : "—"}
                    </Tag>
                  ) : actions.length === 0 ? (
                    <span className="muted small">No actions</span>
                  ) : failed > 0 ? (
                    <Tag tone="amber">{failed} failed</Tag>
                  ) : awaiting > 0 ? (
                    <span className="muted small">
                      {awaiting} awaiting outcome
                    </span>
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
