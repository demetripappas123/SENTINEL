"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import {
  assetName,
  humanize,
  formatFindingDescription,
  locationName,
  sampleImage,
  shortTime,
  type Finding,
} from "@sentinel/core";
import { useInspectionData } from "../lib/inspection-data";
import { Button, severityTone, Tag } from "./ui";

export function FindingRow({
  finding: f,
  reviewed = false,
  onOpen,
}: {
  finding: Finding;
  reviewed?: boolean;
  onOpen: (finding: Finding) => void;
}) {
  const data = useInspectionData();
  return (
    <button
      className={
        "finding-row severity-" +
        f.severity.toLowerCase() +
        (reviewed ? " reviewed" : "")
      }
      onClick={() => onOpen(f)}
      aria-label={
        humanize(f.anomaly_type) +
        ", " +
        humanize(f.severity) +
        ", " +
        f.asset_id +
        ", " +
        locationName(data, f.location_id) +
        (reviewed ? ", reviewed" : "")
      }
    >
      {reviewed ? (
        <Check className="icon" />
      ) : (
        <TriangleAlert className="icon" />
      )}
      <div className="stack">
        <strong>{humanize(f.anomaly_type)}</strong>
        <p className="mono">
          {f.asset_id} ·{" "}
          <span title={locationName(data, f.location_id)}>{f.location_id}</span> ·{" "}
          {f.mission_id}
        </p>
      </div>
      <Tag tone={reviewed ? "green" : severityTone(f.severity)}>
        {reviewed ? "Reviewed" : humanize(f.severity)}
      </Tag>
    </button>
  );
}
export function Capture({ type }: { type: string }) {
  return (
    <div className="capture">
      <figure>
        <Image
          src={"/demo/" + sampleImage(type)}
          alt="Illustrative inspection sample"
          width={640}
          height={360}
          unoptimized
        />
        <figcaption>Kit illustration · not this record’s capture</figcaption>
      </figure>
    </div>
  );
}
export function FindingDialog({
  finding,
  onClose,
  onReview,
  reviewed,
}: {
  finding: Finding | null;
  onClose: () => void;
  onReview: (id: string) => void;
  reviewed: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (finding && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [finding]);
  const data = useInspectionData();
  if (!finding) return null;
  const action = data.actions.find((a) => a.action_id === finding.action_id);
  const readings = data.readings.filter(
    (r) => r.action_id === finding.action_id,
  );
  return (
    <dialog
      ref={ref}
      aria-labelledby="finding-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="dialog-head">
        <div>
          <div className="row">
            <Tag tone={severityTone(finding.severity)}>
              {humanize(finding.severity)}
            </Tag>
            <span className="mono muted">{finding.anomaly_id}</span>
          </div>
          <h2 id="finding-title">{humanize(finding.anomaly_type)}</h2>
        </div>
        <Button
          className="quiet square"
          aria-label="Close finding"
          onClick={onClose}
        >
          <X className="icon" />
        </Button>
      </header>
      <div className="dialog-content">
        <strong>{assetName(data, finding.asset_id)}</strong>
        <p className="small muted">
          {finding.asset_id} · {finding.location_id} ·{" "}
          {locationName(data, finding.location_id)}
        </p>
        <Capture type={finding.anomaly_type} />
        <dl className="fact-list">
          <div className="fact">
            <dt>Mission</dt>
            <dd>{finding.mission_id}</dd>
          </div>
          <div className="fact">
            <dt>Outcome</dt>
            <dd>{action ? humanize(action.status) : "Unrecorded"}</dd>
          </div>
          <div className="fact">
            <dt>Recorded</dt>
            <dd>{shortTime(finding.timestamp)}</dd>
          </div>
          <div className="fact">
            <dt>Battery</dt>
            <dd>
              {action?.battery_pct == null ? "Pending" : action.battery_pct + "%"}
            </dd>
          </div>
        </dl>
        <div className="inspector-section">Measurements</div>
        {readings.length ? (
          readings.map((r) => (
            <div className="reading-row" key={r.reading_id}>
              <span>
                {humanize(r.measurement_type)}
                <br />
                <small className="muted">Quality: {humanize(r.quality)}</small>
              </span>
              <strong>
                {r.value} {r.unit}
              </strong>
            </div>
          ))
        ) : (
          <p className="panel-body small muted">No reading recorded.</p>
        )}
        <p className="small muted">
          {formatFindingDescription(finding.description)}
        </p>
      </div>
      <footer className="dialog-foot">
        <p>Review state: this session</p>
        <div className="row">
          <Link className="btn" href={"/missions/" + finding.mission_id}>
            View mission
          </Link>
          <Button
            className="green"
            disabled={reviewed}
            onClick={() => {
              onReview(finding.anomaly_id);
              onClose();
            }}
          >
            <Check className="icon" />
            {reviewed ? "Reviewed" : "Mark reviewed"}
          </Button>
        </div>
      </footer>
    </dialog>
  );
}
