import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFallbackProject } from "@/lib/fallback-store";
import { buildPreviewDocument } from "@/lib/api";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";

export default async function ProjectPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let project: any = null;
  try {
    const query = supabase
      .from("Project")
      .select("*")
      .eq("id", id)
      .eq("userId", user.id)
      .maybeSingle();
    const { data, error } = await withSupabaseTimeout(query);
    if (error) throw error;
    project = data;
  } catch (error) {
    console.error("preview project load error", error);
  }

  const fallbackProject = await getFallbackProject(user, id);
  const activeProject = project ?? fallbackProject;
  if (!activeProject) {
    redirect("/dashboard");
  }

  const doc = buildPreviewDocument(
    activeProject.currentCodeHtml,
    activeProject.currentCodeCss,
    activeProject.currentCodeJs,
  );

  return (
    <main className="shell">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="section-title text-4xl">Preview</h1>
        <a className="btn-secondary" href={`/project/${activeProject.id}`}>
          Back to builder
        </a>
      </div>
      <div className="panel overflow-hidden">
        <iframe title="project-preview" className="h-[78vh] w-full" srcDoc={doc} sandbox="allow-scripts allow-same-origin" />
      </div>
    </main>
  );
}
