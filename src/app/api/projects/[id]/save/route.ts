import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getFallbackProject, saveFallbackProject } from "@/lib/fallback-store";
import { getOwnedProject, jsonError } from "@/lib/api";
import { ProjectStatus } from "@/lib/types";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";

const schema = z.object({
  html: z.string(),
  css: z.string(),
  js: z.string().optional().default(""),
  structuredData: z.record(z.any()),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid project payload.");
  }

  try {
    const project = await getOwnedProject(id, user.id);
    if (!project) {
      const fallbackProject = await getFallbackProject(user, id);
      if (!fallbackProject) {
        return jsonError("Project not found.", 404);
      }
      fallbackProject.currentCodeHtml = parsed.data.html;
      fallbackProject.currentCodeCss = parsed.data.css;
      fallbackProject.currentCodeJs = parsed.data.js;
      fallbackProject.structuredData = parsed.data.structuredData as typeof fallbackProject.structuredData;
      fallbackProject.updatedAt = new Date();
      fallbackProject.hasUnpublishedChanges = fallbackProject.status === ProjectStatus.LIVE;
      await saveFallbackProject(user, fallbackProject);
      return NextResponse.json({ ok: true, message: "Saving your project", usingFallback: true });
    }

    const { error } = await withSupabaseTimeout(
      supabase
        .from("Project")
        .update({
          currentCodeHtml: parsed.data.html,
          currentCodeCss: parsed.data.css,
          currentCodeJs: parsed.data.js,
          structuredData: parsed.data.structuredData,
          updatedAt: new Date().toISOString(),
          hasUnpublishedChanges: project.status === ProjectStatus.LIVE,
        })
        .eq("id", project.id)
        .eq("userId", user.id),
    );
    if (error) throw error;

    return NextResponse.json({ ok: true, message: "Saving your project", usingFallback: false });
  } catch (error) {
    const fallbackProject = await getFallbackProject(user, id);
    if (!fallbackProject) {
      console.error("save route error", error);
      return jsonError("Unable to save project right now.", 500);
    }
    fallbackProject.currentCodeHtml = parsed.data.html;
    fallbackProject.currentCodeCss = parsed.data.css;
    fallbackProject.currentCodeJs = parsed.data.js;
    fallbackProject.structuredData = parsed.data.structuredData as typeof fallbackProject.structuredData;
    fallbackProject.updatedAt = new Date();
    fallbackProject.hasUnpublishedChanges = fallbackProject.status === ProjectStatus.LIVE;
    await saveFallbackProject(user, fallbackProject);
    return NextResponse.json({ ok: true, message: "Saving your project", usingFallback: true });
  }
}
