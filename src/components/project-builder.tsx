"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Smartphone, Monitor, UploadCloud } from "lucide-react";
import type { MessageRole, ProjectStatus } from "@prisma/client";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string | Date;
};

type Asset = {
  id: string;
  fileUrl: string;
  fileType: string;
  originalName: string;
};

type BuilderProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  deployedUrl: string | null;
  hasUnpublishedChanges: boolean;
  currentCodeHtml: string;
  currentCodeCss: string;
  currentCodeJs: string;
  structuredData: unknown;
  messages: Message[];
  assets: Asset[];
};

type Props = {
  initialProject: BuilderProject;
  initialPreviewDoc: string;
};

type DeviceMode = "desktop" | "mobile";

function statusCopy(status: ProjectStatus, hasUnpublished: boolean) {
  if (status === "PUBLISHING") return "Publishing";
  if (status === "LIVE" && hasUnpublished) return "Update available";
  if (status === "LIVE") return "Live";
  return "Draft";
}

export function ProjectBuilder({ initialProject, initialPreviewDoc }: Props) {
  const [project, setProject] = useState<BuilderProject>(initialProject);
  const [messages, setMessages] = useState<Message[]>(initialProject.messages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [previewDoc, setPreviewDoc] = useState(initialPreviewDoc);
  const [statusText, setStatusText] = useState(statusCopy(initialProject.status, initialProject.hasUnpublishedChanges));
  const [dirty, setDirty] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const refreshPreview = useCallback(() => {
    const doc = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${project.currentCodeCss}</style></head><body>${project.currentCodeHtml}<script>${project.currentCodeJs}</script></body></html>`;
    setPreviewDoc(doc);
  }, [project.currentCodeCss, project.currentCodeHtml, project.currentCodeJs]);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  useEffect(() => {
    setStatusText(statusCopy(project.status, project.hasUnpublishedChanges));
  }, [project.status, project.hasUnpublishedChanges]);

  const persistProject = useCallback(async (showErrors = true) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: project.currentCodeHtml,
          css: project.currentCodeCss,
          js: project.currentCodeJs,
          structuredData: project.structuredData,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (showErrors) setError(data.error ?? "Unable to save right now.");
        return false;
      }
      return true;
    } catch {
      if (showErrors) setError("Unable to save right now.");
      return false;
    }
  }, [project.currentCodeCss, project.currentCodeHtml, project.currentCodeJs, project.id, project.structuredData]);

  useEffect(() => {
    if (!dirty) return;
    const timeout = window.setTimeout(async () => {
      setAutosaveStatus("saving");
      const ok = await persistProject(false);
      if (ok) {
        setDirty(false);
        setAutosaveStatus("saved");
        window.setTimeout(() => setAutosaveStatus("idle"), 2500);
      } else {
        setAutosaveStatus("idle");
      }
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [dirty, persistProject]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || busy) return;

    setBusy(true);
    setError("");
    setInput("");

    try {
      const res = await fetch(`/api/projects/${project.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = (await res.json()) as {
        error?: string;
        project?: BuilderProject;
      };

      if (!res.ok || !data.project) {
        setError(data.error ?? "Unable to apply your edit right now.");
        return;
      }

      setProject(data.project);
      setMessages(data.project.messages);
      setDirty(true);
    } catch {
      setError("Unable to apply your edit right now.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProject() {
    if (saving) return;
    setSaving(true);
    setError("");
    const ok = await persistProject(true);
    if (ok) {
      setDirty(false);
      setAutosaveStatus("saved");
      window.setTimeout(() => setAutosaveStatus("idle"), 2500);
    }
    setSaving(false);
  }

  async function saveVersion() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const label = prompt("Version label", `Version ${new Date().toLocaleString()}`);
      if (!label) {
        setSaving(false);
        return;
      }
      const saveOk = await persistProject(true);
      if (!saveOk) {
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/projects/${project.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save version.");
      } else {
        setDirty(false);
      }
    } catch {
      setError("Could not save version.");
    } finally {
      setSaving(false);
    }
  }

  async function publishProject() {
    if (publishing) return;
    setPublishing(true);
    setError("");
    const previousStatus = project.status;
    setProject((prev) => ({ ...prev, status: "PUBLISHING" }));

    try {
      const res = await fetch(`/api/projects/${project.id}/publish`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        project?: BuilderProject;
      };

      if (!res.ok || !data.project) {
        setError(data.error ?? "Publishing failed. Please try again.");
        setProject((prev) => ({ ...prev, status: previousStatus }));
        return;
      }
      setProject(data.project);
      setDirty(false);
    } catch {
      setError("Publishing failed. Please try again.");
      setProject((prev) => ({ ...prev, status: previousStatus }));
    } finally {
      setPublishing(false);
    }
  }

  async function uploadAsset(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/projects/${project.id}/assets`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        error?: string;
        asset?: Asset;
      };
      if (!res.ok || !data.asset) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setProject((prev) => ({
        ...prev,
        assets: [data.asset!, ...prev.assets],
      }));
      setDirty(true);
    } catch {
      setError("Upload failed.");
    }
  }

  const previewFrameClass = useMemo(() => {
    if (deviceMode === "mobile") return "mx-auto h-[740px] w-[390px]";
    return "h-[740px] w-full";
  }, [deviceMode]);

  return (
    <div className="shell min-h-screen space-y-6">
      <header className="panel flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">PSC Website Creator</p>
          <h1 className="mt-2 font-display text-5xl uppercase leading-none">{project.name}</h1>
          <p className="mt-2 text-sm text-neutral-600">Chat with PSC Agent to generate, refine, and publish your site.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="status-chip">{statusText}</span>
          {autosaveStatus === "saving" ? (
            <span className="status-chip">Saving</span>
          ) : autosaveStatus === "saved" ? (
            <span className="status-chip">Saved</span>
          ) : null}
          <button className="btn-secondary" onClick={saveProject} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save project"}
          </button>
          <button className="btn-secondary" onClick={saveVersion} disabled={saving}>
            Save version
          </button>
          <button className="btn-primary" onClick={publishProject} disabled={publishing}>
            {publishing ? "Publishing your website..." : project.status === "LIVE" ? "Republish live site" : "Publish your site"}
          </button>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel flex h-[820px] flex-col">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">PSC Agent</h2>
            <p className="text-sm text-neutral-600">Describe changes, layout direction, or content updates.</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-2xl border px-4 py-3 text-sm ${
                  message.role === "USER"
                    ? "ml-auto border-black bg-black text-white"
                    : "border-border bg-white text-neutral-800"
                }`}
              >
                {message.content}
              </div>
            ))}
            {busy ? (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm text-neutral-700">
                <Loader2 className="h-4 w-4 animate-spin" /> PSC Agent is refining your website...
              </div>
            ) : null}
          </div>
          <div className="border-t border-border p-4">
            <form onSubmit={sendMessage} className="space-y-3">
              <textarea
                className="textarea min-h-[96px]"
                placeholder="Example: make it feel more luxury, reduce the text, add a course section..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="btn-secondary cursor-pointer">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload asset
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAsset(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button className="btn-primary" type="submit" disabled={busy || !input.trim()}>
                  {busy ? "Applying changes..." : "Send to PSC Agent"}
                </button>
              </div>
            </form>
            {project.assets.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {project.assets.slice(0, 6).map((asset) => (
                  <span key={asset.id} className="rounded-full border border-border px-3 py-1 text-xs text-neutral-600">
                    {asset.originalName}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel flex h-[820px] flex-col">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h2 className="font-semibold">Live preview</h2>
              <p className="text-sm text-neutral-600">Your PSC Site updates as edits are applied.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`btn-secondary ${deviceMode === "desktop" ? "border-black" : ""}`}
                onClick={() => setDeviceMode("desktop")}
              >
                <Monitor className="mr-2 h-4 w-4" /> Desktop
              </button>
              <button
                type="button"
                className={`btn-secondary ${deviceMode === "mobile" ? "border-black" : ""}`}
                onClick={() => setDeviceMode("mobile")}
              >
                <Smartphone className="mr-2 h-4 w-4" /> Mobile
              </button>
              <button type="button" className="btn-secondary" onClick={refreshPreview}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-neutral-50 p-4">
            <iframe title="Preview" className={previewFrameClass} srcDoc={previewDoc} />
          </div>
          <div className="border-t border-border p-4 text-sm text-neutral-600">
            {project.deployedUrl ? (
              <a href={project.deployedUrl} target="_blank" rel="noreferrer" className="font-semibold text-black underline">
                Open live site
              </a>
            ) : (
              "Your site is currently in draft mode."
            )}
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
