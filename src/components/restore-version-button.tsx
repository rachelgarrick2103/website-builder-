"use client";

import { useState } from "react";

type Props = {
  projectId: string;
  versionId: string;
};

export function RestoreVersionButton({ projectId, versionId }: Props) {
  const [loading, setLoading] = useState(false);

  async function onRestore() {
    if (!window.confirm("Restore this version as your current draft?")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${versionId}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        window.alert(data.error ?? "Unable to restore this version.");
        return;
      }
      window.location.href = `/project/${projectId}`;
    } catch {
      window.alert("Unable to restore this version right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="btn-secondary" onClick={onRestore} disabled={loading}>
      {loading ? "Restoring..." : "Restore"}
    </button>
  );
}
