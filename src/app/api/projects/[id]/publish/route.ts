import { MessageRole, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedProject, jsonError } from "@/lib/api";

function baseUrl() {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const project = await getOwnedProject(id, user);
    if (!project) {
      return jsonError("Project not found.", 404);
    }
    if (!project.currentCodeHtml.trim()) {
      return jsonError("Your site needs content before publishing.");
    }

    await db.project.update({
      where: { id: project.id },
      data: { status: ProjectStatus.PUBLISHING },
    });

    const deployedUrl = `${baseUrl()}/site/${project.slug}`;

    const [updated] = await db.$transaction([
      db.project.update({
        where: { id: project.id },
        data: {
          status: ProjectStatus.LIVE,
          deployedUrl,
          publishedAt: new Date(),
          hasUnpublishedChanges: false,
        },
      }),
      db.message.create({
        data: {
          projectId: project.id,
          role: MessageRole.SYSTEM,
          content: "Your website is now live.",
        },
      }),
    ]);

    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error("publish error", error);
    return jsonError("Publishing failed. Please try again.", 500);
  }
}
