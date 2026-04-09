import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { editExistingSite, generateInitialSite } from "@/lib/ai";
import { getFallbackProject, saveFallbackProject } from "@/lib/fallback-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractStructuredUpdatesFromMessage } from "@/lib/project-data";
import { jsonError } from "@/lib/api";
import { MessageRole, type StructuredProjectData } from "@/lib/types";
import { isSupabaseUnavailableError, supabase, withSupabaseTimeout } from "@/lib/supabase";

const schema = z.object({
  message: z.string().min(1).max(4000),
});

const PSC_AGENT_SYSTEM_PROMPT = `You are PSC Agent — the AI website builder 
for PSC Lash Academy's 180 Degree Programme.
You build beautiful professional lash business 
websites through conversation.

NEVER mention Claude, AI, Anthropic, or any 
tool. You are PSC Agent only.

When building websites you have complete 
creative freedom. Match the student's vision — 
their colours, their fonts, their aesthetic.

Ask them:
- What colours feel like their brand?
- What mood — bold, soft, minimal, luxurious?
- Do they have inspiration websites they love?

Build sections progressively as you learn 
about their business. Start with the hero 
section as soon as you know their business 
name and aesthetic direction.

RESPONSE FORMAT — always return valid JSON 
inside <response> tags:
<response>
{
  "message": "your conversational response",
  "sections": {
    "hero": "complete HTML string if building",
    "about": "complete HTML string if building",
    "services": "complete HTML string if building",
    "gallery": "complete HTML string if building",
    "booking": "complete HTML string if building",
    "contact": "complete HTML string if building"
  },
  "siteData": {
    "bizName": "if mentioned",
    "ownerName": "if mentioned",
    "location": "if mentioned",
    "services": [],
    "instagram": "if mentioned",
    "bookingLink": "if mentioned",
    "brandColours": "if decided",
    "fontStyle": "if decided"
  }
}
</response>

Only include sections you are actually building.
Build immediately when you have enough info.
Make websites that are genuinely beautiful —
not generic AI output.`;

