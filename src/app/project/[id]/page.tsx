import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProjectBuilder } from "@/components/project-builder";
import { buildPreviewDocument } from "@/lib/api";

type Params = Promise<{ id: string }>;

export default async function ProjectPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;

  const project = await db.project.findFirst({
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

  if (!project) {
    notFound();
  }

  const initialPreviewDoc = buildPreviewDocument(
    project.currentCodeHtml,
    project.currentCodeCss,
    project.currentCodeJs,
  );

  return (
    <main>
      <ProjectBuilder initialProject={project} initialPreviewDoc={initialPreviewDoc} />
    </main>
  );
}
