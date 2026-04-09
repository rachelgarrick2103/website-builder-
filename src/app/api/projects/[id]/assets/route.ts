import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  createFallbackAsset,
  getFallbackProject,
  saveFallbackProject,
} from "@/lib/fallback-store";
import { jsonError } from "@/lib/api";
import { isSupabaseUnavailableError, supabase, withSupabaseTimeout } from "@/lib/supabase";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    let project: { id: string } | null = null;
    try {
      const projectLookupQuery =
        user.role === "ADMIN"
          ? supabase.from("Project").select("id").eq("id", id).maybeSingle()
          : supabase.from("Project").select("id").eq("id", id).eq("userId", user.id).maybeSingle();
      const { data, error } = await withSupabaseTimeout(projectLookupQuery);
      if (error) throw error;
      project = data ? { id: data.id } : null;
    } catch (error) {
      if (!isSupabaseUnavailableError(error)) {
        throw error;
      }
    }

    if (!project) {
      const fallback = await getFallbackProject(user, id);
      if (!fallback) {
        return jsonError("Project not found.", 404);
      }
      project = { id: fallback.id };
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("No file provided.");
    }
    if (!allowedTypes.has(file.type)) {
      return jsonError("Unsupported file type. Please upload an image or PDF.");
    }
    if (file.size > MAX_FILE_BYTES) {
      return jsonError("File is too large. Maximum size is 8MB.");
    }

    const fileName = sanitizeFilename(file.name || "asset");
    const blobPath = `projects/${project.id}/${Date.now()}-${fileName}`;
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    let fileUrl: string;
    if (token) {
      const uploaded = await put(blobPath, file, {
        access: "public",
        token,
      });
      fileUrl = uploaded.url;
    } else {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      fileUrl = `data:${file.type};base64,${base64}`;
    }

    const insertQuery = supabase
      .from("Asset")
      .insert({
        projectId: project.id,
        userId: user.id,
        fileUrl,
        fileType: file.type,
        originalName: file.name,
      })
      .select("*")
      .single();

    const { data: asset, error: insertError } = await withSupabaseTimeout(insertQuery);
    if (insertError || !asset) {
      const fallbackProject = await getFallbackProject(user, id);
      if (!fallbackProject) {
        throw insertError ?? new Error("Unable to persist uploaded asset.");
      }
      const fallbackAsset = createFallbackAsset({
        fileUrl,
        fileType: file.type,
        originalName: file.name,
      });
      fallbackProject.assets = [fallbackAsset, ...fallbackProject.assets];
      fallbackProject.updatedAt = new Date();
      await saveFallbackProject(user, fallbackProject);
      return NextResponse.json({ asset: fallbackAsset, usingFallback: true }, { status: 201 });
    }

    return NextResponse.json({ asset, usingFallback: false }, { status: 201 });
  } catch (error) {
    console.error("asset upload error", error);
    return jsonError("Upload failed. Please try again.", 500);
  }
}
