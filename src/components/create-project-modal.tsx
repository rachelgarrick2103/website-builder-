"use client";

import { useState } from "react";

const businessTypes = [
  "Lash Artist",
  "Lash Educator",
  "Beauty Academy",
  "Personal Brand",
  "Salon",
  "Product Brand",
  "Hybrid",
];

const goals = ["Book clients", "Sell courses", "Build authority", "Showcase work", "Capture leads"];

const templates = [
  { value: "Editorial Luxe", description: "High-contrast luxury editorial" },
  { value: "Minimal Boutique", description: "Soft minimal elegance with premium spacing" },
  { value: "Bold Studio", description: "Dramatic, modern, confidence-forward layout" },
];

type Props = {
  onCreated?: () => void;
};

export function CreateProjectModal({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState(businessTypes[0]);
  const [websiteGoal, setWebsiteGoal] = useState(goals[0]);
  const [templateDirection, setTemplateDirection] = useState(templates[0].value);
  const [prompt, setPrompt] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessType,
          websiteGoal,
          templateDirection,
          prompt,
        }),
      });
      const data = (await res.json()) as { error?: string; projectId?: string };
      if (!res.ok || !data.projectId) {
        setError(data.error ?? "Unable to create this project right now.");
        return;
      }
      setOpen(false);
      onCreated?.();
      window.location.href = `/project/${data.projectId}`;
    } catch {
      setError("Unable to create this project right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Create new site
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="panel w-full max-w-2xl p-6 md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">New project</p>
                <h2 className="mt-2 font-display text-5xl uppercase leading-none">Start your PSC site</h2>
              </div>
              <button className="btn-secondary" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Project name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Luxe Lash Studio"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Business type</label>
                  <select className="input" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                    {businessTypes.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Website goal</label>
                  <select className="input" value={websiteGoal} onChange={(e) => setWebsiteGoal(e.target.value)}>
                    {goals.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Template direction</label>
                <select className="input" value={templateDirection} onChange={(e) => setTemplateDirection(e.target.value)}>
                  {templates.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value} — {option.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Opening brief for PSC Agent
                </label>
                <textarea
                  className="textarea min-h-28"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  required
                  placeholder="Describe your brand, ideal client, signature offers, and the tone you want."
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button className="btn-primary w-full" disabled={loading} type="submit">
                {loading ? "Creating your project..." : "Create project"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
