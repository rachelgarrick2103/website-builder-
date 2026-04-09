"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
        const parsed = JSON.parse(raw) as { id?: string };
        if (parsed?.id === projectId) {
          router.refresh();
          return;
        }
      } catch {
        // Ignore invalid temporary fallback project payloads.
      }
    }
    const message = encodeURIComponent("Project was not found. Please create a new website.");
    router.replace(`/dashboard?message=${message}`);
  }, [projectId, router]);

  return (
    <main className="shell">
      <div className="panel p-8 text-sm text-neutral-600">Loading your project...</div>
    </main>
  );
}
