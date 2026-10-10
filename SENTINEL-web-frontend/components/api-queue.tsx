"use client";

import { useState } from "react";
import { humanize } from "@sentinel/core";
import { createApiClient, type QueueItem } from "@sentinel/core/api";
import { Button, Panel } from "./ui";

export function ApiQueuePanel({ missionId }: { missionId?: string }) {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadQueue() {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
      setError(
        "Set NEXT_PUBLIC_API_BASE_URL in SENTINEL-web-frontend/.env.local.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const queue = await createApiClient(baseUrl).getQueue();
      setItems(queue);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The API request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  const visibleItems =
    items?.filter((item) => !missionId || item.mission_id === missionId) ?? [];

  return (
    <Panel
      title="Live API queue"
      action={
        <Button
          className="quiet"
          onClick={() => void loadQueue()}
          disabled={loading}
        >
          {loading ? "Loading…" : items ? "Refresh queue" : "Load queue"}
        </Button>
      }
    >
      {loading ? (
        <p className="panel-body small muted" role="status">
          Loading API queue…
        </p>
      ) : error ? (
        <p className="panel-body small" role="alert">
          Could not load the API queue: {error}
        </p>
      ) : !items ? (
        <p className="panel-body small muted">
          Load the queue from the FastAPI backend.
        </p>
      ) : visibleItems.length ? (
        <div className="api-queue-list">
          {visibleItems.map((item) => (
            <article className="api-queue-item" key={item.id}>
              <div className="api-queue-item-head">
                <strong>{humanize(item.verdict)}</strong>
                <span className="mono muted">{item.id}</span>
              </div>
              <p className="small muted">
                {item.cause} · {item.mission_id}
                {item.action_id ? " · " + item.action_id : ""}
                {item.asset_id ? " · " + item.asset_id : ""}
              </p>
              <p>{item.explanation}</p>
              {Object.keys(item.evidence).length > 0 && (
                <details>
                  <summary className="small">Evidence</summary>
                  <pre className="api-queue-evidence">
                    {JSON.stringify(item.evidence, null, 2)}
                  </pre>
                </details>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="panel-body small muted" role="status">
          {missionId
            ? "No API queue items for " + missionId
            : "The API queue is empty."}
        </p>
      )}
    </Panel>
  );
}
