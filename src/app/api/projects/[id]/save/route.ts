import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedProject, jsonError } from "@/lib/api";

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

  try {
    const project = await getOwnedProject(id, user);
    if (!project) {
      return jsonError("Project not found.", 404);
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid project payload.");
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
    console.error("save route error", error);
    return jsonError("Unable to save project right now.", 500);
  }
}
