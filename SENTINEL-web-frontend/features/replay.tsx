"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CircleCheck,
  CirclePlay,
  Flag,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  TriangleAlert,
} from "lucide-react";
import {
  humanize,
  shortTime,
  type Action,
  type Configuration,
  type InspectionDataset,
  type ReplayEvent,
} from "@sentinel/core";
import {
  Button,
  ConfigurationControl,
  PageHeading,
  Tag,
} from "../components/ui";
import {
  FacilityMap,
  hasMapPoint,
  type MapMark,
} from "../components/facility-map";
import {
  equipmentName,
  missionName,
  operatorText,
  placeName,
  replayDescription,
} from "../lib/operator-copy";
import { useInspectionData } from "../lib/inspection-data";

const SPEEDS = [
  [1, 650],
  [2, 325],
  [4, 160],
] as const;

export function Replay({
  initialMission,
  initialAction,
}: {
  initialMission?: string;
  initialAction?: string;
}) {
  const data = useInspectionData();
  const linked = data.missions.find((m) => m.mission_id === initialMission);
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const [mission, setMission] = useState(linked ? linked.mission_id : "");
  const missions = data.missions.filter(
    (m) => configuration === "ALL" || m.configuration_version === configuration,
  );
  const missionIds = new Set(
    (mission ? missions.filter((m) => m.mission_id === mission) : missions).map(
      (m) => m.mission_id,
    ),
  );
  const events = data.events.filter((event) =>
    missionIds.has(event.mission_id),
  );
  const start =
    mission === initialMission && initialAction
      ? Math.max(
          0,
          events.findIndex(
            (event) =>
              event.details.action_id === initialAction &&
              event.event_type !== "ACTION_STARTED",
          ),
        )
      : 0;
  return (
    <>
      <PageHeading title="Replay" />
      <div className="toolbar replay-toolbar">
        <ConfigurationControl
          value={configuration}
          onChange={(next) => {
            setConfiguration(next);
            setMission("");
          }}
        />
        <select
          className="select"
          aria-label="Mission"
          value={mission}
          onChange={(event) => setMission(event.target.value)}
        >
          <option value="">All missions in order</option>
          {missions.map((m) => (
            <option key={m.mission_id} value={m.mission_id}>
              {missionName(data, m.mission_id)}
              {m.start_time ? " · " + shortTime(m.start_time) : ""}
            </option>
          ))}
        </select>
        <Tag tone="blue">Recorded · not live</Tag>
      </div>
      <ReplayPlayer
        key={configuration + ":" + mission}
        events={events}
        start={start}
      />
    </>
  );
}

