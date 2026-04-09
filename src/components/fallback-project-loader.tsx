"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClientAppBaseUrl } from "@/lib/url";

type Props = {
  projectId: string;
};

export function FallbackProjectLoader({ projectId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const key = `fallback_project_${projectId}`;
    const raw = sessionStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          id?: string;
          name?: string;
          status?: string;
          hasUnpublishedChanges?: boolean;
          currentCodeHtml?: string;
          currentCodeCss?: string;
          currentCodeJs?: string;
          structuredData?: unknown;
          messages?: unknown[];
          assets?: unknown[];
        };
        if (parsed?.id === projectId) {
          const normalizedProject = {
            id: parsed.id,
            name: parsed.name ?? "Your PSC Site",
            status: parsed.status ?? "DRAFT",
            hasUnpublishedChanges: Boolean(parsed.hasUnpublishedChanges),
            deployedUrl: null,
            currentCodeHtml: parsed.currentCodeHtml ?? "",
            currentCodeCss: parsed.currentCodeCss ?? "",
            currentCodeJs: parsed.currentCodeJs ?? "",
            structuredData: parsed.structuredData ?? {},
            messages: Array.isArray(parsed.messages) ? parsed.messages : [],
            assets: Array.isArray(parsed.assets) ? parsed.assets : [],
          };
          sessionStorage.setItem(key, JSON.stringify(normalizedProject));
          router.refresh();
          return;
        }
      } catch {
        // Ignore invalid temporary fallback project payloads.
      }
    }
    const message = encodeURIComponent("Project was not found. Please create a new website.");
    const base = getClientAppBaseUrl();
    window.location.href = `${base}/dashboard?message=${message}`;
  }, [projectId, router]);

  return (
    <main className="shell">
      <div className="panel p-8 text-sm text-neutral-600">Loading your project...</div>
    </main>
  );
}
