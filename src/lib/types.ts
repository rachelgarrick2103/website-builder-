export const ProjectStatus = {
  DRAFT: "DRAFT",
  PUBLISHING: "PUBLISHING",
  LIVE: "LIVE",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const MessageRole = {
  USER: "USER",
  ASSISTANT: "ASSISTANT",
  SYSTEM: "SYSTEM",
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const TemplateType = {
  EDITORIAL_LUXE: "EDITORIAL_LUXE",
  MINIMAL_BOUTIQUE: "MINIMAL_BOUTIQUE",
  BOLD_STUDIO: "BOLD_STUDIO",
} as const;

export type TemplateType = (typeof TemplateType)[keyof typeof TemplateType];

export const BusinessType = {
  LASH_ARTIST: "LASH_ARTIST",
  LASH_EDUCATOR: "LASH_EDUCATOR",
  BEAUTY_ACADEMY: "BEAUTY_ACADEMY",
  PERSONAL_BRAND: "PERSONAL_BRAND",
  SALON: "SALON",
  PRODUCT_BRAND: "PRODUCT_BRAND",
  HYBRID: "HYBRID",
} as const;

export type BusinessType = (typeof BusinessType)[keyof typeof BusinessType];

export const WebsiteGoal = {
  BOOK_CLIENTS: "BOOK_CLIENTS",
  SELL_COURSES: "SELL_COURSES",
  BUILD_AUTHORITY: "BUILD_AUTHORITY",
  SHOWCASE_WORK: "SHOWCASE_WORK",
  CAPTURE_LEADS: "CAPTURE_LEADS",
} as const;

export type WebsiteGoal = (typeof WebsiteGoal)[keyof typeof WebsiteGoal];

export type StructuredProjectData = {
  brandName: string;
  tagline: string;
  businessType: BusinessType;
  businessTypeLabel: string;
  websiteGoal: WebsiteGoal;
  goalLabel: string;
  about: string;
  callToAction: string;
  tone: "luxury" | "modern" | "warm";
  targetAudience: string;
  offers: string[];
  credentials: string[];
  faqs: { q: string; a: string }[];
  inspirationNotes: string[];
  socialProof: string[];
  bookingUrl?: string;
  instagramHandle?: string;
  location?: string;
};

export type GeneratedSite = {
  html: string;
  css: string;
  js: string;
  structuredData: StructuredProjectData;
  assistantMessage: string;
};