function ReplayPlayer({
  events,
  start,
}: {
  events: ReplayEvent[];
  start: number;
}) {
  const data = useInspectionData();
  const [position, setPosition] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [follow, setFollow] = useState(true);
  const current = events[position];
  const atEnd = position === events.length - 1;
  useEffect(() => {
    if (!playing || atEnd) return;
    const delay = SPEEDS.find(([value]) => value === speed)?.[1] ?? 650;
    const timer = setInterval(
      () => setPosition((value) => Math.min(value + 1, events.length - 1)),
      delay,
    );
    return () => clearInterval(timer);
  }, [playing, atEnd, events.length, speed]);
  if (!current)
    return (
      <div className="replay-empty">
        <p>No recorded events for this selection.</p>
      </div>
    );
  const failures = events.flatMap((event, index) =>
    event.event_type === "ACTION_FAILED" ? [index] : [],
  );
  const previousFailure = [...failures]
    .reverse()
    .find((index) => index < position);
  const nextFailure = failures.find((index) => index > position);
  const scene = sceneAt(data, events, position);
  const last = events.length - 1;
  const jump = (index: number | undefined) => {
    if (index == null) return;
    setPlaying(false);
    setPosition(index);
  };
  return (
    <div className="replay">
      <div className="replay-stage">
        <section className="replay-map" aria-label="Robot position">
          <FacilityMap
            selected={scene.location ?? ""}
            focus={follow}
            focusScale={1.6}
            trail={scene.trail}
            marks={scene.marks}
            pin={hasMapPoint(scene.location) ? scene.tone : undefined}
          />
          <div className="replay-map-chip">
            <MapPin className="icon" />
            {scene.location ? (
              <>
                <strong>{placeName(data, scene.location)}</strong>
                <span>{scene.location}</span>
              </>
            ) : (
              <strong>Robot at dock</strong>
            )}
          </div>
          <label className="replay-follow">
            <input
              type="checkbox"
              checked={follow}
              onChange={(event) => setFollow(event.target.checked)}
            />
            Follow robot
          </label>
          <ul className="replay-legend" aria-label="Map key">
            <li>
              <i className="route" /> Route so far
            </li>
            <li>
              <i className="passed" /> Passed
            </li>
            <li>
              <i className="failed" /> Failed
            </li>
          </ul>
        </section>
        <NowPanel
          event={current}
          scene={scene}
          recent={events
            .slice(Math.max(0, position - 4), position + 1)
            .reverse()}
        />
      </div>
      <section className="replay-transport" aria-label="Replay controls">
        <div className="replay-buttons">
          <Button
            className="blue"
            onClick={() => {
              if (atEnd) setPosition(0);
              setPlaying(atEnd || !playing);
            }}
            aria-label={playing && !atEnd ? "Pause replay" : "Play replay"}
          >
            {playing && !atEnd ? (
              <Pause className="icon" />
            ) : (
              <Play className="icon" />
            )}
            {playing && !atEnd ? "Pause" : "Play"}
          </Button>
          <Button
            aria-label="Reset replay"
            onClick={() => {
              setPlaying(false);
              setPosition(0);
            }}
          >
            <RotateCcw className="icon" />
          </Button>
          <span className="replay-divider" aria-hidden="true" />
          <Button
            aria-label="Previous failure"
            disabled={previousFailure == null}
            onClick={() => jump(previousFailure)}
          >
            <SkipBack className="icon" />
          </Button>
          <Button
            aria-label="Next failure"
            disabled={nextFailure == null}
            onClick={() => jump(nextFailure)}
          >
            Next failure
            <SkipForward className="icon" />
          </Button>
          <div
            className="segmented replay-speed"
            role="group"
            aria-label="Playback speed"
          >
            {SPEEDS.map(([value]) => (
              <button
                key={value}
                className={speed === value ? "active" : ""}
                aria-pressed={speed === value}
                onClick={() => setSpeed(value)}
              >
                {value}×
              </button>
            ))}
          </div>
          <span className="replay-count mono">
            {position + 1} / {events.length}
          </span>
        </div>
        <div className="replay-track">
          <div className="replay-rail" aria-hidden="true">
            <i
              className="replay-fill"
              style={{ width: (last ? (position / last) * 100 : 100) + "%" }}
            />
            {events.map((event, index) =>
              event.event_type === "MISSION_STARTED" && index > 0 ? (
                <span
                  key={event.event_id}
                  className="replay-tick mission"
                  style={{ left: (index / last) * 100 + "%" }}
                />
              ) : null,
            )}
            {failures.map((index) => (
              <span
                key={events[index].event_id}
                className={
                  "replay-tick failure" + (index === position ? " current" : "")
                }
                style={{ left: (last ? (index / last) * 100 : 0) + "%" }}
              />
            ))}
            <span
              className="replay-thumb"
              style={{ left: (last ? (position / last) * 100 : 0) + "%" }}
            />
          </div>
          <input
            type="range"
            min="0"
            max={last}
            value={position}
            aria-label="Replay event position"
            onChange={(event) => {
              setPlaying(false);
              setPosition(Number(event.target.value));
            }}
          />
        </div>
        <p className="replay-foot">
          <span>
            <i className="tick-key failure" /> {failures.length} failed{" "}
            {failures.length === 1 ? "action" : "actions"}
          </span>
          <span>
            Recording ends during {missionName(data, events[last].mission_id)}
          </span>
        </p>
      </section>
    </div>
  );
}

