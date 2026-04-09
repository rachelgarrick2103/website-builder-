import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { RestoreVersionButton } from "@/components/restore-version-button";
import { db } from "@/lib/db";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const project = await db.project.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <main className="shell space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            PSC Website Creator
          </p>
          <h1 className="mt-2 font-display text-5xl uppercase leading-none">Versions</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Restore previous snapshots of your PSC site with one click.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/project/${project.id}`} className="btn-primary">
            Back to builder
          </Link>
        </div>
      </header>

      <section className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-4 text-sm font-semibold text-neutral-700">
          {project.versions.length} saved {project.versions.length === 1 ? "version" : "versions"}
        </div>
        {project.versions.length === 0 ? (
          <div className="px-5 py-10 text-sm text-neutral-600">
            No versions saved yet. In your project builder, click <strong>Save version</strong> after a key milestone.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {project.versions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{version.label}</p>
                  <p className="text-xs text-neutral-500">{formatDate(version.createdAt)}</p>
                </div>
                <RestoreVersionButton projectId={project.id} versionId={version.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
