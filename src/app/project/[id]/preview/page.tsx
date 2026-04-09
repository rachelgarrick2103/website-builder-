import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPreviewDocument } from "@/lib/api";

export default async function ProjectPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const project = await db.project.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!project) {
    redirect("/dashboard");
  }

  const doc = buildPreviewDocument(project.currentCodeHtml, project.currentCodeCss, project.currentCodeJs);

  return (
    <main className="shell">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="section-title text-4xl">Preview</h1>
        <a className="btn-secondary" href={`/project/${project.id}`}>
          Back to builder
        </a>
      </div>
      <div className="panel overflow-hidden">
        <iframe title="project-preview" className="h-[78vh] w-full" srcDoc={doc} sandbox="allow-scripts allow-same-origin" />
      </div>
    </main>
  );
}
