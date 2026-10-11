"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "create" | "join">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const path = mode === "sign-in" ? "/api/auth/login" : mode === "join" ? "/api/auth/join" : "/api/organizations";
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        mode === "sign-in"
          ? { email, password }
          : { email, password, name, organization_name: organizationName },
      ),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(typeof body.detail === "string" ? body.detail : "Sign-in failed");
      return;
    }
    window.location.assign("/");
  }

  const title = mode === "sign-in" ? "Sign in" : mode === "join" ? "Join organization" : "Create organization";
  const subtitle =
    mode === "sign-in"
      ? "Your account belongs to one organization. That organization has one Orbit connection."
      : mode === "join"
        ? "Create an account on an organization that already exists."
        : "This creates the organization and signs you in as its first user.";

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <p className="small muted">SENTINEL</p>
        <h1>{title}</h1>
        <p className="small muted">{subtitle}</p>
        {mode === "sign-in" ? null : (
          <>
            <label>
              Organization
              <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
            </label>
            <label>
              Your name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          </>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={mode === "sign-in" ? 1 : 8}
            required
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "join" ? "Join and sign in" : "Create and sign in"}
        </button>
        {mode === "sign-in" ? (
          <>
            <button type="button" className="quiet" onClick={() => { setMode("join"); setError(""); }}>
              Join an organization
            </button>
            <button type="button" className="quiet" onClick={() => { setMode("create"); setError(""); }}>
              Create an organization
            </button>
          </>
        ) : (
          <button type="button" className="quiet" onClick={() => { setMode("sign-in"); setError(""); }}>
            Have an account? Sign in
          </button>
        )}
        <p className="small muted">Seeded operators use password sentinel. operator.north@sentinel.local or operator.south@sentinel.local.</p>
      </form>
    </main>
  );
}

