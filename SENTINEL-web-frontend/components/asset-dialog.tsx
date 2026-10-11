"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { humanize, shortTime, type Finding } from "@sentinel/core";
import { useInspectionData } from "../lib/inspection-data";
import { operatorText, placeName } from "../lib/operator-copy";
import { FindingRow } from "./findings";
import { Button, severityTone, Tag } from "./ui";

// One asset: latest inspection, readings, and the findings recorded on it.
export function AssetDialog({
  assetId,
  onClose,
  onOpenFinding,
  reviewedIds,
}: {
  assetId: string | null;
  onClose: () => void;
  onOpenFinding: (finding: Finding) => void;
  reviewedIds: string[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (assetId && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [assetId]);
  const data = useInspectionData();
  const asset = data.assets.find((a) => a.asset_id === assetId);
  if (!asset) return null;
  const actions = data.actions
    .filter((a) => a.asset_id === asset.asset_id)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  const latest = actions[0];
  // Readings come from the most recent inspection that recorded any.
  const readingAction = actions.find((a) =>
    data.readings.some((r) => r.action_id === a.action_id),
  );
  const readings = readingAction
    ? data.readings.filter((r) => r.action_id === readingAction.action_id)
    : [];
  const findings = data.findings
    .filter((f) => f.asset_id === asset.asset_id)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  return (
    <dialog
      ref={ref}
      aria-labelledby="asset-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="dialog-head">
        <div>
          <div className="row">
            <Tag tone={severityTone(asset.criticality)}>
              {humanize(asset.criticality)}
            </Tag>
            <span className="small muted mono">{asset.asset_id}</span>
          </div>
          <h2 id="asset-title">{asset.asset_name}</h2>
        </div>
        <Button className="quiet square" aria-label="Close asset" onClick={onClose}>
          <X className="icon" />
        </Button>
      </header>
      <div className="dialog-content">
        <dl className="fact-list">
          <div className="fact">
            <dt>Type</dt>
            <dd>{humanize(asset.asset_type)}</dd>
          </div>
          <div className="fact">
            <dt>Location</dt>
            <dd>{placeName(data, asset.location_id)}</dd>
          </div>
          <div className="fact">
            <dt>Last inspected</dt>
            <dd>
              {latest
                ? shortTime(latest.timestamp) + " · " + humanize(latest.status)
                : "Never"}
            </dd>
          </div>
          <div className="fact">
            <dt>Inspections</dt>
            <dd>
              {actions.length} ·{" "}
              {actions.filter((a) => a.status === "FAILED").length} failed
            </dd>
          </div>
        </dl>
        <div className="inspector-section">Latest readings</div>
        {readings.length ? (
          readings.map((r) => (
            <div className="reading-row" key={r.reading_id}>
              <span>
                {operatorText(humanize(r.measurement_type))}
                <br />
                <small className="muted">
                  Quality: {operatorText(humanize(r.quality))}
                </small>
              </span>
              <strong>
                {r.value} {r.unit}
              </strong>
            </div>
          ))
        ) : (
          <p className="panel-body small muted">No reading recorded.</p>
        )}
        <div className="inspector-section">Findings · {findings.length}</div>
        {findings.length ? (
          findings.map((f) => (
            <FindingRow
              key={f.anomaly_id}
              finding={f}
              reviewed={reviewedIds.includes(f.anomaly_id)}
              onOpen={(finding) => {
                onClose();
                onOpenFinding(finding);
              }}
            />
          ))
        ) : (
          <p className="panel-body small muted">No findings on this asset.</p>
        )}
      </div>
    </dialog>
  );
}
