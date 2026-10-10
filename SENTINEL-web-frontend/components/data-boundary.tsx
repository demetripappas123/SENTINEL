"use client";
import type { ReactNode } from "react";
import { Button } from "./ui";
import type { RequestState } from "../lib/use-api-resource";
export function DataLoading() {
  return (
    <section
      className="data-loading"
      role="status"
      aria-label="Loading inspection data"
      aria-busy="true"
    >
      <p>Loading inspection data…</p>
      <span className="small muted">
        Fetching missions, results, and review priorities.
      </span>
      <div className="loading-cards" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton loading-chart" aria-hidden="true" />
    </section>
  );
}
export function DataBoundary({
  requests,
  children,
}: {
  requests: RequestState[];
  children: ReactNode;
}) {
  const errors = requests.filter((request) => request.status === "error");
  if (errors.length)
    return (
      <section className="data-message" role="alert">
        <h2>We couldn’t load your inspection data</h2>
        <p className="small muted">
          The data service may be unavailable. Try again to fetch the latest
          records.
        </p>
        <Button onClick={() => errors.forEach((request) => request.retry())}>
          Try again
        </Button>
      </section>
    );
  if (requests.some((request) => request.status === "loading"))
    return <DataLoading />;
  return children;
}
