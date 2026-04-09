import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOwnedProject, jsonError } from "@/lib/api";
import {
  getFallbackProject,
  saveFallbackProject,
} from "@/lib/fallback-store";
import { MessageRole } from "@/lib/types";
import { isSupabaseUnavailableError, supabase, withSupabaseTimeout } from "@/lib/supabase";

type Params = {
  params: Promise<{ id: string; versionId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id, versionId } = await params;
    const project = await getOwnedProject(id, user.id);
    if (!project) {
      const fallbackProject = await getFallbackProject(user, id);
      if (!fallbackProject) return jsonError("Project not found.", 404);
      const version = fallbackProject.versions.find((item) => item.id === versionId);
      if (!version) return jsonError("Version not found.", 404);

      fallbackProject.currentCodeHtml = version.html;
      fallbackProject.currentCodeCss = version.css;
      fallbackProject.currentCodeJs = version.js;
      fallbackProject.structuredData = version.structuredData;
      fallbackProject.hasUnpublishedChanges = true;
      fallbackProject.updatedAt = new Date();
      fallbackProject.messages = [
        ...fallbackProject.messages,
        {
          id: randomUUID(),
          role: "SYSTEM",
          content: `Restored version: ${version.label}`,
          createdAt: new Date(),
        },
      ];
      await saveFallbackProject(user, fallbackProject);
      return NextResponse.json({ ok: true });
    }

    const { data: version, error: versionError } = await withSupabaseTimeout(
      supabase
        .from("Version")
        .select("*")
        .eq("id", versionId)
        .eq("projectId", project.id)
        .maybeSingle(),
    );
    if (versionError) throw versionError;
    if (!version) return jsonError("Version not found.", 404);

    const { error: projectUpdateError } = await withSupabaseTimeout(
      supabase
        .from("Project")
        .update({
          currentCodeHtml: version.html,
          currentCodeCss: version.css,
          currentCodeJs: version.js,
          structuredData: version.structuredData,
          hasUnpublishedChanges: true,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", project.id)
        .eq("userId", user.id),
    );
    if (projectUpdateError) throw projectUpdateError;

    const { error: messageError } = await withSupabaseTimeout(
      supabase.from("Message").insert({
        id: randomUUID(),
        projectId: project.id,
        role: MessageRole.SYSTEM,
        content: `Restored version: ${version.label}`,
      }),
    );
    if (messageError) throw messageError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return jsonError(
        "Database is currently unavailable. Your temporary session project could not be restored.",
        503,
      );
    }
    console.error("restore version error", error);
    return jsonError("Unable to restore this version right now.", 500);
  }
}
