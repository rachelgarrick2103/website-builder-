import type { BusinessType, WebsiteGoal } from "@prisma/client";

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
