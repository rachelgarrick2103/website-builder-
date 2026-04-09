import { NextResponse } from "next/server";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getOwnedProject(projectId: string, userId: string, isAdmin = false) {
  const baseQuery = supabase
    .from("Project")
    .select("*, messages:Message(*), assets:Asset(*), versions:Version(*)")
    .eq("id", projectId);

  const ownProjectQuery = baseQuery.eq("userId", userId).maybeSingle();
  const ownProjectResult = await withSupabaseTimeout(ownProjectQuery);
  if (ownProjectResult.error) throw ownProjectResult.error;

  let data = ownProjectResult.data;
  if (!data && isAdmin) {
    // Admin can recover/access legacy projects created under previous auth IDs.
    const adminFallbackQuery = supabase
      .from("Project")
      .select("*, messages:Message(*), assets:Asset(*), versions:Version(*)")
      .eq("id", projectId)
      .maybeSingle();
    const adminFallbackResult = await withSupabaseTimeout(adminFallbackQuery);
    if (adminFallbackResult.error) throw adminFallbackResult.error;
    data = adminFallbackResult.data;
  }
  if (!data) return null;

  const messages = Array.isArray(data.messages)
    ? [...data.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];
  const assets = Array.isArray(data.assets)
    ? [...data.assets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const versions = Array.isArray(data.versions)
    ? [...data.versions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  return {
    ...data,
    messages,
    assets,
    versions,
  };
}

export function buildPreviewDocument(html: string, css: string, js: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
  <style>${css}</style>
</head>
<body>${html}<script>${js}</script></body>
</html>`;
}
