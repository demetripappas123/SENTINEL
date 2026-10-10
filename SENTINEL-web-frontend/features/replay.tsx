"use client";
import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { humanize, shortTime, type Configuration, type ReplayEvent } from "@sentinel/core";
import { Button, ConfigurationControl, PageHeading, Panel, Tag } from "../components/ui";
import { pendingCount, useInspectionData, useInspectionDetailReady } from "../lib/inspection-data";
export function Replay() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const data = useInspectionData();
  const detailReady = useInspectionDetailReady();
  const missionIds = new Set(data.missions
    .filter((m) => configuration === "ALL" || m.scenario === configuration)
    .map((m) => m.mission_id));
  const events = data.events.filter((event) => missionIds.has(event.mission_id));
  return <>
    <PageHeading title="Replay" />
    <div className="toolbar">
      <ConfigurationControl value={configuration} onChange={setConfiguration} />
      <Tag tone="blue">Recorded · not live</Tag>
    </div>
    <ReplayPlayer key={configuration} events={events} />
  </>;
}

function ReplayPlayer({ events }: { events: ReplayEvent[] }) {
  const [position, setPosition] = useState(0),
    [playing, setPlaying] = useState(false);
  const current = events[position],
    atEnd = position === events.length - 1;
  useEffect(() => {
    if (!playing || atEnd) return;
    const timer = setInterval(
      () =>
        setPosition((value) => Math.min(value + 1, events.length - 1)),
      650,
    );
    return () => clearInterval(timer);
  }, [playing, atEnd, events.length]);
  if (!current) return <Panel title="Events"><p className="panel-body">No recorded events for this configuration.</p></Panel>;
  return (
    <>
      <Panel
        title="Events"
        action={
          <span className="small muted">{events.length} events</span>
        }
        footer={<span>Partial stream · full recording ends during M023</span>}
      >
        <div className="replay-control">
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
            Reset
          </Button>
          <input
            type="range"
            min="0"
            max={events.length - 1}
            value={position}
            aria-label="Replay event position"
            onChange={(event) => {
              setPlaying(false);
              setPosition(Number(event.target.value));
            }}
          />
          <span className="mono muted">
            {position + 1} / {events.length}
          </span>
        </div>
        <div className="replay-status">
          <Tag tone="blue">{current.mission_id}</Tag>
          <div>
            <strong>{humanize(current.event_type)}</strong>
            <p>
              {shortTime(current.timestamp)} ·{" "}
              {String(current.details.action_id || "")}
            </p>
          </div>
        </div>
        {events
          .slice(Math.max(0, position - 5), position + 1)
          .reverse()
          .map((e) => (
            <div
              className={
                "event-row " +
                (e.event_id === current.event_id ? "current" : "")
              }
              key={e.event_id}
            >
              <span className="event-time">{shortTime(e.timestamp)}</span>
              <span className="mono">{e.mission_id}</span>
              <span>{humanize(e.event_type)}</span>
              <span className="event-details muted">
                {String(
                  e.details.action_id || e.details.configuration_version || "",
                )}{" "}
                {e.details.failure_type &&
                  humanize(String(e.details.failure_type))}
              </span>
            </div>
          ))}
      </Panel>
    </>
  );
}
