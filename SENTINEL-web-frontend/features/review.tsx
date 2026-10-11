"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  History,
  MapPin,
  Search,
} from "lucide-react";
import {
  humanize,
  selectQueue,
  shortTime,
  type Configuration,
  type FindingStatus,
} from "@sentinel/core";
import type { QueueItem } from "@sentinel/core/api";
import {
  Button,
  ConfigurationControl,
  Empty,
  PageHeading,
  Tag,
} from "../components/ui";
import { FacilityMap, hasMapPoint } from "../components/facility-map";
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

type Grouping = "priority" | "cause" | "place";

const VERDICT_TONE: Record<QueueItem["verdict"], string> = {
  inspection_failure: "amber",
  equipment_finding: "red",
  unsupported_claim: "blue",
};

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
  const [grouping, setGrouping] = useState<Grouping>("cause");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const data = useInspectionData();
  const queue = useQueue();
  const { reviewedIds, markReviewed, resetReviews } = useReviews();
  const scenarios = new globalThis.Map(
    data.missions.map((mission) => [mission.mission_id, mission.scenario]),
  );
  const scope = selectQueue(queue, {
    configuration,
    status: "all",
    missionId,
    scenarios,
  });
  const needle = query.trim().toLowerCase();
  const matches = selectQueue(queue, {
    configuration,
    status,
    reviewedIds,
    missionId,
    scenarios,
  })
    .filter((item) =>
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
        .includes(needle),
    )
    .sort((a, b) => b.rank - a.rank);
  const groups = groupItems(matches, grouping, (item) =>
    grouping === "cause"
      ? operatorText(humanize(item.cause))
      : placeName(data, item.location_id),
  );
  const visible = groups.flatMap((group) =>
    collapsed.includes(group.key) ? [] : group.items,
  );
  const ordered = groups.flatMap((group) => group.items);
  const selected =
    ordered.find((item) => item.id === selectedId) ?? ordered[0] ?? null;
  const reviewedInScope = scope.filter((item) =>
    reviewedIds.includes(item.id),
  ).length;

  function select(item: QueueItem | undefined) {
    if (!item) return;
    setSelectedId(item.id);
    setShowDetail(true);
  }

  function step(direction: 1 | -1) {
    const index = visible.findIndex((item) => item.id === selected?.id);
    const next =
      visible[Math.max(0, Math.min(visible.length - 1, index + direction))];
    if (!next) return;
    setSelectedId(next.id);
    document
      .getElementById("queue-" + cssId(next.id))
      ?.scrollIntoView?.({ block: "nearest" });
  }

  function review(item: QueueItem) {
    markReviewed(item.id);
    // Move straight to the next item so the operator keeps working down the list.
    const index = visible.findIndex((row) => row.id === item.id);
    const next =
      status === "required"
        ? (visible[index + 1] ?? visible[index - 1])
        : visible[index + 1];
    if (next) setSelectedId(next.id);
  }

  const keys = useRef({ step, review, selected });
  useEffect(() => {
    keys.current = { step, review, selected };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest("input, textarea, select, dialog")
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "j" || key === "arrowdown") {
        event.preventDefault();
        keys.current.step(1);
      } else if (key === "k" || key === "arrowup") {
        event.preventDefault();
        keys.current.step(-1);
      } else if (key === "r" && keys.current.selected) {
        keys.current.review(keys.current.selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      <div className="toolbar review-toolbar">
        <ConfigurationControl
          value={configuration}
          onChange={setConfiguration}
        />
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
      <div
        className="triage"
        data-view={showDetail && selected ? "detail" : "list"}
      >
        <section className="triage-list" aria-label="Queue">
          <header className="triage-list-head">
            <div className="triage-progress">
              <div>
                <strong>{scope.length - reviewedInScope}</strong> left
                <span>
                  {reviewedInScope} of {scope.length} reviewed
                </span>
              </div>
              <div
                className="triage-meter"
                role="progressbar"
                aria-label="Reviewed"
                aria-valuemin={0}
                aria-valuemax={scope.length}
                aria-valuenow={reviewedInScope}
              >
                <i
                  style={{
                    width:
                      (scope.length
                        ? (reviewedInScope / scope.length) * 100
                        : 0) + "%",
                  }}
                />
              </div>
            </div>
            <div className="triage-group" role="group" aria-label="Group queue">
              <span>Group by</span>
              {(
                [
                  ["cause", "Cause"],
                  ["place", "Place"],
                  ["priority", "Priority"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={grouping === value ? "active" : ""}
                  aria-pressed={grouping === value}
                  onClick={() => setGrouping(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>
          <div className="triage-scroll">
            {matches.length ? (
              groups.map((group) => {
                const closed = collapsed.includes(group.key);
                return (
                  <div className="triage-group-block" key={group.key}>
                    {grouping !== "priority" && (
                      <button
                        className="triage-group-head"
                        aria-expanded={!closed}
                        onClick={() =>
                          setCollapsed((keys) =>
                            closed
                              ? keys.filter((key) => key !== group.key)
                              : [...keys, group.key],
                          )
                        }
                      >
                        <ChevronDown className="icon" />
                        <span>{group.label}</span>
                        <b>{group.items.length}</b>
                      </button>
                    )}
                    {!closed &&
                      group.items.map((item) => (
                        <QueueRow
                          key={item.id}
                          item={item}
                          grouping={grouping}
                          active={item.id === selected?.id}
                          reviewed={reviewedIds.includes(item.id)}
                          onOpen={select}
                        />
                      ))}
                  </div>
                );
              })
            ) : (
              <div className="triage-empty">
                <Empty
                  title={
                    !needle && status === "required" && scope.length
                      ? "Queue is clear"
                      : "No matching queue items"
                  }
                />
              </div>
            )}
          </div>
        </section>
        {selected ? (
          <ReviewDetail
            key={selected.id}
            item={selected}
            reviewed={reviewedIds.includes(selected.id)}
            onReview={() => review(selected)}
            onBack={() => setShowDetail(false)}
          />
        ) : (
          <section
            className="triage-detail triage-detail-empty"
            aria-label="Review item"
          >
            <Check className="icon" />
            <p>
              {scope.length
                ? "Nothing left to review here."
                : "No queue items for this selection."}
            </p>
          </section>
        )}
      </div>
    </>
  );
}

function QueueRow({
  item,
  grouping,
  active,
  reviewed,
  onOpen,
}: {
  item: QueueItem;
  grouping: Grouping;
  active: boolean;
  reviewed: boolean;
  onOpen: (item: QueueItem) => void;
}) {
  const data = useInspectionData();
  const cause = operatorText(humanize(item.cause));
  const equipment = equipmentName(data, item.asset_id);
  const place = placeName(data, item.location_id);
  const title =
    grouping === "cause" ? equipment : grouping === "place" ? cause : cause;
  const subtitle =
    grouping === "cause"
      ? place
      : grouping === "place"
        ? equipment
        : equipment + " · " + place;
  const critical = item.evidence.asset_criticality === "CRITICAL";
  const repeats = item.evidence.other_failures_on_asset;
  return (
    <button
      id={"queue-" + cssId(item.id)}
      className={
        "triage-row tone-" +
        VERDICT_TONE[item.verdict] +
        (active ? " active" : "") +
        (reviewed ? " reviewed" : "")
      }
      aria-current={active ? "true" : undefined}
      onClick={() => onOpen(item)}
      aria-label={
        humanize(item.verdict) +
        ", " +
        cause +
        ", " +
        equipment +
        ", " +
        place +
        (reviewed ? ", reviewed" : "")
      }
    >
      <span className="triage-dot" aria-hidden="true">
        {reviewed && <Check className="icon" />}
      </span>
      <span className="triage-row-text">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="triage-row-meta">
        {critical && <em className="flag critical">Critical</em>}
        {typeof repeats === "number" && repeats > 0 && (
          <em
            className="flag"
            title={`${repeats} other failures on this asset`}
          >
            +{repeats}
          </em>
        )}
        <small>{missionName(data, item.mission_id)}</small>
      </span>
    </button>
  );
}

function ReviewDetail({
  item,
  reviewed,
  onReview,
  onBack,
}: {
  item: QueueItem;
  reviewed: boolean;
  onReview: () => void;
  onBack: () => void;
}) {
  const data = useInspectionData();
  const description = issueDescription(item);
  const action = data.actions.find(
    (row) =>
      row.action_id === item.action_id && row.mission_id === item.mission_id,
  );
  const location = data.locations.find(
    (row) => row.location_id === item.location_id,
  );
  const asset = data.assets.find((row) => row.asset_id === item.asset_id);
  const battery = action?.battery_pct ?? item.evidence.battery_pct;
  const measurement =
    typeof item.evidence.measurement_type === "string" &&
    item.evidence.measurement_value != null
      ? operatorText(humanize(item.evidence.measurement_type)) +
        " " +
        item.evidence.measurement_value
      : null;
  const repeats = item.evidence.other_failures_on_asset;
  const facts: [string, string][] = [
    [
      "Check",
      action ? operatorText(humanize(action.action_type)) : "Not recorded",
    ],
    [
      "Recorded",
      action?.timestamp ? shortTime(action.timestamp) : "Not recorded",
    ],
    ["Battery", battery == null ? "Not recorded" : battery + "%"],
    [
      "Asset priority",
      asset ? operatorText(humanize(asset.criticality)) : "Not recorded",
    ],
    [
      "Other failures here",
      typeof repeats === "number" ? String(repeats) : "None recorded",
    ],
  ];
  if (measurement) facts.push(["Measurement", measurement]);
  const replayHref =
    "/replay?mission=" +
    encodeURIComponent(item.mission_id) +
    (item.action_id ? "&action=" + encodeURIComponent(item.action_id) : "");
  return (
    <section className="triage-detail" aria-label="Review item">
      <div className="triage-detail-scroll">
        <button className="triage-back" onClick={onBack}>
          <ArrowLeft className="icon" />
          Queue
        </button>
        <header className="triage-detail-head">
          <div className="row">
            <Tag tone={reviewed ? "green" : VERDICT_TONE[item.verdict]}>
              {reviewed ? "Reviewed" : humanize(item.verdict)}
            </Tag>
            <span className="small muted">
              {missionName(data, item.mission_id)}
            </span>
          </div>
          <h2>{operatorText(humanize(item.cause))}</h2>
          <p className="triage-where">
            <strong>{equipmentName(data, item.asset_id)}</strong>
            <span>{placeName(data, item.location_id)}</span>
          </p>
        </header>
        <div className="triage-detail-grid">
          <div className="triage-map">
            {hasMapPoint(item.location_id) ? (
              <>
                <FacilityMap
                  selected={item.location_id ?? ""}
                  focus
                  pin={
                    item.verdict === "unsupported_claim" ? "moving" : "failed"
                  }
                />
                <span className="triage-map-label">
                  <MapPin className="icon" />
                  {item.location_id}
                  {location ? " · Floor " + location.floor : ""}
                </span>
              </>
            ) : (
              <p className="small muted">
                Location not recorded on the floor plan.
              </p>
            )}
          </div>
          <dl className="triage-facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="triage-summary">{description.summary}</p>
        {description.context && (
          <p className="small muted">{description.context}</p>
        )}
        <div className="triage-next">
          <strong>Recommended next step</strong>
          <p>{description.nextStep}</p>
        </div>
      </div>
      <footer className="triage-actions">
        <div className="row">
          <Button className="green" disabled={reviewed} onClick={onReview}>
            <Check className="icon" />
            {reviewed ? "Reviewed" : "Mark reviewed"}
          </Button>
          <Link className="btn" href={replayHref}>
            <History className="icon" />
            Replay
          </Link>
          <Link
            className="btn"
            href={"/missions/" + encodeURIComponent(item.mission_id)}
          >
            Open mission
          </Link>
        </div>
        <p className="triage-keys">
          <kbd>J</kbd>
          <kbd>K</kbd> move <kbd>R</kbd> mark reviewed
        </p>
      </footer>
    </section>
  );
}

function groupItems(
  items: QueueItem[],
  grouping: Grouping,
  labelOf: (item: QueueItem) => string,
) {
  if (grouping === "priority") return [{ key: "all", label: "All", items }];
  const groups = new Map<
    string,
    { key: string; label: string; items: QueueItem[] }
  >();
  for (const item of items) {
    const key =
      grouping === "cause" ? item.cause : (item.location_id ?? "none");
    const group = groups.get(key) ?? { key, label: labelOf(item), items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  // Items arrive highest priority first, so group order follows each group's top item.
  return [...groups.values()];
}

function cssId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "-");
}
