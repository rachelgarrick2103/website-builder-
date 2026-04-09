import { MessageRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedProject, jsonError } from "@/lib/api";

const createVersionSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const project = await getOwnedProject(id, user);
  if (!project) {
    return jsonError("Project not found.", 404);
  }

  const versions = await db.version.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ versions });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const project = await getOwnedProject(id, user);
  if (!project) {
    return jsonError("Project not found.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = createVersionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid version label.");
  }

  const label = parsed.data.label ?? `Snapshot ${new Date().toLocaleString()}`;

  const version = await db.version.create({
    data: {
      projectId: project.id,
      label,
      html: project.currentCodeHtml,
      css: project.currentCodeCss,
      js: project.currentCodeJs,
      structuredData: project.structuredData as Prisma.InputJsonValue,
    },
  });

  await db.message.create({
    data: {
      projectId: project.id,
      role: MessageRole.SYSTEM,
      content: `Saved version: ${label}`,
    },
  });

  return NextResponse.json({ version }, { status: 201 });
}
