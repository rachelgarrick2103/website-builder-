import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateInitialSite } from "@/lib/ai";
import {
  createDefaultStructuredData,
  extractStructuredUpdatesFromMessage,
  labelToBusinessType,
  labelToGoal,
  labelToTemplate,
} from "@/lib/project-data";

const schema = z.object({
  name: z.string().min(2).max(80),
  businessType: z.string().min(2).max(80),
  websiteGoal: z.string().min(2).max(80),
  templateDirection: z.string().min(2).max(80),
  prompt: z.string().min(8).max(4000),
});

function toSlug(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "psc-site"}-${suffix}`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please complete all project details." }, { status: 400 });
    }

    const businessType = labelToBusinessType(parsed.data.businessType);
    const websiteGoal = labelToGoal(parsed.data.websiteGoal);
    const templateType = labelToTemplate(parsed.data.templateDirection);
    const baseStructuredData = createDefaultStructuredData({
      brandName: parsed.data.name,
      businessType,
      websiteGoal
    });
    const structuredData = extractStructuredUpdatesFromMessage(baseStructuredData, parsed.data.prompt);
    const initialSite = await generateInitialSite({
      projectName: parsed.data.name.trim(),
      templateType,
      prompt: parsed.data.prompt,
      structuredData,
      assetUrls: [],
    });

    const project = await db.project.create({
      data: {
        userId: user.id,
        name: parsed.data.name.trim(),
        slug: toSlug(parsed.data.name),
        businessType,
        websiteGoal,
        templateType,
        structuredData: initialSite.structuredData,
        currentCodeHtml: initialSite.html,
        currentCodeCss: initialSite.css,
        currentCodeJs: initialSite.js,
        messages: {
          create: [
            {
              role: "USER",
              content: parsed.data.prompt.trim(),
            },
            {
              role: "ASSISTANT",
              content: initialSite.assistantReply,
            },
          ],
        },
        versions: {
          create: {
            label: "Initial draft",
            html: initialSite.html,
            css: initialSite.css,
            js: initialSite.js,
            structuredData: initialSite.structuredData,
          },
        },
      },
      select: { id: true }
    });

    return NextResponse.json({ ok: true, projectId: project.id });
  } catch (error) {
    console.error("project create error", error);
    return NextResponse.json({ error: "Unable to create project right now." }, { status: 500 });
  }
}
