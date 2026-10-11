"use client";

import { FormEvent, useEffect, useState } from "react";
import { DataBoundary } from "../components/data-boundary";
import { Button, PageHeading, Panel, Tag } from "../components/ui";
import { useApiResource } from "../lib/use-api-resource";

type Connection = {
  organization: { id: string; name: string };
  facility: { name: string };
  integration: { instance_url: string; mode: string };
  subscription_id: string;
  event_type: string;
  status: string;
  callback_path: string;
  secret: string | null;
};

type Inspection = {
  subscription_id: string;
  provider_mission_id: string;
  provider_action_id: string;
  robot_id: string | null;
  ingestion_mission_id: string;
  status: string;
};

const fieldClass =
  "h-9 rounded-md border bg-background px-2 text-sm text-foreground";

function isConnectionList(value: unknown): value is Connection[] {
  return Array.isArray(value);
}

export function OrbitConnections() {
  const connections = useApiResource("/api/orbit/connections", undefined, [], isConnectionList);
  const [inspections, setInspections] = useState<Inspection[] | null>(null);
  const [facilityName, setFacilityName] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("https://orbit.example");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (connections.status !== "ready") return;
    const organizationId = connections.data[0]?.organization.id;
    if (!organizationId) return;
    let active = true;
    void fetch("/api/orbit/organizations/" + organizationId + "/inspections")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => {
        if (active) setInspections(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (active) setInspections([]);
      });
    return () => {
      active = false;
    };
  }, [connections.status, connections.data]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSecret("");
    const response = await fetch("/api/orbit/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ facility_name: facilityName, instance_url: instanceUrl }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(message(body, "Could not create the connection"));
      return;
    }
    setSecret(typeof body.secret === "string" ? body.secret : "");
    setFacilityName("");
    setInspections(null);
    connections.retry();
  }

  if (connections.status !== "ready" || (connections.data.length > 0 && inspections === null)) {
    return (
      <DataBoundary requests={[{ status: connections.status === "error" ? "error" : "loading", retry: connections.retry }]}>
        {null}
      </DataBoundary>
    );
  }

  const recorded = inspections ?? [];
  const list = connections.data;

  return (
    <>
      <PageHeading
        title="Orbit"
        subtitle="The signed-in organization has one Orbit connection."
      />
      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="New connection">
          {list.length > 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              This organization already has an Orbit connection.
            </p>
          ) : (
          <form className="grid gap-3 p-4" onSubmit={create}>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Facility
              <input
                className={fieldClass}
                value={facilityName}
                onChange={(event) => setFacilityName(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Orbit instance
              <input
                className={fieldClass}
                value={instanceUrl}
                onChange={(event) => setInstanceUrl(event.target.value)}
                required
              />
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create connection"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Simulated Orbit. The event type is ACTION_COMPLETED. The secret is shown once.
            </p>
          </form>
          )}
        </Panel>
        <Panel title="Connection" action={<Tag>{list.length}</Tag>}>
          {secret ? (
            <p className="border-b px-4 py-3 text-sm" role="status">
              Signing secret, copy it now: <code className="font-mono text-xs">{secret}</code>
            </p>
          ) : null}
          {list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No Orbit connection yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Facility</th>
                    <th className="px-4 py-2 font-medium">Instance</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Callback</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((connection) => (
                    <tr key={connection.subscription_id} className="border-t">
                      <td className="px-4 py-3">
                        <div>{connection.facility.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {connection.subscription_id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{connection.integration.instance_url}</div>
                        <div className="text-xs text-muted-foreground">
                          {connection.integration.mode} · {connection.event_type}
                        </div>
                      </td>
                      <td className="px-4 py-3">{connection.status}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{connection.callback_path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Recorded deliveries" className="mt-4">
        {recorded.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No deliveries for this organization yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Mission</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Robot</th>
                <th className="px-4 py-2 font-medium">Stored as</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recorded.map((inspection) => (
                <tr key={inspection.ingestion_mission_id + inspection.provider_action_id} className="border-t">
                  <td className="px-4 py-3">{inspection.provider_mission_id}</td>
                  <td className="px-4 py-3">{inspection.provider_action_id}</td>
                  <td className="px-4 py-3">{inspection.robot_id || "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">{inspection.ingestion_mission_id}</td>
                  <td className="px-4 py-3">{inspection.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function message(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "detail" in body && typeof body.detail === "string") return body.detail;
  return fallback;
}
