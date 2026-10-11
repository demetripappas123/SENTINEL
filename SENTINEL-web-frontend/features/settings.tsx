"use client";

import { useEffect, useState } from "react";
import { PageHeading, Panel } from "../components/ui";

type Session = {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string };
};

export function UserSettings() {
  const session = useSession();
  return (
    <>
      <PageHeading title="User settings" subtitle="The account that is signed in." />
      <Panel title="Account">
        <dl className="grid gap-3 p-4 text-sm">
          <Row label="Name" value={session?.user.name} />
          <Row label="Email" value={session?.user.email} />
          <Row label="User id" value={session?.user.id} />
        </dl>
      </Panel>
    </>
  );
}

export function OrganizationSettings() {
  const session = useSession();
  return (
    <>
      <PageHeading
        title="Organization settings"
        subtitle="This organization owns the kit dataset and the Orbit webhook."
      />
      <Panel title="Organization">
        <dl className="grid gap-3 p-4 text-sm">
          <Row label="Name" value={session?.organization.name} />
          <Row label="Organization id" value={session?.organization.id} />
        </dl>
      </Panel>
    </>
  );
}

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (active && body?.user && body?.organization) setSession(body);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return session;
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}
