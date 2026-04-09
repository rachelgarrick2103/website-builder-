import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFallbackProject, saveFallbackProject } from "@/lib/fallback-store";
import { getOwnedProject, jsonError } from "@/lib/api";
import { isDatabaseUnavailableError } from "@/lib/db";

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
      return jsonError("Project not found.", 404);
    }

    await db.project.update({
      where: { id: project.id },
      data: {
        currentCodeHtml: parsed.data.html,
        currentCodeCss: parsed.data.css,
        currentCodeJs: parsed.data.js,
        structuredData: parsed.data.structuredData,
        updatedAt: new Date(),
        hasUnpublishedChanges: project.status === "LIVE",
      },
    });

    return NextResponse.json({ ok: true, message: "Saving your project" });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      const fallbackProject = await getFallbackProject(user, id);
      if (!fallbackProject) {
        return jsonError("Project not found.", 404);
      }
      fallbackProject.currentCodeHtml = parsed.data.html;
      fallbackProject.currentCodeCss = parsed.data.css;
      fallbackProject.currentCodeJs = parsed.data.js;
      fallbackProject.structuredData = parsed.data.structuredData as typeof fallbackProject.structuredData;
      fallbackProject.updatedAt = new Date();
      fallbackProject.hasUnpublishedChanges = fallbackProject.status === "LIVE";
      await saveFallbackProject(user, fallbackProject);
      return NextResponse.json({ ok: true, message: "Saving your project" });
    }
    console.error("save route error", error);
    return jsonError("Unable to save project right now.", 500);
  }
}
