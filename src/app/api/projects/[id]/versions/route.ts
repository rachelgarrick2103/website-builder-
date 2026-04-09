import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getOwnedProject, jsonError } from "@/lib/api";
import { createFallbackVersion, getFallbackProject, saveFallbackProject } from "@/lib/fallback-store";
import { MessageRole } from "@/lib/types";
import { isSupabaseUnavailableError, supabase, withSupabaseTimeout } from "@/lib/supabase";

const createVersionSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const project = await getOwnedProject(id, user.id, user.role === "ADMIN");
    if (!project) {
      return jsonError("Project not found.", 404);
    }

    const versionQuery = supabase
      .from("Version")
      .select("*")
      .eq("projectId", project.id)
      .order("createdAt", { ascending: false });
    const { data: versions, error } = await withSupabaseTimeout(versionQuery);
    if (error) throw error;

    return NextResponse.json({ versions });
  } catch (error) {
    const fallback = await getFallbackProject(user, id);
    if (fallback) {
      return NextResponse.json({ versions: fallback.versions });
    }
    if (!isSupabaseUnavailableError(error)) {
      console.error("versions list error", error);
      return jsonError("Unable to load versions right now.", 500);
    }
    return jsonError("Project not found.", 404);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = createVersionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid version label.");
  }

  const label = parsed.data.label ?? `Snapshot ${new Date().toLocaleString()}`;

  try {
    const project = await getOwnedProject(id, user.id, user.role === "ADMIN");
    if (!project) {
      return jsonError("Project not found.", 404);
    }

    const versionQuery = supabase
      .from("Version")
      .insert({
        projectId: project.id,
        label,
        html: project.currentCodeHtml,
        css: project.currentCodeCss,
        js: project.currentCodeJs,
        structuredData: project.structuredData,
      })
      .select("*")
      .single();
    const messageQuery = supabase.from("Message").insert({
      projectId: project.id,
      role: MessageRole.SYSTEM,
      content: `Saved version: ${label}`,
    });

    const [{ data: version, error: versionError }, { error: messageError }] = await Promise.all([
      withSupabaseTimeout(versionQuery),
      withSupabaseTimeout(messageQuery),
    ]);
    if (versionError) throw versionError;
    if (messageError) throw messageError;

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    const fallback = await getFallbackProject(user, id);
    if (fallback) {
      const version = createFallbackVersion(fallback, label);
      fallback.versions.unshift(version);
      fallback.messages.push({
        id: randomUUID(),
        role: MessageRole.SYSTEM,
        content: `Saved version: ${label}`,
        createdAt: new Date(),
      });
      fallback.updatedAt = new Date();
      await saveFallbackProject(user, fallback);
      return NextResponse.json({ version }, { status: 201 });
    }
    if (!isSupabaseUnavailableError(error)) {
      console.error("save version error", error);
      return jsonError("Unable to save version right now.", 500);
    }
    return jsonError("Project not found.", 404);
  }
}
