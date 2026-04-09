"use client";

import { useState } from "react";
import { getPublicAppBaseUrl } from "@/lib/url";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName?: string;
};

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    const confirmed = window.confirm(
      `Delete ${projectName ? `"${projectName}"` : "this project"} permanently? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Unable to delete project.");
        return;
      }
      if (window.location.pathname.includes("/settings")) {
        window.location.href = `${getPublicAppBaseUrl()}/dashboard`;
      } else {
        window.location.reload();
      }
    } catch {
      setError("Unable to delete project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button className="text-xs text-red-600" disabled={loading} onClick={onDelete}>
        {loading ? "Deleting..." : "Delete"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
