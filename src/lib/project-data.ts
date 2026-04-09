import { BusinessType, TemplateType, WebsiteGoal, type StructuredProjectData } from "@/lib/types";

export function labelToBusinessType(value: string): BusinessType {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("educator")) return BusinessType.LASH_EDUCATOR;
  if (normalized.includes("academy")) return BusinessType.BEAUTY_ACADEMY;
  if (normalized.includes("personal")) return BusinessType.PERSONAL_BRAND;
  if (normalized.includes("salon")) return BusinessType.SALON;
  if (normalized.includes("product")) return BusinessType.PRODUCT_BRAND;
  if (normalized.includes("hybrid")) return BusinessType.HYBRID;
  return BusinessType.LASH_ARTIST;
}

export function labelToGoal(value: string): WebsiteGoal {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("course")) return WebsiteGoal.SELL_COURSES;
  if (normalized.includes("authority")) return WebsiteGoal.BUILD_AUTHORITY;
  if (normalized.includes("showcase")) return WebsiteGoal.SHOWCASE_WORK;
  if (normalized.includes("lead")) return WebsiteGoal.CAPTURE_LEADS;
  return WebsiteGoal.BOOK_CLIENTS;
}

export function labelToTemplate(value: string): TemplateType {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("minimal")) return TemplateType.MINIMAL_BOUTIQUE;
  if (normalized.includes("bold")) return TemplateType.BOLD_STUDIO;
  return TemplateType.EDITORIAL_LUXE;
}

export function businessTypeLabel(value: BusinessType | string): string {
  const normalizedValue =
    typeof value === "string"
      ? value in BusinessType
        ? (value as BusinessType)
        : labelToBusinessType(value)
      : value;
  switch (normalizedValue) {
    case BusinessType.LASH_ARTIST:
      return "Lash Artist";
    case BusinessType.LASH_EDUCATOR:
      return "Lash Educator";
    case BusinessType.BEAUTY_ACADEMY:
      return "Beauty Academy";
    case BusinessType.PERSONAL_BRAND:
      return "Personal Brand";
    case BusinessType.SALON:
      return "Salon";
    case BusinessType.PRODUCT_BRAND:
      return "Product Brand";
    case BusinessType.HYBRID:
      return "Hybrid Brand";
    default:
      return "Beauty Business";
  }
}

export function goalLabel(value: WebsiteGoal | string): string {
  const normalizedValue =
    typeof value === "string"
      ? value in WebsiteGoal
        ? (value as WebsiteGoal)
        : labelToGoal(value)
      : value;
  switch (normalizedValue) {
    case WebsiteGoal.BOOK_CLIENTS:
      return "Book clients";
    case WebsiteGoal.SELL_COURSES:
      return "Sell courses";
    case WebsiteGoal.BUILD_AUTHORITY:
      return "Build authority";
    case WebsiteGoal.SHOWCASE_WORK:
      return "Showcase work";
    case WebsiteGoal.CAPTURE_LEADS:
      return "Capture leads";
    default:
      return "Grow your brand";
  }
}

export function createDefaultStructuredData(input: {
  brandName: string;
  businessType: BusinessType;
  websiteGoal: WebsiteGoal;
}): StructuredProjectData {
  return {
    brandName: input.brandName,
    tagline: "Premium beauty experiences with strategic results.",
    businessType: input.businessType,
    businessTypeLabel: businessTypeLabel(input.businessType),
    websiteGoal: input.websiteGoal,
    goalLabel: goalLabel(input.websiteGoal),
    about:
      "We help clients look and feel their best through precision technique, premium service standards, and a luxury client journey.",
    callToAction: "Book your appointment",
    tone: "luxury",
    targetAudience: "Beauty clients and students seeking premium outcomes.",
    offers: [],
    credentials: [],
    faqs: [],
    inspirationNotes: [],
    socialProof: ["Trusted by loyal clients and returning referrals."],
  };
}

function detectTone(text: string): "luxury" | "modern" | "warm" {
  const lower = text.toLowerCase();
  if (lower.includes("luxury") || lower.includes("premium") || lower.includes("editorial")) return "luxury";
  if (lower.includes("warm") || lower.includes("friendly")) return "warm";
  return "modern";
}

export function extractStructuredUpdatesFromMessage(
  existing: StructuredProjectData,
  message: string,
): StructuredProjectData {
  const updates: StructuredProjectData = { ...existing };
  updates.tone = detectTone(message);

  if (message.toLowerCase().includes("book")) {
    updates.callToAction = "Book your appointment";
  }

  if (message.toLowerCase().includes("course")) {
    updates.offers = Array.from(new Set([...updates.offers, "Course training program"]));
  }

  if (message.toLowerCase().includes("instagram")) {
    updates.socialProof = Array.from(
      new Set([...updates.socialProof, "Follow us for recent transformations and student wins."]),
    );
  }

  if (message.toLowerCase().includes("inspiration") || message.toLowerCase().includes("like this")) {
    updates.inspirationNotes = Array.from(new Set([...updates.inspirationNotes, message]));
  }

  return updates;
}
