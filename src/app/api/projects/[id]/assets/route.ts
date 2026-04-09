import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  createFallbackAsset,
  getFallbackProject,
  saveFallbackProject,
} from "@/lib/fallback-store";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { isDatabaseUnavailableError } from "@/lib/db";

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
    let useFallback = false;
    let project: { id: string } | null = null;
    try {
      project = await db.project.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      });
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        throw error;
      }
      useFallback = true;
      project = getFallbackProject(user.id, id);
    }

    if (!project) {
      return jsonError("Project not found.", 404);
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

    if (useFallback) {
      const fallbackProject = getFallbackProject(user.id, id);
      if (!fallbackProject) {
        return jsonError("Project not found.", 404);
      }
      const asset = createFallbackAsset({
        fileUrl,
        fileType: file.type,
        originalName: file.name,
      });
      fallbackProject.assets = [asset, ...fallbackProject.assets];
      fallbackProject.updatedAt = new Date();
      saveFallbackProject(user.id, fallbackProject);
      return NextResponse.json({ asset }, { status: 201 });
    }

    const asset = await db.asset.create({
      data: {
        projectId: project.id,
        userId: user.id,
        fileUrl,
        fileType: file.type,
        originalName: file.name,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error("asset upload error", error);
    return jsonError("Upload failed. Please try again.", 500);
  }
}
