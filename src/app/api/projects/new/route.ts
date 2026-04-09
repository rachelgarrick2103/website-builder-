import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { generateInitialSite } from "@/lib/ai";
import { createFallbackProject } from "@/lib/fallback-store";
import {
  createDefaultStructuredData,
  extractStructuredUpdatesFromMessage,
  labelToBusinessType,
  labelToGoal,
  labelToTemplate,
} from "@/lib/project-data";
import { mapFallbackProjectToApi } from "@/lib/fallback-store";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";

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
      websiteGoal,
    });
    const structuredData = extractStructuredUpdatesFromMessage(baseStructuredData, parsed.data.prompt);
    const initialSite = await generateInitialSite({
      projectName: parsed.data.name.trim(),
      templateType,
      prompt: parsed.data.prompt,
      structuredData,
      assetUrls: [],
    });

    const slug = toSlug(parsed.data.name);
    let projectId: string;
    let fallbackProject: ReturnType<typeof mapFallbackProjectToApi> | null = null;
    try {
      const newProjectId = crypto.randomUUID();
      const { error: projectError } = await withSupabaseTimeout(
        supabase.from("Project").insert({
          id: newProjectId,
          userId: user.id,
          name: parsed.data.name.trim(),
          slug,
          businessType,
          websiteGoal,
          templateType,
          structuredData: initialSite.structuredData,
          currentCodeHtml: initialSite.html,
          currentCodeCss: initialSite.css,
          currentCodeJs: initialSite.js,
        }),
      );
      if (projectError) throw projectError;

      const { error: messagesError } = await withSupabaseTimeout(
        supabase.from("Message").insert([
          {
            id: crypto.randomUUID(),
            projectId: newProjectId,
            role: "USER",
            content: parsed.data.prompt.trim(),
          },
          {
            id: crypto.randomUUID(),
            projectId: newProjectId,
            role: "ASSISTANT",
            content: initialSite.assistantReply,
          },
        ]),
      );
      if (messagesError) throw messagesError;

      const { error: versionError } = await withSupabaseTimeout(
        supabase.from("Version").insert({
          id: crypto.randomUUID(),
          projectId: newProjectId,
          label: "Initial draft",
          html: initialSite.html,
          css: initialSite.css,
          js: initialSite.js,
          structuredData: initialSite.structuredData,
        }),
      );
      if (versionError) throw versionError;

      projectId = newProjectId;
    } catch (error) {
      const fallback = await createFallbackProject({
        user,
        name: parsed.data.name.trim(),
        slug,
        templateType,
        businessType,
        websiteGoal,
        structuredData: initialSite.structuredData,
        html: initialSite.html,
        css: initialSite.css,
        js: initialSite.js,
        userPrompt: parsed.data.prompt.trim(),
        assistantMessage: initialSite.assistantReply,
      });
      projectId = fallback.id;
      fallbackProject = mapFallbackProjectToApi(fallback);
    }

    return NextResponse.json({ ok: true, projectId, fallbackProject });
  } catch (error) {
    console.error("project create error", error);
    return NextResponse.json({ error: "Unable to create project right now." }, { status: 500 });
  }
}
