"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, PageHeading, Panel, Tag } from "../components/ui";

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

export function OrbitConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [facilityName, setFacilityName] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("https://orbit.example");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch("/api/orbit/connections");
    const body = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(body)) {
      setError(message(body, "Subscriptions are unavailable"));
      return;
    }
    setConnections(body);
    const organizationId = body[0]?.organization.id;
    if (!organizationId) {
      setInspections([]);
      return;
    }
    const recorded = await fetch("/api/orbit/organizations/" + organizationId + "/inspections");
    const rows = await recorded.json().catch(() => []);
    setInspections(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    void load();
  }, []);

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
      setError(message(body, "Could not create the subscription"));
      return;
    }
    setSecret(typeof body.secret === "string" ? body.secret : "");
    setFacilityName("");
    await load();
  }

  return (
    <>
      <PageHeading
        title="Orbit"
        subtitle="The signed-in organization owns one Orbit webhook."
      />
      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="New subscription">
          {connections.length > 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              This organization already has its webhook subscription.
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
              {pending ? "Creating…" : "Create subscription"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Simulated Orbit. The event type is ACTION_COMPLETED. The secret is shown once.
            </p>
          </form>
          )}
        </Panel>
        <Panel title="Subscriptions" action={<Tag>{connections.length}</Tag>}>
          {secret ? (
            <p className="border-b px-4 py-3 text-sm" role="status">
              Signing secret, copy it now: <code className="font-mono text-xs">{secret}</code>
            </p>
          ) : null}
          {connections.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No webhook subscriptions yet.</p>
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
                  {connections.map((connection) => (
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
        {inspections.length === 0 ? (
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
              {inspections.map((inspection) => (
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
