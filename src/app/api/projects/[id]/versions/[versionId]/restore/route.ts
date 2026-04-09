import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedProject, jsonError } from "@/lib/api";

type Params = {
  params: Promise<{ id: string; versionId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id, versionId } = await params;
    const project = await getOwnedProject(id, user);
    if (!project) return jsonError("Project not found.", 404);

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
    console.error("restore version error", error);
    return jsonError("Unable to restore this version right now.", 500);
  }
}
