import { randomUUID } from "crypto";
import { MessageRole, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedProject, jsonError } from "@/lib/api";
import {
  getFallbackProject,
  saveFallbackProject,
} from "@/lib/fallback-store";
import { isDatabaseUnavailableError } from "@/lib/db";
import { getPublicAppBaseUrl } from "@/lib/url";

function baseUrl() {
  return getPublicAppBaseUrl();
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const deployedUrl = `${baseUrl()}/site/`;

  try {
    const project = await getOwnedProject(id, user.id);
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

    const liveUrl = `${deployedUrl}${project.slug}`;

    const [updated] = await db.$transaction([
      db.project.update({
        where: { id: project.id },
        data: {
          status: ProjectStatus.LIVE,
          deployedUrl: liveUrl,
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
    if (isDatabaseUnavailableError(error)) {
      const project = await getFallbackProject(user, id);
      if (!project) {
        return jsonError("Project not found.", 404);
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
      return NextResponse.json({ project });
    }
    console.error("publish error", error);
    return jsonError("Publishing failed. Please try again.", 500);
  }
}
