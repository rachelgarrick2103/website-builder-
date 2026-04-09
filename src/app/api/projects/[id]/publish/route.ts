import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { MessageRole, ProjectStatus } from "@/lib/types";
import { getOwnedProject, jsonError } from "@/lib/api";
import {
  getFallbackProject,
  saveFallbackProject,
} from "@/lib/fallback-store";
import { getPublicAppBaseUrl } from "@/lib/url";
import { isSupabaseUnavailableError, supabase, withSupabaseTimeout } from "@/lib/supabase";

function baseUrl() {
  return getPublicAppBaseUrl();
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const deployedUrl = `${baseUrl()}/site/`;

  try {
    const project = await getOwnedProject(id, user.id, user.role === "ADMIN");
    if (!project) {
      return jsonError("Project not found.", 404);
    }
    if (!project.currentCodeHtml.trim()) {
      return jsonError("Your site needs content before publishing.");
    }

    {
      const { error } = await withSupabaseTimeout(
        supabase
          .from("Project")
          .update({ status: ProjectStatus.PUBLISHING, updatedAt: new Date().toISOString() })
          .eq("id", project.id)
          .eq("userId", user.role === "ADMIN" ? project.userId : user.id),
      );
      if (error) throw error;
    }

    const liveUrl = `${deployedUrl}${project.slug}`;

    const { data: updated, error: updateError } = await withSupabaseTimeout(
      supabase
        .from("Project")
        .update({
          status: ProjectStatus.LIVE,
          deployedUrl: liveUrl,
          publishedAt: new Date().toISOString(),
          hasUnpublishedChanges: false,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", project.id)
        .eq("userId", user.role === "ADMIN" ? project.userId : user.id)
        .select("*")
        .single(),
    );
    if (updateError) throw updateError;

    const { error: messageError } = await withSupabaseTimeout(
      supabase.from("Message").insert({
        projectId: project.id,
        role: MessageRole.SYSTEM,
        content: "Your website is now live.",
      }),
    );
    if (messageError) throw messageError;

    return NextResponse.json({ project: updated, usingFallback: false });
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      console.error("publish error", error);
      return jsonError("Publishing failed. Please try again.", 500);
    }
    const project = await getFallbackProject(user, id);
    if (!project) {
      return jsonError("Publishing failed. Please try again.", 500);
    }
    if (!project.currentCodeHtml.trim()) {
      return jsonError("Your site needs content before publishing.");
    }
    project.status = "LIVE";
    project.hasUnpublishedChanges = false;
    project.publishedAt = new Date();
    project.deployedUrl = `${deployedUrl}${project.slug}`;
    project.messages.push({
      id: randomUUID(),
      role: MessageRole.SYSTEM,
      content: "Your website is now live.",
      createdAt: new Date(),
    });
    project.updatedAt = new Date();
    await saveFallbackProject(user, project);
    return NextResponse.json({ project, usingFallback: true });
  }
}
