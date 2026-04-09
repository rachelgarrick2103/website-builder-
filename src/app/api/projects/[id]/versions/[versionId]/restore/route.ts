import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedProject, jsonError } from "@/lib/api";
import {
  getFallbackProject,
  saveFallbackProject,
} from "@/lib/fallback-store";
import { isDatabaseUnavailableError } from "@/lib/db";

type Params = {
  params: Promise<{ id: string; versionId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id, versionId } = await params;
    const project = await getOwnedProject(id, user.id);
    if (!project) {
      const fallbackProject = getFallbackProject(user.id, id);
      if (!fallbackProject) return jsonError("Project not found.", 404);
      const version = fallbackProject.versions.find((item) => item.id === versionId);
      if (!version) return jsonError("Version not found.", 404);

      fallbackProject.currentCodeHtml = version.html;
      fallbackProject.currentCodeCss = version.css;
      fallbackProject.currentCodeJs = version.js;
      fallbackProject.structuredData = version.structuredData;
      fallbackProject.hasUnpublishedChanges = true;
      fallbackProject.updatedAt = new Date();
      fallbackProject.messages = [
        ...fallbackProject.messages,
        {
          id: randomUUID(),
          role: "SYSTEM",
          content: `Restored version: ${version.label}`,
          createdAt: new Date(),
        },
      ];
      saveFallbackProject(user.id, fallbackProject);
      return NextResponse.json({ ok: true });
    }

    const version = await db.version.findFirst({
      where: { id: versionId, projectId: project.id },
    });
    if (!version) return jsonError("Version not found.", 404);

    await db.project.update({
      where: { id: project.id },
      data: {
        currentCodeHtml: version.html,
        currentCodeCss: version.css,
        currentCodeJs: version.js,
        structuredData: version.structuredData as Prisma.InputJsonValue,
        hasUnpublishedChanges: true,
      },
    });

    await db.message.create({
      data: {
        projectId: project.id,
        role: "SYSTEM",
        content: `Restored version: ${version.label}`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return jsonError(
        "Database is currently unavailable. Your temporary session project could not be restored.",
        503,
      );
    }
    console.error("restore version error", error);
    return jsonError("Unable to restore this version right now.", 500);
  }
}
