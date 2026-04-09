import Anthropic from "@anthropic-ai/sdk";
import { TemplateType, type StructuredProjectData } from "@/lib/types";
import { applyConversationEdit, buildInitialWebsite } from "@/lib/templates";

type InitialGenerationInput = {
  projectName: string;
  templateType: TemplateType;
  structuredData: StructuredProjectData;
  prompt: string;
  assetUrls: string[];
  systemPrompt?: string;
  anthropicKey?: string;
};

type ExistingSiteInput = {
  html: string;
  css: string;
  js: string;
  prompt: string;
  structuredData: StructuredProjectData;
  assetUrls: string[];
  systemPrompt?: string;
  anthropicKey?: string;
};

type AgentResult = {
  html: string;
  css: string;
  js: string;
  assistantReply: string;
  structuredData: StructuredProjectData;
  sections?: Record<string, string>;
};

const DEFAULT_SYSTEM_PROMPT =
  "You are PSC Agent, a premium website strategist for beauty businesses.";
const AI_RESPONSE_TIMEOUT_MS = 5000;

async function withAiTimeout<T>(promise: Promise<T>, timeoutMs = AI_RESPONSE_TIMEOUT_MS): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("ai-timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();

  const responseTagMatch = trimmed.match(/<response>\s*([\s\S]*?)\s*<\/response>/i);
  if (responseTagMatch) {
    try {
      return JSON.parse(responseTagMatch[1]) as Record<string, unknown>;
    } catch {
      // Continue.
    }
  }

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

function getAnthropicClient(anthropicKey?: string) {
  const apiKey = anthropicKey ?? process.env.ANTHROPIC_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function htmlFromSections(sections: Record<string, unknown>): string {
  const orderedKeys = ["hero", "about", "services", "gallery", "booking", "contact"];
  const orderedHtml = orderedKeys
    .map((key) => (typeof sections[key] === "string" ? (sections[key] as string) : ""))
    .filter((value) => value.trim().length > 0);
  const extras = Object.entries(sections)
    .filter(([key]) => !orderedKeys.includes(key))
    .map(([, value]) => (typeof value === "string" ? value : ""))
    .filter((value) => value.trim().length > 0);
  const merged = [...orderedHtml, ...extras].join("\n");
  if (!merged.trim()) return "";
  return `<main>\n${merged}\n</main>`;
}

function mergeStructuredDataFromSiteData(
  existing: StructuredProjectData,
  siteData: Record<string, unknown>,
): StructuredProjectData {
  const merged = { ...existing };

  if (typeof siteData.bizName === "string" && siteData.bizName.trim()) {
    merged.brandName = siteData.bizName.trim();
  }
  if (typeof siteData.positioning === "string" && siteData.positioning.trim()) {
    merged.tagline = siteData.positioning.trim();
  }
  if (typeof siteData.location === "string" && siteData.location.trim()) {
    merged.location = siteData.location.trim();
  }
  if (typeof siteData.instagram === "string" && siteData.instagram.trim()) {
    merged.instagramHandle = siteData.instagram.trim();
  }
  if (typeof siteData.bookingLink === "string" && siteData.bookingLink.trim()) {
    merged.bookingUrl = siteData.bookingLink.trim();
  }
  if (Array.isArray(siteData.services)) {
    const serviceItems = siteData.services.filter((value): value is string => typeof value === "string");
    if (serviceItems.length) {
      merged.offers = Array.from(new Set([...merged.offers, ...serviceItems]));
    }
  }
  if (typeof siteData.brandColours === "string" && siteData.brandColours.trim()) {
    merged.inspirationNotes = Array.from(
      new Set([...merged.inspirationNotes, `Brand colours: ${siteData.brandColours.trim()}`]),
    );
  }
  if (typeof siteData.fontStyle === "string" && siteData.fontStyle.trim()) {
    merged.inspirationNotes = Array.from(
      new Set([...merged.inspirationNotes, `Font style: ${siteData.fontStyle.trim()}`]),
    );
  }
  return merged;
}

function sanitizeAgentResult(payload: Record<string, unknown>, fallback: AgentResult): AgentResult {
  const sectionPayload =
    typeof payload.sections === "object" && payload.sections
      ? (payload.sections as Record<string, unknown>)
      : null;
  const siteData =
    typeof payload.siteData === "object" && payload.siteData
      ? (payload.siteData as Record<string, unknown>)
      : null;
  const normalizedSections = sectionPayload
    ? Object.fromEntries(
        Object.entries(sectionPayload)
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => [key, value as string]),
      )
    : undefined;
  const responseSectionsHtml = normalizedSections ? htmlFromSections(normalizedSections) : "";
  const html = typeof payload.html === "string" && payload.html.length > 20
    ? payload.html
    : responseSectionsHtml.length > 20
      ? responseSectionsHtml
      : fallback.html;
  const css = typeof payload.css === "string" ? payload.css : fallback.css;
  const js = typeof payload.js === "string" ? payload.js : fallback.js;
  const assistantReply =
    typeof payload.assistantReply === "string"
      ? payload.assistantReply
      : typeof payload.message === "string"
        ? payload.message
        : fallback.assistantReply;
  let structuredData = fallback.structuredData;
  if (typeof payload.structuredData === "object" && payload.structuredData) {
    structuredData = {
      ...structuredData,
      ...(payload.structuredData as Record<string, unknown>),
    } as StructuredProjectData;
  }
  if (siteData) {
    structuredData = mergeStructuredDataFromSiteData(structuredData, siteData);
  }

  return { html, css, js, assistantReply, structuredData, sections: normalizedSections };
}

export async function generateInitialSite(input: InitialGenerationInput): Promise<AgentResult> {
  const fallbackWebsite = buildInitialWebsite(input.projectName, input.structuredData, input.templateType);
  const fallback: AgentResult = {
    ...fallbackWebsite,
    assistantReply:
      "Your first draft is ready. I built a premium structure tailored to your beauty brand and goal.",
    structuredData: input.structuredData,
  };

  const client = getAnthropicClient(input.anthropicKey);
  if (!client) {
    return fallback;
  }

  try {
    const response = await withAiTimeout(
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
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
- Follow the response format in the system prompt.
- Include complete section HTML for sections you generate.
- Ensure section ids are valid where required.
- Return updated siteData values when inferred.
- Respond with strict JSON inside <response> tags.`,
          },
        ],
      }),
    );

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

  const client = getAnthropicClient(input.anthropicKey);
  if (!client) {
    return fallback;
  }

  try {
    const response = await withAiTimeout(
      client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
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

Return strict JSON inside <response> tags using the required schema.
Only include sections that are being generated or updated in this turn.`,
          },
        ],
      }),
    );

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
