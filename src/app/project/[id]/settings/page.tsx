import { notFound } from "next/navigation";
import Link from "next/link";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const project = await db.project.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      assets: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <main className="shell space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Project settings</p>
          <h1 className="section-title text-5xl">{project.name}</h1>
        </div>
        <Link className="btn-secondary" href={`/project/${project.id}`}>
          Back to builder
        </Link>
      </div>

      <section className="panel space-y-4 p-5">
        <h2 className="font-semibold">Project metadata</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Status</p>
            <p className="text-sm">{project.status}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Slug</p>
            <p className="text-sm">{project.slug}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Created</p>
            <p className="text-sm">{new Date(project.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Last edited</p>
            <p className="text-sm">{new Date(project.updatedAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Live URL</p>
            {project.deployedUrl ? (
              <Link className="text-sm underline" href={project.deployedUrl} target="_blank" rel="noreferrer">
                {project.deployedUrl}
              </Link>
            ) : (
              <p className="text-sm text-neutral-500">Not published yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="font-semibold">Uploaded assets</h2>
        {!project.assets.length ? (
          <p className="text-sm text-neutral-600">No assets yet. Upload from inside the builder.</p>
        ) : (
          <div className="space-y-2">
            {project.assets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{asset.originalName}</p>
                  <p className="text-xs text-neutral-500">{asset.fileType}</p>
                </div>
                <Link className="btn-secondary" href={asset.fileUrl} target="_blank" rel="noreferrer">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel space-y-3 border-red-200 p-5">
        <h2 className="font-semibold text-red-700">Danger zone</h2>
        <p className="text-sm text-neutral-600">Permanently remove this project and all saved content.</p>
        <DeleteProjectButton projectId={project.id} projectName={project.name} />
      </section>
    </main>
  );
}
