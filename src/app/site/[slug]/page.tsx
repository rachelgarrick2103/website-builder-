import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { buildPreviewDocument } from "@/lib/api";

export default async function LiveSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    select: {
      currentCodeHtml: true,
      currentCodeCss: true,
      currentCodeJs: true,
      status: true,
    },
  });

  if (!project || project.status !== "LIVE") {
    notFound();
  }

  const doc = buildPreviewDocument(project.currentCodeHtml, project.currentCodeCss, project.currentCodeJs);

  return (
    <main className="min-h-screen bg-white">
      <iframe
        title="Live site"
        srcDoc={doc}
        className="h-screen w-full border-0"
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
      />
    </main>
  );
}
