import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listFallbackProjects } from "@/lib/fallback-store";
import { businessTypeLabel, goalLabel } from "@/lib/project-data";
import { CreateProjectModal } from "@/components/create-project-modal";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { DuplicateProjectButton } from "@/components/duplicate-project-button";
import { LogoutButton } from "@/components/logout-button";
import { ProjectStatus } from "@/lib/types";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";

function statusChip(status: ProjectStatus, hasUpdates: boolean) {
  if (status === ProjectStatus.LIVE && hasUpdates) return "Update available";
  if (status === ProjectStatus.LIVE) return "Live";
  if (status === ProjectStatus.PUBLISHING) return "Publishing";
  return "Draft";
}

function statusClass(status: ProjectStatus, hasUpdates: boolean) {
  if (status === ProjectStatus.LIVE && hasUpdates) return "border-amber-300 text-amber-700";
  if (status === ProjectStatus.LIVE) return "border-emerald-300 text-emerald-700";
  if (status === ProjectStatus.PUBLISHING) return "border-blue-300 text-blue-700";
  return "border-neutral-300 text-neutral-700";
}

export default async function DashboardPage() {
  const user = await requireUser();
  let dbUnavailable = false;
  let projects: Array<{
    id: string;
    name: string;
    businessType: string;
    websiteGoal: string;
    updatedAt: Date;
    deployedUrl: string | null;
    status: ProjectStatus;
    hasUnpublishedChanges: boolean;
  }> = [];

  try {
    const query = supabase
      .from("Project")
      .select("id, name, businessType, websiteGoal, updatedAt, deployedUrl, status, hasUnpublishedChanges")
      .eq("userId", user.id)
      .order("updatedAt", { ascending: false });
    const { data, error } = await withSupabaseTimeout(query);
    if (error) {
      throw error;
    }
    projects = (data ?? []).map((project: any) => ({
      ...project,
      updatedAt: new Date(project.updatedAt),
      status: project.status as ProjectStatus,
    }));
  } catch (error) {
    dbUnavailable = true;
    const fallback = await listFallbackProjects(user);
    projects = fallback.map((project: any) => ({
      id: project.id,
      name: project.name,
      businessType: project.businessType,
      websiteGoal: project.websiteGoal,
      updatedAt: project.updatedAt,
      deployedUrl: project.deployedUrl,
      status: project.status,
      hasUnpublishedChanges: project.hasUnpublishedChanges,
    }));
  }

  return (
    <main className="shell min-h-screen space-y-8">
      <header className="panel flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">PSC Website Creator</p>
          <h1 className="mt-2 font-display text-5xl uppercase leading-none md:text-6xl">Your Sites</h1>
          <p className="mt-3 text-sm text-neutral-600">
            Welcome back. Build, refine, and publish your premium beauty websites with PSC Agent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreateProjectModal />
          <LogoutButton />
        </div>
      </header>

      {dbUnavailable ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Database is temporarily unavailable. You are viewing your temporary session projects.
        </div>
      ) : null}

      <section className="panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-neutral-500">{projects.length} total</p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">No projects yet</p>
            <h3 className="mt-2 font-display text-4xl uppercase leading-none">Start your first PSC site</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600">
              Create a new project to begin your split-screen workflow with PSC Agent and live preview.
            </p>
            <div className="mt-6">
              <CreateProjectModal />
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <article key={project.id} className="rounded-2xl border border-border p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{project.name}</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      {businessTypeLabel(project.businessType)} • {goalLabel(project.websiteGoal)}
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Last edited {new Date(project.updatedAt).toLocaleString()}
                    </p>
                    {project.deployedUrl ? (
                      <a
                        href={project.deployedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold underline"
                      >
                        Open live site
                      </a>
                    ) : null}
                  </div>
                  <span className={`status-chip ${statusClass(project.status, project.hasUnpublishedChanges)}`}>
                    {statusChip(project.status, project.hasUnpublishedChanges)}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/project/${project.id}`} className="btn-primary">
                    Open project
                  </Link>
                  <Link href={`/project/${project.id}/versions`} className="btn-secondary">
                    Versions
                  </Link>
                  <Link href={`/project/${project.id}/settings`} className="btn-secondary">
                    Settings
                  </Link>
                  <DuplicateProjectButton projectId={project.id} />
                  <DeleteProjectButton projectId={project.id} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
