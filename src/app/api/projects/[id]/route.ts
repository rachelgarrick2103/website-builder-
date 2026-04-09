import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cloneFallbackProject, deleteFallbackProject, getFallbackProject, saveFallbackProject } from "@/lib/fallback-store";
import { getOwnedProject, jsonError } from "@/lib/api";
import { isSupabaseUnavailableError, supabase, withSupabaseTimeout } from "@/lib/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;

  try {
    const project = await getOwnedProject(id, user.id, user.role === "ADMIN");
    if (!project) {
      const fallbackProject = getFallbackProject(user, id);
      if (!fallbackProject) {
        return jsonError("Project not found.", 404);
      }
      return NextResponse.json({ project: fallbackProject });
    }
    return NextResponse.json({ project });
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      console.error("project get error", error);
      return jsonError("Unable to load project right now.", 500);
    }
    const fallbackProject = getFallbackProject(user, id);
    if (!fallbackProject) {
      return jsonError("Project not found.", 404);
    }
    return NextResponse.json({ project: fallbackProject });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;

  try {
    const lookupQuery =
      user.role === "ADMIN"
        ? supabase.from("Project").select("id,userId").eq("id", id).maybeSingle()
        : supabase.from("Project").select("id,userId").eq("id", id).eq("userId", user.id).maybeSingle();
    const { data: project, error: lookupError } = await withSupabaseTimeout(lookupQuery);
    if (lookupError) throw lookupError;

    if (!project) {
      const fallback = getFallbackProject(user, id);
      if (!fallback) {
        return jsonError("Project not found.", 404);
      }
      await deleteFallbackProject(user, id);
      return NextResponse.json({ ok: true });
    }

    const deleteQuery =
      user.role === "ADMIN"
        ? supabase.from("Project").delete().eq("id", project.id)
        : supabase.from("Project").delete().eq("id", project.id).eq("userId", user.id);
    const { error: deleteError } = await withSupabaseTimeout(deleteQuery);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      console.error("project delete error", error);
      return jsonError("Unable to delete project right now.", 500);
    }
    const fallback = getFallbackProject(user, id);
    if (!fallback) {
      return jsonError("Project not found.", 404);
    }
    await deleteFallbackProject(user, id);
    return NextResponse.json({ ok: true });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  if (body?.action !== "duplicate") {
    return jsonError("Unsupported action.", 400);
  }

  try {
    const projectQuery =
      user.role === "ADMIN"
        ? supabase.from("Project").select("*, messages:Message(*), assets:Asset(*)").eq("id", id).maybeSingle()
        : supabase
            .from("Project")
            .select("*, messages:Message(*), assets:Asset(*)")
            .eq("id", id)
            .eq("userId", user.id)
            .maybeSingle();
    const { data: project, error: projectError } = await withSupabaseTimeout(projectQuery);
    if (projectError) throw projectError;

    if (!project) {
      const fallback = getFallbackProject(user, id);
      if (!fallback) return jsonError("Project not found.", 404);
      const cloned = await cloneFallbackProject(user, fallback);
      return NextResponse.json({ ok: true, projectId: cloned.id });
    }

    const uniqueSlug = `${project.slug.slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`;

    const nowIso = new Date().toISOString();
    const duplicateId = crypto.randomUUID();
    const duplicateInsert = supabase
      .from("Project")
      .insert({
        id: duplicateId,
        userId: user.id,
        name: `${project.name} Copy`,
        slug: uniqueSlug,
        status: "DRAFT",
        templateType: project.templateType,
        businessType: project.businessType,
        websiteGoal: project.websiteGoal,
        structuredData: project.structuredData,
        currentCodeHtml: project.currentCodeHtml,
        currentCodeCss: project.currentCodeCss,
        currentCodeJs: project.currentCodeJs,
        hasUnpublishedChanges: false,
        publishedAt: null,
        previewSnapshot: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .select("id")
      .single();
    const { data: duplicated, error: duplicateInsertError } = await withSupabaseTimeout(duplicateInsert);
    if (duplicateInsertError) throw duplicateInsertError;

    const messages = Array.isArray(project.messages)
      ? (project.messages as Array<{ role: string; content: string }>)
      : [];
    if (messages.length > 0) {
      const messageInsert = supabase.from("Message").insert(
        messages.map((message: { role: string; content: string }) => ({
          id: crypto.randomUUID(),
          projectId: duplicateId,
          role: message.role,
          content: message.content,
          createdAt: nowIso,
        })),
      );
      const { error: messageInsertError } = await withSupabaseTimeout(messageInsert);
      if (messageInsertError) throw messageInsertError;
    }

    const assets = Array.isArray(project.assets)
      ? (project.assets as Array<{ fileUrl: string; fileType: string; originalName: string }>)
      : [];
    if (assets.length > 0) {
      const assetInsert = supabase.from("Asset").insert(
        assets.map((asset: { fileUrl: string; fileType: string; originalName: string }) => ({
          id: crypto.randomUUID(),
          projectId: duplicateId,
          userId: user.id,
          fileUrl: asset.fileUrl,
          fileType: asset.fileType,
          originalName: asset.originalName,
          createdAt: nowIso,
        })),
      );
      const { error: assetInsertError } = await withSupabaseTimeout(assetInsert);
      if (assetInsertError) throw assetInsertError;
    }

    const versionInsert = supabase.from("Version").insert({
      id: crypto.randomUUID(),
      projectId: duplicateId,
      label: "Duplicated baseline",
      html: project.currentCodeHtml,
      css: project.currentCodeCss,
      js: project.currentCodeJs,
      structuredData: project.structuredData,
      createdAt: nowIso,
    });
    const { error: versionInsertError } = await withSupabaseTimeout(versionInsert);
    if (versionInsertError) throw versionInsertError;

    return NextResponse.json({ ok: true, projectId: duplicated.id });
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      console.error("project duplicate error", error);
      return jsonError("Unable to duplicate project right now.", 500);
    }
    const fallback = getFallbackProject(user, id);
    if (!fallback) {
      return jsonError("Project not found.", 404);
    }
    const cloned = await cloneFallbackProject(user, fallback);
    return NextResponse.json({ ok: true, projectId: cloned.id });
  }
}
