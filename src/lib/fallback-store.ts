import { randomUUID } from "crypto";
import type { MessageRole, ProjectStatus } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import type { StructuredProjectData } from "@/lib/types";
import { setSessionFallbackState } from "@/lib/auth";

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

export type SerializableFallbackProject = Omit<
  FallbackProject,
  "createdAt" | "updatedAt" | "publishedAt" | "messages" | "assets" | "versions"
> & {
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  messages: Array<Omit<FallbackMessage, "createdAt"> & { createdAt: string }>;
  assets: Array<Omit<FallbackAsset, "createdAt"> & { createdAt: string }>;
  versions: Array<Omit<FallbackVersion, "createdAt"> & { createdAt: string }>;
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
  projectsBySession: Map<string, FallbackProject[]>;
};

declare global {
  var __pscFallbackStore: Store | undefined;
}

const fallbackStore: Store =
  global.__pscFallbackStore ??
  {
    projectsBySession: new Map(),
  };

if (process.env.NODE_ENV !== "production") {
  global.__pscFallbackStore = fallbackStore;
}

function hydrateFromSession(user: SessionUser) {
  const existing = fallbackStore.projectsBySession.get(user.sid);
  if (existing) {
    return existing;
  }
  const decoded = decodeFallbackState(user.fallbackState);
  fallbackStore.projectsBySession.set(user.sid, decoded);
  return decoded;
}

function encodeFallbackState(projects: FallbackProject[]) {
  const serialized = JSON.stringify(serializeFallbackProjects(projects));
  return Buffer.from(serialized, "utf8").toString("base64url");
}

function decodeFallbackState(value?: string) {
  if (!value) return [];
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as SerializableFallbackProject[];
    if (!Array.isArray(parsed)) return [];
    return deserializeFallbackProjects(parsed);
  } catch {
    return [];
  }
}

async function persistSessionProjects(user: SessionUser, projects: FallbackProject[]) {
  fallbackStore.projectsBySession.set(user.sid, projects);
  const encoded = encodeFallbackState(projects);
  await setSessionFallbackState(encoded);
}

function getSessionProjects(user: SessionUser) {
  return hydrateFromSession(user);
}

export function listFallbackProjects(user: SessionUser) {
  return [...getSessionProjects(user)].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function getFallbackProject(user: SessionUser, projectId: string) {
  return getSessionProjects(user).find((project) => project.id === projectId) ?? null;
}

export function getFallbackProjectBySlug(slug: string) {
  for (const projects of fallbackStore.projectsBySession.values()) {
    const project = projects.find((item) => item.slug === slug);
    if (project) return project;
  }
  return null;
}

export async function saveFallbackProject(user: SessionUser, project: FallbackProject) {
  const projects = getSessionProjects(user);
  const existingIdx = projects.findIndex((item) => item.id === project.id);
  const next = [...projects];
  if (existingIdx >= 0) {
    next[existingIdx] = project;
  } else {
    next.push(project);
  }
  await persistSessionProjects(user, next);
}

export async function deleteFallbackProject(user: SessionUser, projectId: string) {
  const projects = getSessionProjects(user);
  await persistSessionProjects(
    user,
    projects.filter((item) => item.id !== projectId),
  );
}

export async function createFallbackProject(input: {
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
  await saveFallbackProject(input.user, project);
  return project;
}

export async function cloneFallbackProject(user: SessionUser, project: FallbackProject) {
  const now = new Date();
  const copyId = randomUUID();
  const clone: FallbackProject = {
    ...project,
    id: copyId,
    userId: user.id,
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
  await saveFallbackProject(user, clone);
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

export function serializeFallbackProjects(projects: FallbackProject[]): SerializableFallbackProject[] {
  return projects.map((project) => ({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    publishedAt: project.publishedAt ? project.publishedAt.toISOString() : null,
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
  }));
}

export function deserializeFallbackProjects(projects: SerializableFallbackProject[]): FallbackProject[] {
  return projects.map((project) => ({
    ...project,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
    publishedAt: project.publishedAt ? new Date(project.publishedAt) : null,
    messages: project.messages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
    })),
    assets: project.assets.map((asset) => ({
      ...asset,
      createdAt: new Date(asset.createdAt),
    })),
    versions: project.versions.map((version) => ({
      ...version,
      createdAt: new Date(version.createdAt),
    })),
  }));
}

export async function updateFallbackProject(
  user: SessionUser,
  projectId: string,
  updater: (project: FallbackProject) => FallbackProject,
) {
  const projects = getSessionProjects(user);
  const index = projects.findIndex((project) => project.id === projectId);
  if (index < 0) return null;
  const updated = updater(projects[index]);
  const next = [...projects];
  next[index] = updated;
  await persistSessionProjects(user, next);
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

