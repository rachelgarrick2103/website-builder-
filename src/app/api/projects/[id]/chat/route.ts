import { MessageRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { editExistingSite, generateInitialSite } from "@/lib/ai";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractStructuredUpdatesFromMessage } from "@/lib/project-data";
import { jsonError } from "@/lib/api";
import type { StructuredProjectData } from "@/lib/types";

const schema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const rate = checkRateLimit(`chat:${user.id}`, 25, 60_000);
  if (!rate.allowed) {
    return jsonError("Too many requests. Please wait a moment.", 429);
  }

  const { id } = await context.params;
  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    include: { assets: true },
  });
  if (!project) {
    return jsonError("Project not found.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Please provide a valid message.");
  }

  await db.message.create({
    data: {
      projectId: project.id,
      role: MessageRole.USER,
      content: parsed.data.message,
    },
  });

  const structuredData = extractStructuredUpdatesFromMessage(
    project.structuredData as StructuredProjectData,
    parsed.data.message,
  );

  const assetUrls = project.assets.map((a) => a.fileUrl);
  const generated =
    project.currentCodeHtml.trim().length === 0
      ? await generateInitialSite({
          projectName: project.name,
          templateType: project.templateType,
          prompt: parsed.data.message,
          structuredData,
          assetUrls,
        })
      : await editExistingSite({
          html: project.currentCodeHtml,
          css: project.currentCodeCss,
          js: project.currentCodeJs,
          prompt: parsed.data.message,
          structuredData,
          assetUrls,
        });

  await db.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: {
        currentCodeHtml: generated.html,
        currentCodeCss: generated.css,
        currentCodeJs: generated.js,
        structuredData: generated.structuredData,
        hasUnpublishedChanges: project.status === "LIVE",
      },
    });
    await tx.message.create({
      data: {
        projectId: project.id,
        role: MessageRole.ASSISTANT,
        content: generated.assistantReply,
      },
    });
  });

  const updatedProject = await db.project.findFirst({
    where: { id: project.id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      assets: { orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json({
    project: updatedProject,
  });
}
