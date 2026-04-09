import { requireUser } from "@/lib/auth";
import { FallbackProjectLoader } from "@/components/fallback-project-loader";
import { ProjectBuilder } from "@/components/project-builder";
import { buildPreviewDocument } from "@/lib/api";
import { getFallbackProject } from "@/lib/fallback-store";
import { getOwnedProject } from "@/lib/api";
import { isSupabaseUnavailableError } from "@/lib/supabase";

type Params = Promise<{ id: string }>;

export default async function ProjectPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;

  let project: any = null;
  try {
    project = await getOwnedProject(id, user.id);
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      throw error;
    }
  }

  if (!project) {
    const fallbackProject = await getFallbackProject(user, id);
    if (!fallbackProject) {
      return <FallbackProjectLoader projectId={id} />;
    }
    const initialPreviewDoc = buildPreviewDocument(
      fallbackProject.currentCodeHtml,
      fallbackProject.currentCodeCss,
      fallbackProject.currentCodeJs,
    );
    return (
      <main>
        <ProjectBuilder initialProject={fallbackProject} initialPreviewDoc={initialPreviewDoc} />
      </main>
    );
  }

  const initialPreviewDoc = buildPreviewDocument(
    project.currentCodeHtml,
    project.currentCodeCss,
    project.currentCodeJs,
  );

  return (
    <main>
      <ProjectBuilder initialProject={project as any} initialPreviewDoc={initialPreviewDoc} />
    </main>
  );
}
