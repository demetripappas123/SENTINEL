"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  humanize,
  selectQueue,
  type Configuration,
  type FindingStatus,
} from "@sentinel/core";
import type { QueueItem } from "@sentinel/core/api";
import {
  Button,
  ConfigurationControl,
  Empty,
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
import { useReviews } from "../lib/browser-state";
import { useInspectionData } from "../lib/inspection-data";
import { useQueue } from "../lib/queue-data";

export function ReviewQueue({
  missionId,
  initialConfiguration = "ALL",
}: {
  missionId?: string;
  initialConfiguration?: Configuration;
}) {
  const [configuration, setConfiguration] =
    useState<Configuration>(initialConfiguration);
  const [status, setStatus] = useState<FindingStatus>(
    missionId ? "all" : "required",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const data = useInspectionData();
  const queue = useQueue();
  const { reviewedIds, markReviewed, resetReviews } = useReviews();
  const scenarios = new globalThis.Map(
    data.missions.map((mission) => [mission.mission_id, mission.scenario]),
  );
  const items = selectQueue(queue, {
    configuration,
    status,
    reviewedIds,
    missionId,
    scenarios,
  }).filter((item) =>
    [
      equipmentName(data, item.asset_id),
      placeName(data, item.location_id),
      missionName(data, item.mission_id),
      operatorText(humanize(item.cause)),
      issueDescription(item).summary,
      item.asset_id,
      item.location_id,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={
          missionId ? "Review · " + missionName(data, missionId) : "Review"
        }
      >
        <Button className="quiet" onClick={resetReviews}>
          Reset reviews
        </Button>
      </PageHeading>
      <div className="toolbar">
        <ConfigurationControl
          value={configuration}
          onChange={setConfiguration}
        />
      </div>
      <div className="queue-toolbar">
        <div className="segmented" role="group" aria-label="Queue status">
          {(
            [
              ["required", "To review"],
              ["all", "All"],
              ["reviewed", "Reviewed"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={status === value ? "active" : ""}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search className="icon" />
          <input
            type="search"
            aria-label="Search queue"
            placeholder="Equipment, location, or cause"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <Panel
        title="Queue"
        action={<span className="small muted">Highest priority first</span>}
        className="full-queue"
      >
        <div className="finding-list">
          {items.length ? (
            items.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                reviewed={reviewedIds.includes(item.id)}
                onOpen={setSelected}
              />
            ))
          ) : (
            <Empty title="No matching queue items" />
          )}
        </div>
      </Panel>
      <QueueDialog
        item={selected}
        onClose={() => setSelected(null)}
        onReview={markReviewed}
        reviewed={!!selected && reviewedIds.includes(selected.id)}
      />
    </>
  );
}

function QueueRow({
  item,
  reviewed = false,
  onOpen,
}: {
  item: QueueItem;
  reviewed?: boolean;
  onOpen: (item: QueueItem) => void;
}) {
  const data = useInspectionData();
  return (
    <button
      className={"finding-row " + (reviewed ? "reviewed" : "")}
      onClick={() => onOpen(item)}
      aria-label={
        humanize(item.verdict) +
        ", " +
        operatorText(humanize(item.cause)) +
        ", " +
        (equipmentName(data, item.asset_id) +
          ", " +
          placeName(data, item.location_id)) +
        (reviewed ? ", reviewed" : "")
      }
    >
      <div className="stack">
        <strong>{operatorText(humanize(item.cause))}</strong>
        <p>{issueDescription(item).summary}</p>
        <p className="small muted">
          {equipmentName(data, item.asset_id)} ·{" "}
          {placeName(data, item.location_id)}
        </p>
      </div>
      <Tag
        tone={
          reviewed
            ? "green"
            : item.verdict === "inspection_failure"
              ? "amber"
              : "blue"
        }
      >
        {reviewed ? "Reviewed" : humanize(item.verdict)}
      </Tag>
    </button>
  );
}

function QueueDialog({
  item,
  onClose,
  onReview,
  reviewed,
}: {
  item: QueueItem | null;
  onClose: () => void;
  onReview: (id: string) => void;
  reviewed: boolean;
}) {
  const data = useInspectionData();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (item && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [item]);
  if (!item) return null;
  const description = issueDescription(item);
  return (
    <dialog
      ref={ref}
      aria-labelledby="queue-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="dialog-head">
        <div>
          <div className="row">
            <Tag
              tone={item.verdict === "inspection_failure" ? "amber" : "blue"}
            >
              {humanize(item.verdict)}
            </Tag>
          </div>
          <h2 id="queue-title">{operatorText(humanize(item.cause))}</h2>
        </div>
        <Button
          className="quiet square"
          aria-label="Close queue item"
          onClick={onClose}
        >
          <X className="icon" />
        </Button>
      </header>
      <div className="dialog-content">
        <strong>{equipmentName(data, item.asset_id)}</strong>
        <p className="small muted">
          {placeName(data, item.location_id)} ·{" "}
          {missionName(data, item.mission_id)}
        </p>
        <p>{description.summary}</p>
        {description.context && (
          <p className="small muted">{description.context}</p>
        )}
        <div className="explanation">
          <strong>Recommended next step</strong>
          <p>{description.nextStep}</p>
        </div>
        <div className="row">
          <Link
            className="btn"
            href={"/missions/" + encodeURIComponent(item.mission_id)}
          >
            Open mission
          </Link>
          {!reviewed && (
            <Button className="green" onClick={() => onReview(item.id)}>
              Mark reviewed
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}
