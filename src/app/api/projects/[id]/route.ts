import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedProject, jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;

  const project = await getOwnedProject(id, user);
  if (!project) {
    return jsonError("Project not found.", 404);
  }

  return NextResponse.json({ project });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;

  const project = await db.project.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: { id: true },
  });

  if (!project) {
    return jsonError("Project not found.", 404);
  }

  await db.project.delete({
    where: { id: project.id },
  });

  return NextResponse.json({ ok: true });
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

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      assets: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) {
    return jsonError("Project not found.", 404);
  }

  const uniqueSlug = `${project.slug.slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`;

  const duplicated = await db.project.create({
    data: {
      userId: user.id,
      name: `${project.name} Copy`,
      slug: uniqueSlug,
      status: "DRAFT",
      templateType: project.templateType,
      businessType: project.businessType,
      websiteGoal: project.websiteGoal,
      structuredData: project.structuredData as Prisma.InputJsonValue,
      currentCodeHtml: project.currentCodeHtml,
      currentCodeCss: project.currentCodeCss,
      currentCodeJs: project.currentCodeJs,
      hasUnpublishedChanges: false,
      messages: {
        create: project.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      },
      assets: {
        create: project.assets.map((asset) => ({
          userId: user.id,
          fileUrl: asset.fileUrl,
          fileType: asset.fileType,
          originalName: asset.originalName,
        })),
      },
      versions: {
        create: [
          {
            label: "Duplicated baseline",
            html: project.currentCodeHtml,
            css: project.currentCodeCss,
            js: project.currentCodeJs,
            structuredData: project.structuredData as Prisma.InputJsonValue,
          },
        ],
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, projectId: duplicated.id });
}
