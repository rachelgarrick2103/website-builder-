import { randomUUID } from "crypto";
import type { MessageRole, ProjectStatus } from "@prisma/client";
import type { StructuredProjectData } from "@/lib/types";
import type { SessionUser } from "@/lib/auth";

type FallbackMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
};

type FallbackAsset = {
  id: string;
  fileUrl: string;
  fileType: string;
  originalName: string;
  createdAt: Date;
};

type FallbackVersion = {
  id: string;
  label: string;
  html: string;
  css: string;
  js: string;
  structuredData: StructuredProjectData;
  createdAt: Date;
};

export type FallbackProject = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  templateType: string;
  businessType: string;
  websiteGoal: string;
  structuredData: StructuredProjectData;
  currentCodeHtml: string;
  currentCodeCss: string;
  currentCodeJs: string;
  previewSnapshot: string | null;
  deployedUrl: string | null;
  publishedAt: Date | null;
  hasUnpublishedChanges: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages: FallbackMessage[];
  assets: FallbackAsset[];
  versions: FallbackVersion[];
};

export type FallbackProjectInput = {
  name: string;
  slug: string;
  templateType: string;
  businessType: string;
  websiteGoal: string;
  structuredData: StructuredProjectData;
  currentCodeHtml: string;
  currentCodeCss: string;
  currentCodeJs: string;
};

type Store = {
  projectsByUser: Map<string, FallbackProject[]>;
};

declare global {
  var __pscFallbackStore: Store | undefined;
}

const fallbackStore: Store =
  global.__pscFallbackStore ??
  {
    projectsByUser: new Map(),
  };

if (process.env.NODE_ENV !== "production") {
  global.__pscFallbackStore = fallbackStore;
}

function getUserProjects(userId: string) {
  return fallbackStore.projectsByUser.get(userId) ?? [];
}

function setUserProjects(userId: string, projects: FallbackProject[]) {
  fallbackStore.projectsByUser.set(userId, projects);
}

export function listFallbackProjects(userId: string) {
  return getUserProjects(userId).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function getFallbackProject(userId: string, projectId: string) {
  return getUserProjects(userId).find((project) => project.id === projectId) ?? null;
}

export function getFallbackProjectBySlug(slug: string) {
  for (const projects of fallbackStore.projectsByUser.values()) {
    const project = projects.find((item) => item.slug === slug);
    if (project) return project;
  }
  return null;
}

export function saveFallbackProject(userId: string, project: FallbackProject) {
  const projects = getUserProjects(userId);
  const existingIdx = projects.findIndex((item) => item.id === project.id);
  const next = [...projects];
  if (existingIdx >= 0) {
    next[existingIdx] = project;
  } else {
    next.push(project);
  }
  setUserProjects(userId, next);
}

export function deleteFallbackProject(userId: string, projectId: string) {
  const projects = getUserProjects(userId);
  setUserProjects(
    userId,
    projects.filter((item) => item.id !== projectId),
  );
}

export function createFallbackProject(input: {
  user: SessionUser;
  name: string;
  slug: string;
  templateType: string;
  businessType: string;
  websiteGoal: string;
  structuredData: StructuredProjectData;
  html: string;
  css: string;
  js: string;
  userPrompt: string;
  assistantMessage: string;
}) {
  const now = new Date();
  const projectId = randomUUID();
  const project: FallbackProject = {
    id: projectId,
    userId: input.user.id,
    name: input.name,
    slug: input.slug,
    status: "DRAFT",
    templateType: input.templateType,
    businessType: input.businessType,
    websiteGoal: input.websiteGoal,
    structuredData: input.structuredData,
    currentCodeHtml: input.html,
    currentCodeCss: input.css,
    currentCodeJs: input.js,
    previewSnapshot: null,
    deployedUrl: null,
    publishedAt: null,
    hasUnpublishedChanges: false,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: randomUUID(),
        role: "USER",
        content: input.userPrompt,
        createdAt: now,
      },
      {
        id: randomUUID(),
        role: "ASSISTANT",
        content: input.assistantMessage,
        createdAt: now,
      },
    ],
    assets: [],
    versions: [
      {
        id: randomUUID(),
        label: "Initial draft",
        html: input.html,
        css: input.css,
        js: input.js,
        structuredData: input.structuredData,
        createdAt: now,
      },
    ],
  };
  saveFallbackProject(input.user.id, project);
  return project;
}

export function cloneFallbackProject(userId: string, project: FallbackProject) {
  const now = new Date();
  const copyId = randomUUID();
  const clone: FallbackProject = {
    ...project,
    id: copyId,
    userId,
    name: `${project.name} Copy`,
    slug: `${project.slug.slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`,
    status: "DRAFT",
    deployedUrl: null,
    publishedAt: null,
    hasUnpublishedChanges: false,
    createdAt: now,
    updatedAt: now,
    messages: project.messages.map((message) => ({
      ...message,
      id: randomUUID(),
      createdAt: new Date(message.createdAt),
    })),
    assets: project.assets.map((asset) => ({
      ...asset,
      id: randomUUID(),
      createdAt: new Date(asset.createdAt),
    })),
    versions: project.versions.map((version) => ({
      ...version,
      id: randomUUID(),
      createdAt: new Date(version.createdAt),
    })),
  };
  saveFallbackProject(userId, clone);
  return clone;
}

export function createFallbackVersion(project: FallbackProject, label: string): FallbackVersion {
  return {
    id: randomUUID(),
    label,
    html: project.currentCodeHtml,
    css: project.currentCodeCss,
    js: project.currentCodeJs,
    structuredData: project.structuredData,
    createdAt: new Date(),
  };
}

export function createFallbackAsset(input: {
  fileUrl: string;
  fileType: string;
  originalName: string;
}): FallbackAsset {
  return {
    id: randomUUID(),
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    originalName: input.originalName,
    createdAt: new Date(),
  };
}

export function updateFallbackProject(
  userId: string,
  projectId: string,
  updater: (project: FallbackProject) => FallbackProject,
) {
  const projects = getUserProjects(userId);
  const index = projects.findIndex((project) => project.id === projectId);
  if (index < 0) return null;
  const updated = updater(projects[index]);
  const next = [...projects];
  next[index] = updated;
  setUserProjects(userId, next);
  return updated;
}

export function mapFallbackProjectToApi(project: FallbackProject) {
  return {
    ...project,
    messages: project.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
    assets: project.assets.map((asset) => ({
      ...asset,
      createdAt: asset.createdAt.toISOString(),
    })),
    versions: project.versions.map((version) => ({
      ...version,
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

