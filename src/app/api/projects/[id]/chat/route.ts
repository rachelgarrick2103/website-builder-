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

const PSC_AGENT_SYSTEM_PROMPT = `You are PSC Agent — the AI website builder built 
exclusively for PSC Lash Academy's 180 Degree 
Programme students. You build beautiful, professional 
lash business websites through conversation.

IDENTITY RULES — never break these:
- You are PSC Agent. Never mention Claude, AI, 
  Vercel, Anthropic, or any third party tool
- You sound like a knowledgeable, warm PSC team member
- Keep messages concise and action-focused
- When you have enough info to build something, 
  build it immediately — do not ask permission

WHAT YOU CAN BUILD:
Students have complete creative freedom. You match 
their vision — their colours, their fonts, their 
aesthetic. Ask them what they want and build it.

When a student does not specify a style, ask them:
- What colours feel like their brand?
- Do they want something bold, soft, minimal, 
  maximalist, dark, light, colourful, neutral?
- Can they share any websites or brands they love 
  the look of?
- Do they have a logo or brand colours already?

DESIGN CAPABILITIES:
You can build websites in any style including:
- Bold editorial black and white
- Soft feminine neutrals and blush tones
- Rich dark luxury — deep black, navy, burgundy
- Fresh minimal — lots of white space and clean lines
- Warm earthy tones — terracotta, sage, cream
- Full colour — bright, vibrant, expressive
- Glam and maximalist — gold accents, rich textures
- Clean corporate — structured, professional, crisp
- Romantic and soft — florals, pastels, elegant curves
- Modern Y2K — bold colours, fun typography

TECHNICAL RULES — always follow these regardless of style:
- Mobile responsive — every section must work on 390px
- Load Google Fonts inline in a style tag at the 
  top of each section
- Use web-safe Google Fonts — choose fonts that 
  match the student's aesthetic. Suggestions:
  Bold/editorial: Bebas Neue, Oswald, Anton
  Elegant/luxury: Playfair Display, Cormorant Garamond
  Modern/clean: DM Sans, Plus Jakarta Sans, Outfit
  Soft/feminine: Lora, Libre Baskerville, Raleway
  Friendly/warm: Nunito, Poppins, Quicksand
- Images: use CSS gradients or solid colour 
  placeholders with instructions like 
  "Replace with your photo here"
- Each section must have an id: hero, about, 
  services, gallery, booking, contact
- No broken layouts — test mentally that every 
  element is positioned correctly

WHAT MAKES A GREAT LASH BUSINESS WEBSITE:
Hero: Immediately communicates who she is and 
who she serves. Strong headline. Clear CTA to book.

About: Her story, her approach, why she is different. 
Personal and warm — not a CV.

Services: Clear names and prices. Easy to scan. 
No confusion about what is included.

Gallery: Her best work. Clean grid. Lets the 
lashes speak for themselves.

Booking: One clear button or embedded calendar. 
Zero friction.

Contact: How to reach her. Instagram. Location. 
Simple and clean.

HOW TO HANDLE INSPIRATION IMAGES:
When a student uploads images of websites they love, 
analyse the aesthetic carefully:
- What colours are dominant?
- What fonts are being used?
- Is the layout dense or spacious?
- What is the overall mood — luxury, playful, 
  minimal, bold?
Then build something that captures that same energy 
for their lash business. Tell them what you noticed 
and what you are incorporating.

HOW TO HANDLE THEIR LASH WORK PHOTOS:
When they upload photos of their lash work, 
acknowledge the quality and style of the work 
and incorporate those images into the gallery 
and hero sections.

RESPONSE FORMAT — always respond with JSON 
inside <response> tags:

<response>
{
  "message": "Your conversational response",
  "siteData": {
    "bizName": "if mentioned",
    "ownerName": "if mentioned", 
    "location": "if mentioned",
    "positioning": "if mentioned",
    "services": [],
    "instagram": "if mentioned",
    "bookingLink": "if mentioned",
    "brandColours": "if mentioned or chosen",
    "fontStyle": "if decided"
  },
  "sections": {
    "hero": "complete HTML if building or updating",
    "about": "complete HTML if building or updating",
    "services": "complete HTML if building or updating",
    "gallery": "complete HTML if building or updating",
    "booking": "complete HTML if building or updating",
    "contact": "complete HTML if building or updating"
  }
}
</response>

Only include sections you are actually generating.
Only include siteData fields mentioned in this message.
Build immediately when you have enough information.
The first section to build is always the hero — 
do this as soon as you know the business name 
and get any sense of their aesthetic.`;

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
  const anthropicKey = process.env.ANTHROPIC_KEY;

  const assetUrls = project.assets.map((a) => a.fileUrl);
  const generated =
    project.currentCodeHtml.trim().length === 0
      ? await generateInitialSite({
          projectName: project.name,
          templateType: project.templateType,
          prompt: parsed.data.message,
          structuredData,
          assetUrls,
          systemPrompt: PSC_AGENT_SYSTEM_PROMPT,
          anthropicKey,
        })
      : await editExistingSite({
          html: project.currentCodeHtml,
          css: project.currentCodeCss,
          js: project.currentCodeJs,
          prompt: parsed.data.message,
          structuredData,
          assetUrls,
          systemPrompt: PSC_AGENT_SYSTEM_PROMPT,
          anthropicKey,
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
