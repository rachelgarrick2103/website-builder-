"use client";

import { useState } from "react";
import { getPublicAppBaseUrl } from "@/lib/url";

type Props = {
  projectId: string;
};

export function DuplicateProjectButton({ projectId }: Props) {
  const [loading, setLoading] = useState(false);

  async function duplicateProject() {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "duplicate" }),
      });
      const data = (await response.json()) as { projectId?: string; error?: string };
      if (!response.ok) {
        alert(data.error ?? "Could not duplicate this project.");
        return;
      }
      if (data.projectId) {
        window.location.href = `${getPublicAppBaseUrl()}/project/${data.projectId}`;
        return;
      }
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="btn-secondary text-xs" onClick={duplicateProject} disabled={loading}>
      {loading ? "Duplicating..." : "Duplicate"}
    </button>
  );
}
