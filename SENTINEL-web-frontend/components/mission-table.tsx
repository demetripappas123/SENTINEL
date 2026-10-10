import Link from "next/link";
import {
  humanize,
  missionActions,
  shortTime,
  type Mission,
} from "@sentinel/core";
import { Tag } from "./ui";

export function MissionTable({
  missions,
  full = false,
}: {
  missions: Mission[];
  full?: boolean;
}) {
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
            const actions = missionActions(m.mission_id),
              passed = actions.filter((a) => a.status === "SUCCESS").length;
            return (
              <tr key={m.mission_id}>
                <td>
                  <Link
                    className="mission-link"
                    href={"/missions/" + m.mission_id}
                  >
                    <span className="mono">{m.mission_id}</span>
                    <span>Route {Number(m.mission_id.slice(1))}</span>
                  </Link>
                  {full && (
                    <small className="muted">{shortTime(m.start_time)}</small>
                  )}
                </td>
                <td>
                  <Tag
                    tone={m.mission_status === "COMPLETED" ? "green" : "red"}
                  >
                    {humanize(m.mission_status)}
                  </Tag>
                </td>
                <td className="number">
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
                </td>
                <td>
                  {full ? (
                    <Tag tone="blue">
                      {m.configuration_version} · {humanize(m.scenario)}
                    </Tag>
                  ) : actions.length > passed ? (
                    <Tag tone="amber">{actions.length - passed} failed</Tag>
                  ) : (
                    <span className="muted small">No failures</span>
                  )}
                </td>
                {full && (
                  <td className="mono">
                    {m.start_battery_pct}% → {m.end_battery_pct}%
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
