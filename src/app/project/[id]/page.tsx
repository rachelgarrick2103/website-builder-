import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, isDatabaseUnavailableError } from "@/lib/db";
import { ProjectBuilder } from "@/components/project-builder";
import { buildPreviewDocument } from "@/lib/api";
import { getFallbackProject } from "@/lib/fallback-store";

type Params = Promise<{ id: string }>;

export default async function ProjectPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;

  let project: any = null;
  try {
    project = await db.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        assets: {
          orderBy: { createdAt: "desc" },
        },
        versions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }
  }

  if (!project) {
    const fallbackProject = await getFallbackProject(user, id);
    if (!fallbackProject) {
      notFound();
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
