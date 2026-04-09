import Anthropic from "@anthropic-ai/sdk";
import type { TemplateType } from "@prisma/client";
import type { StructuredProjectData } from "@/lib/types";
import { applyConversationEdit, buildInitialWebsite } from "@/lib/templates";

type InitialGenerationInput = {
  projectName: string;
  templateType: TemplateType;
  structuredData: StructuredProjectData;
  prompt: string;
  assetUrls: string[];
};

type ExistingSiteInput = {
  html: string;
  css: string;
  js: string;
  prompt: string;
  structuredData: StructuredProjectData;
  assetUrls: string[];
};

type AgentResult = {
  html: string;
  css: string;
  js: string;
  assistantReply: string;
  structuredData: StructuredProjectData;
};

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Continue.
  }

  const codeFenceMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (!codeFenceMatch) {
    return null;
  }

  try {
    return JSON.parse(codeFenceMatch[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function sanitizeAgentResult(payload: Record<string, unknown>, fallback: AgentResult): AgentResult {
  const html = typeof payload.html === "string" && payload.html.length > 20 ? payload.html : fallback.html;
  const css = typeof payload.css === "string" ? payload.css : fallback.css;
  const js = typeof payload.js === "string" ? payload.js : fallback.js;
  const assistantReply =
    typeof payload.assistantReply === "string" ? payload.assistantReply : fallback.assistantReply;
  const structuredData =
    typeof payload.structuredData === "object" && payload.structuredData
      ? ({ ...fallback.structuredData, ...(payload.structuredData as Record<string, unknown>) } as StructuredProjectData)
      : fallback.structuredData;

  return { html, css, js, assistantReply, structuredData };
}

export async function generateInitialSite(input: InitialGenerationInput): Promise<AgentResult> {
  const fallbackWebsite = buildInitialWebsite(input.projectName, input.structuredData, input.templateType);
  const fallback: AgentResult = {
    ...fallbackWebsite,
    assistantReply:
      "Your first draft is ready. I built a premium structure tailored to your beauty brand and goal.",
    structuredData: input.structuredData,
  };

  const client = getAnthropicClient();
  if (!client) {
    return fallback;
  }

  try {
    const response = await client.messages.create({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 4096,
      system:
        "You are PSC Agent, a premium website strategist for beauty businesses. Output JSON only with keys html, css, js, assistantReply, structuredData. Keep luxury black-and-white aesthetic and conversion-focused sections.",
      messages: [
        {
          role: "user",
          content: `Create a polished website draft.

Project name: ${input.projectName}
Template type: ${input.templateType}
Student prompt: ${input.prompt}
Structured data JSON:
${JSON.stringify(input.structuredData)}
Asset URLs:
${JSON.stringify(input.assetUrls)}

Rules:
- Do not mention AI or third-party tooling.
- Keep a premium editorial beauty style.
- Include hero, about, offers/services, social proof, CTA.
- Return valid HTML section markup only for inside <main>.
- Return CSS and optional JS.
- Return updated structuredData if additional insights can be inferred.
- Respond with strict JSON only.`,
        },
      ],
    });

    const text = response.content
      .map((item) => ("text" in item ? item.text : ""))
      .filter(Boolean)
      .join("\n");

    const parsed = parseJsonFromText(text);
    if (!parsed) {
      return fallback;
    }

    return sanitizeAgentResult(parsed, fallback);
  } catch {
    return fallback;
  }
}

export async function editExistingSite(input: ExistingSiteInput): Promise<AgentResult> {
  const fallbackEdit = applyConversationEdit(
    {
      html: input.html,
      css: input.css,
      js: input.js,
    },
    input.prompt,
  );

  const fallback: AgentResult = {
    html: fallbackEdit.html,
    css: fallbackEdit.css,
    js: fallbackEdit.js,
    assistantReply: fallbackEdit.assistantReply,
    structuredData: input.structuredData,
  };

  const client = getAnthropicClient();
  if (!client) {
    return fallback;
  }

  try {
    const response = await client.messages.create({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 4096,
      system:
        "You are PSC Agent. Modify an existing website with targeted edits while preserving structure and premium aesthetics. Output JSON only.",
      messages: [
        {
          role: "user",
          content: `Apply this edit request without rebuilding everything unless explicitly asked:
${input.prompt}

Current structured data:
${JSON.stringify(input.structuredData)}

Current HTML:
${input.html}

Current CSS:
${input.css}

Current JS:
${input.js}

Asset URLs:
${JSON.stringify(input.assetUrls)}

Return strict JSON only with html, css, js, assistantReply, structuredData.`,
        },
      ],
    });

    const text = response.content
      .map((item) => ("text" in item ? item.text : ""))
      .filter(Boolean)
      .join("\n");
    const parsed = parseJsonFromText(text);
    if (!parsed) {
      return fallback;
    }

    return sanitizeAgentResult(parsed, fallback);
  } catch {
    return fallback;
  }
}
