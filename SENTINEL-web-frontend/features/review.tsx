"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import {
  dataset,
  getFindings,
  type Configuration,
  type Finding,
  type FindingStatus,
} from "@sentinel/core";
import {
  Button,
  ConfigurationControl,
  Empty,
  PageHeading,
  Panel,
} from "../components/ui";
import { FindingDialog, FindingRow } from "../components/findings";
import { ApiQueuePanel } from "../components/api-queue";
import { useReviews } from "../lib/browser-state";

export function ReviewQueue({ missionId }: { missionId?: string }) {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const [status, setStatus] = useState<FindingStatus>(
    missionId ? "all" : "required",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Finding | null>(null);
  const { reviewedIds, markReviewed, resetReviews } = useReviews();
  const findings = getFindings(dataset, {
    configuration,
    status,
    query,
    reviewedIds,
    missionId,
  });
  return (
    <>
      <PageHeading title={missionId ? "Findings · " + missionId : "Review"}>
        <Button className="quiet" onClick={resetReviews}>
          Reset reviews
        </Button>
      </PageHeading>
      <ApiQueuePanel missionId={missionId} />
      <div className="toolbar">
        <ConfigurationControl
          value={configuration}
          onChange={setConfiguration}
        />
      </div>
      <div className="queue-toolbar">
        <div className="segmented" role="group" aria-label="Finding status">
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
            aria-label="Search findings"
            placeholder="Asset or waypoint"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <Panel
        title="Findings"
        action={<span className="small muted">By severity</span>}
        className="full-queue"
      >
        <div className="finding-list">
          {findings.length ? (
            findings.map((f) => (
              <FindingRow
                key={f.anomaly_id}
                finding={f}
                reviewed={reviewedIds.includes(f.anomaly_id)}
                onOpen={setSelected}
              />
            ))
          ) : (
            <Empty />
          )}
        </div>
      </Panel>
      <FindingDialog
        finding={selected}
        onClose={() => setSelected(null)}
        onReview={markReviewed}
        reviewed={!!selected && reviewedIds.includes(selected.anomaly_id)}
      />
    </>
  );
}
