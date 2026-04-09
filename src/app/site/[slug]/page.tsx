import { notFound } from "next/navigation";
import { db, isDatabaseUnavailableError } from "@/lib/db";
import { buildPreviewDocument } from "@/lib/api";
import { getFallbackProjectBySlug } from "@/lib/fallback-store";

export default async function LiveSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let project: {
    currentCodeHtml: string;
    currentCodeCss: string;
    currentCodeJs: string;
    status: "DRAFT" | "PUBLISHING" | "LIVE";
  } | null = null;

  try {
    project = await db.project.findUnique({
      where: { slug },
      select: {
        currentCodeHtml: true,
        currentCodeCss: true,
        currentCodeJs: true,
        status: true,
      },
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }
    const fallback = getFallbackProjectBySlug(slug);
    project = fallback
      ? {
          currentCodeHtml: fallback.currentCodeHtml,
          currentCodeCss: fallback.currentCodeCss,
          currentCodeJs: fallback.currentCodeJs,
          status: fallback.status,
        }
      : null;
  }

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