function buildSectionsPreviewDoc(sections: Record<string, string>, css: string, js: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>${Object.values(sections).join("")}<script>${js}</script></body>
</html>`;
}

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
  let project: any = null;
  let fallbackProject = null as Awaited<ReturnType<typeof getFallbackProject>>;
  let usingFallback = false;

  try {
    const projectResult = await withSupabaseTimeout(
      supabase
        .from("Project")
        .select("*")
        .eq("id", id)
        .eq("userId", user.id)
        .maybeSingle(),
    );
    if (projectResult.error) throw projectResult.error;
    project = projectResult.data;
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      throw error;
    }
    usingFallback = true;
    fallbackProject = await getFallbackProject(user, id);
  }

  if (!project && !fallbackProject) {
    return jsonError("Project not found.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Please provide a valid message.");
  }

  if (project) {
    const saveUserMessageResult = await withSupabaseTimeout(
      supabase.from("Message").insert({
        id: randomUUID(),
        projectId: project.id,
        role: MessageRole.USER,
        content: parsed.data.message,
      }),
    );
    if (saveUserMessageResult.error) throw saveUserMessageResult.error;
  } else if (fallbackProject) {
    fallbackProject.messages.push({
      id: randomUUID(),
      role: "USER",
      content: parsed.data.message,
      createdAt: new Date(),
    });
  }

  const sourceStructuredData = project
    ? (project.structuredData as StructuredProjectData)
    : (fallbackProject!.structuredData as StructuredProjectData);
  const structuredData = extractStructuredUpdatesFromMessage(sourceStructuredData, parsed.data.message);
  const anthropicKey = process.env.ANTHROPIC_KEY;

  const assetUrls = fallbackProject?.assets.map((asset) => asset.fileUrl) ?? [];
  if (project) {
    const projectAssetsResult = await withSupabaseTimeout(
      supabase.from("Asset").select("fileUrl").eq("projectId", project.id),
    );
    if (!projectAssetsResult.error) {
      const dbAssetUrls = ((projectAssetsResult.data ?? []) as Array<{ fileUrl?: string }>)
        .map((asset) => asset.fileUrl)
        .filter((value): value is string => typeof value === "string");
      if (dbAssetUrls.length) {
        assetUrls.splice(0, assetUrls.length, ...dbAssetUrls);
      }
    }
  }

  const generated =
    (project ? project.currentCodeHtml : fallbackProject!.currentCodeHtml).trim().length === 0
      ? await generateInitialSite({
          projectName: project ? project.name : fallbackProject!.name,
          templateType: project ? project.templateType : (fallbackProject!.templateType as any),
          prompt: parsed.data.message,
          structuredData,
          assetUrls,
          systemPrompt: PSC_AGENT_SYSTEM_PROMPT,
          anthropicKey,
        })
      : await editExistingSite({
          html: project ? project.currentCodeHtml : fallbackProject!.currentCodeHtml,
          css: project ? project.currentCodeCss : fallbackProject!.currentCodeCss,
          js: project ? project.currentCodeJs : fallbackProject!.currentCodeJs,
          prompt: parsed.data.message,
          structuredData,
          assetUrls,
          systemPrompt: PSC_AGENT_SYSTEM_PROMPT,
          anthropicKey,
        });

  let updatedProject: any = null;
  let previewDoc: string | null = null;

  if (generated.sections && Object.keys(generated.sections).length > 0) {
    previewDoc = buildSectionsPreviewDoc(generated.sections, generated.css, generated.js);
  }

  if (project && !usingFallback) {
    const updateProjectResult = await withSupabaseTimeout(
      supabase
        .from("Project")
        .update({
          currentCodeHtml: generated.html,
          currentCodeCss: generated.css,
          currentCodeJs: generated.js,
          structuredData: generated.structuredData,
          hasUnpublishedChanges: project.status === "LIVE",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", project.id)
        .eq("userId", user.id),
    );
    if (updateProjectResult.error) throw updateProjectResult.error;

    const assistantMessageResult = await withSupabaseTimeout(
      supabase.from("Message").insert({
        id: randomUUID(),
        projectId: project.id,
        role: MessageRole.ASSISTANT,
        content: generated.assistantReply,
      }),
    );
    if (assistantMessageResult.error) throw assistantMessageResult.error;

    const reloadedProjectResult = await withSupabaseTimeout(
      supabase
        .from("Project")
        .select("*")
        .eq("id", project.id)
        .eq("userId", user.id)
        .single(),
    );
    if (reloadedProjectResult.error) throw reloadedProjectResult.error;

    const [messagesResult, assetsResult] = await Promise.all([
      withSupabaseTimeout(
        supabase.from("Message").select("*").eq("projectId", project.id).order("createdAt", { ascending: true }),
      ),
      withSupabaseTimeout(
        supabase.from("Asset").select("*").eq("projectId", project.id).order("createdAt", { ascending: false }),
      ),
    ]);
    if (messagesResult.error) throw messagesResult.error;
    if (assetsResult.error) throw assetsResult.error;

    updatedProject = {
      ...reloadedProjectResult.data,
      messages: messagesResult.data ?? [],
      assets: assetsResult.data ?? [],
      versions: [],
    };
  } else if (fallbackProject) {
    fallbackProject.currentCodeHtml = generated.html;
    fallbackProject.currentCodeCss = generated.css;
    fallbackProject.currentCodeJs = generated.js;
    fallbackProject.structuredData = generated.structuredData;
    fallbackProject.updatedAt = new Date();
    fallbackProject.hasUnpublishedChanges = fallbackProject.status === "LIVE";
    fallbackProject.messages.push({
      id: randomUUID(),
      role: "ASSISTANT",
      content: generated.assistantReply,
      createdAt: new Date(),
    });
    await saveFallbackProject(user, fallbackProject);
    updatedProject = fallbackProject;
  }

  return NextResponse.json({
    project: updatedProject,
    sections: generated.sections ?? {},
    previewDoc,
  });
}