function NowPanel({
  event,
  scene,
  recent,
}: {
  event: ReplayEvent;
  scene: Scene;
  recent: ReplayEvent[];
}) {
  const data = useInspectionData();
  const failed = event.event_type === "ACTION_FAILED";
  const done = event.event_type === "ACTION_COMPLETED";
  const Icon = failed
    ? TriangleAlert
    : done
      ? CircleCheck
      : event.event_type.startsWith("MISSION")
        ? Flag
        : CirclePlay;
  const failure =
    typeof event.details.failure_type === "string" && event.details.failure_type
      ? event.details.failure_type
      : scene.action?.failure_type;
  const battery =
    typeof event.details.battery_pct === "number"
      ? event.details.battery_pct
      : typeof event.details.end_battery_pct === "number"
        ? event.details.end_battery_pct
        : scene.action?.battery_pct;
  const mission = data.missions.find((m) => m.mission_id === event.mission_id);
  return (
    <aside
      className={"replay-now" + (failed ? " failed" : done ? " passed" : "")}
      aria-label="Current event"
    >
      <header>
        <Tag tone="blue">{missionName(data, event.mission_id)}</Tag>
        {mission?.configuration_version && (
          <span className="small muted">{mission.configuration_version}</span>
        )}
        <span className="mono muted">{shortTime(event.timestamp)}</span>
      </header>
      <div className="replay-event">
        <span className="replay-event-icon">
          <Icon className="icon" />
        </span>
        <div>
          <strong>{operatorText(humanize(event.event_type))}</strong>
          <p>{replayDescription(data, event)}</p>
        </div>
      </div>
      {failed && (
        <div className="replay-problem">
          <strong>
            {failure ? operatorText(humanize(failure)) : "Action failed"}
          </strong>
          <p>
            {scene.action?.asset_id
              ? equipmentName(data, scene.action.asset_id) + " at "
              : "At "}
            {placeName(data, scene.location)}
            {scene.location ? " (" + scene.location + ")" : ""}
          </p>
          <Link
            className="link-button"
            href={"/review?mission=" + encodeURIComponent(event.mission_id)}
          >
            Review this mission ↗
          </Link>
        </div>
      )}
      <dl className="replay-stats">
        <div>
          <dt>Check</dt>
          <dd>{scene.step ? scene.step + " of " + scene.steps.length : "—"}</dd>
        </div>
        <div>
          <dt>Battery</dt>
          <dd>
            {battery == null ? "—" : battery + "%"}
            {battery != null && (
              <span className="replay-battery">
                <i
                  className={battery < 40 ? "low" : ""}
                  style={{ width: Math.max(0, Math.min(100, battery)) + "%" }}
                />
              </span>
            )}
          </dd>
        </div>
      </dl>
      {scene.steps.length > 0 && (
        <div className="replay-steps" aria-label="Checks in this mission">
          {scene.steps.map((step, index) => (
            <span
              key={step.action_id}
              className={step.state + (index + 1 === scene.step ? " now" : "")}
              title={
                operatorText(humanize(step.action_type)) +
                " · " +
                placeName(data, step.location_id)
              }
            />
          ))}
        </div>
      )}
      <ul className="replay-recent" aria-label="Recent events">
        {recent.map((row) => (
          <li key={row.event_id}>
            <i
              className={
                row.event_type === "ACTION_FAILED"
                  ? "failed"
                  : row.event_type === "ACTION_COMPLETED"
                    ? "passed"
                    : ""
              }
            />
            <span>
              {operatorText(humanize(row.event_type))}
              {row.mission_id !== event.mission_id
                ? " · " + missionName(data, row.mission_id)
                : ""}
            </span>
            <time>
              {shortTime(row.timestamp).split(" · ")[1] ??
                shortTime(row.timestamp)}
            </time>
          </li>
        ))}
      </ul>
    </aside>
  );
}

type Scene = {
  location: string | null;
  trail: string[];
  marks: Record<string, MapMark>;
  tone: "failed" | "passed" | "moving";
  action: Action | undefined;
  step: number;
  steps: (Action & { state: "passed" | "failed" | "pending" })[];
};

function sceneAt(
  data: InspectionDataset,
  events: ReplayEvent[],
  position: number,
): Scene {
  const current = events[position];
  let first = position;
  while (first > 0 && events[first - 1].mission_id === current.mission_id)
    first -= 1;
  const outcomes = new Map<string, "passed" | "failed">();
  const trail: string[] = [];
  let location: string | null = null;
  for (let index = first; index <= position; index += 1) {
    const event = events[index];
    const actionId = event.details.action_id;
    const action =
      typeof actionId === "string"
        ? data.actions.find((row) => row.action_id === actionId)
        : undefined;
    const where =
      (typeof event.details.location_id === "string" &&
        event.details.location_id) ||
      action?.location_id ||
      null;
    if (event.event_type === "ACTION_STARTED" && where) {
      if (trail[trail.length - 1] !== where) trail.push(where);
    }
    if (where) location = where;
    if (typeof actionId === "string") {
      if (event.event_type === "ACTION_FAILED")
        outcomes.set(actionId, "failed");
      if (event.event_type === "ACTION_COMPLETED")
        outcomes.set(actionId, "passed");
    }
  }
  const steps = data.actions
    .filter((action) => action.mission_id === current.mission_id)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((action) => ({
      ...action,
      state: outcomes.get(action.action_id) ?? ("pending" as const),
    }));
  const marks: Record<string, MapMark> = {};
  for (const step of steps) {
    if (!step.location_id || step.state === "pending") continue;
    if (step.state === "failed" || !marks[step.location_id])
      marks[step.location_id] = step.state;
  }
  const actionId = current.details.action_id;
  const action =
    typeof actionId === "string"
      ? data.actions.find((row) => row.action_id === actionId)
      : undefined;
  const stepIndex = action
    ? steps.findIndex((step) => step.action_id === action.action_id)
    : -1;
  return {
    location,
    trail,
    marks,
    tone:
      current.event_type === "ACTION_FAILED"
        ? "failed"
        : current.event_type === "ACTION_COMPLETED"
          ? "passed"
          : "moving",
    action,
    step: stepIndex + 1,
    steps,
  };
}
