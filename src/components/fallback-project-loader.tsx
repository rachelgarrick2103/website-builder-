"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectBuilder } from "@/components/project-builder";
import type { ProjectStatus } from "@/lib/types";

type Props = {
  projectId: string;
};

type LoaderProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  hasUnpublishedChanges: boolean;
  deployedUrl: string | null;
  currentCodeHtml: string;
  currentCodeCss: string;
  currentCodeJs: string;
  structuredData: unknown;
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT" | "SYSTEM";
    content: string;
    createdAt: string | Date;
  }>;
  assets: Array<{
    id: string;
    fileUrl: string;
    fileType: string;
    originalName: string;
  }>;
};

const EMPTY_PROJECT_STATUS: ProjectStatus = "DRAFT";

function buildPreviewDoc(html: string, css: string, js: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body>${html}<script>${js}</script></body>
</html>`;
}

function createBlankProject(projectId: string): LoaderProject {
  return {
    id: projectId,
    name: "Your PSC Site",
    status: EMPTY_PROJECT_STATUS,
    hasUnpublishedChanges: false,
    deployedUrl: null,
    currentCodeHtml: "",
    currentCodeCss: "",
    currentCodeJs: "",
    structuredData: {},
    messages: [],
    assets: [],
  };
}

function normalizeProject(projectId: string, parsed: Partial<LoaderProject>): LoaderProject {
  return {
    id: parsed.id ?? projectId,
    name: parsed.name ?? "Your PSC Site",
    status: (parsed.status as ProjectStatus) ?? EMPTY_PROJECT_STATUS,
    hasUnpublishedChanges: Boolean(parsed.hasUnpublishedChanges),
    deployedUrl: parsed.deployedUrl ?? null,
    currentCodeHtml: parsed.currentCodeHtml ?? "",
    currentCodeCss: parsed.currentCodeCss ?? "",
    currentCodeJs: parsed.currentCodeJs ?? "",
    structuredData: parsed.structuredData ?? {},
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
  };
}

export function FallbackProjectLoader({ projectId }: Props) {
  const [resolvedProject, setResolvedProject] = useState<LoaderProject | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    const key = `fallback_project_${projectId}`;
    const markResolved = (project: LoaderProject) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setResolvedProject(project);
    };

    const fallbackTimer = window.setTimeout(() => {
      if (resolvedRef.current) return;
      const blank = createBlankProject(projectId);
      console.log("[FallbackProjectLoader] 3s timeout reached, rendering blank builder:", blank);
      markResolved(blank);
    }, 3000);

    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    console.log("[FallbackProjectLoader] cached project payload:", raw);
    if (raw && !resolvedRef.current) {
      try {
        const parsed = JSON.parse(raw) as Partial<LoaderProject>;
        if (parsed?.id === projectId || !parsed?.id) {
          const normalizedProject = normalizeProject(projectId, parsed);
          console.log("[FallbackProjectLoader] using cached project:", normalizedProject);
          sessionStorage.setItem(key, JSON.stringify(normalizedProject));
          try {
            localStorage.setItem(key, JSON.stringify(normalizedProject));
          } catch {
            // Ignore storage quota or disabled localStorage failures.
          }
          markResolved(normalizedProject);
        }
      } catch {
        console.log("[FallbackProjectLoader] failed to parse cached project payload");
      }
    }

    const controller = new AbortController();
    const fetchProject = async () => {
      try {
        console.log("[FallbackProjectLoader] fetching project from API:", `/api/projects/${projectId}`);
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as { project?: Partial<LoaderProject>; error?: string };
        console.log("[FallbackProjectLoader] fetch response status:", response.status);
        console.log("[FallbackProjectLoader] fetch response payload:", payload);
        if (resolvedRef.current) return;
        if (response.ok && payload.project) {
          const normalized = normalizeProject(projectId, payload.project);
          sessionStorage.setItem(key, JSON.stringify(normalized));
          try {
            localStorage.setItem(key, JSON.stringify(normalized));
          } catch {
            // Ignore storage quota or disabled localStorage failures.
          }
          markResolved(normalized);
          return;
        }
        const blank = createBlankProject(projectId);
        console.log("[FallbackProjectLoader] API error, rendering blank builder:", payload.error);
        markResolved(blank);
      } catch (error) {
        if (resolvedRef.current) return;
        console.log("[FallbackProjectLoader] fetch threw error:", error);
        const blank = createBlankProject(projectId);
        markResolved(blank);
      }
    };

    void fetchProject();

    return () => {
      clearTimeout(fallbackTimer);
      controller.abort();
    };
  }, [projectId]);

  const initialPreviewDoc = useMemo(() => {
    if (!resolvedProject) return "";
    return buildPreviewDoc(
      resolvedProject.currentCodeHtml,
      resolvedProject.currentCodeCss,
      resolvedProject.currentCodeJs,
    );
  }, [resolvedProject]);

  if (resolvedProject) {
    return (
      <main>
        <ProjectBuilder initialProject={resolvedProject} initialPreviewDoc={initialPreviewDoc} initialUsingFallback />
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="panel p-8 text-sm text-neutral-600">Loading your project...</div>
    </main>
  );
}
