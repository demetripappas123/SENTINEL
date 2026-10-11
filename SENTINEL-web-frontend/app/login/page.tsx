"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
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
    const response = await fetch(mode === "sign-in" ? "/api/auth/login" : "/api/organizations", {
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

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <p className="small muted">SENTINEL</p>
        <h1>{mode === "sign-in" ? "Sign in" : "Create organization"}</h1>
        <p className="small muted">
          {mode === "sign-in"
            ? "Your account belongs to one organization. That organization owns the Orbit webhook."
            : "This creates the organization and signs you in as its first user."}
        </p>
        {mode === "create" ? (
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
        ) : null}
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
            minLength={mode === "create" ? 8 : 1}
            required
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create and sign in"}
        </button>
        <button
          type="button"
          className="quiet"
          onClick={() => {
            setMode(mode === "sign-in" ? "create" : "sign-in");
            setError("");
          }}
        >
          {mode === "sign-in" ? "Create an organization" : "Have an account? Sign in"}
        </button>
        <p className="small muted">Seeded operators use password sentinel. operator.north@sentinel.local or operator.south@sentinel.local.</p>
      </form>
    </main>
  );
}
