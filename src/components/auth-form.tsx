"use client";

import { useState } from "react";

type Mode = "login" | "invite";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const endpoint = "/api/auth/login";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { inviteCode: password },
        ),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Unable to continue right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel mx-auto max-w-md p-7 md:p-9">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">PSC Website Creator</p>
        <h1 className="mt-2 font-display text-5xl uppercase leading-none tracking-[0.02em]">Welcome</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Sign in to build, refine, and publish your premium website with PSC Agent.
        </p>
      </div>

      <div className="mb-5 flex gap-2 rounded-full border border-border p-1">
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
            mode === "login" ? "bg-black text-white" : "text-neutral-600"
          }`}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
            mode === "invite" ? "bg-black text-white" : "text-neutral-600"
          }`}
          onClick={() => setMode("invite")}
        >
          Use invite code
        </button>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        {mode === "login" ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rachel@psclashes.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500" htmlFor="inviteCode">
                Invite code
              </label>
              <input
                id="inviteCode"
                type="text"
                className="input"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="PSC180-SARAH"
              />
            </div>
            <p className="rounded-xl border border-border bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Students can sign in instantly using their PSC invite code.
            </p>
          </>
        )}

        {mode === "login" ? (
          <div className="rounded-xl border border-border bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            Admin access: <strong>rachel@psclashes.com</strong> with your admin password.
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            Invite code format: <strong>PSC180-NAME</strong>
          </p>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Continue with invite code"}
        </button>
      </form>
    </div>
  );
}
