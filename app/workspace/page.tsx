import { auth } from "@clerk/nextjs/server";
import { InviteMemberForm } from "@/app/workspace/invite-member-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Analysis = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  created_at: string;
  projects:
    | { name: string; repository_url: string }
    | { name: string; repository_url: string }[]
    | null;
};

const statusLabels: Record<Analysis["status"], string> = {
  queued: "Queued",
  running: "In progress",
  completed: "Complete",
  failed: "Failed",
};

const statusStyles: Record<Analysis["status"], string> = {
  queued: "bg-surface text-muted",
  running: "bg-accent/10 text-accent",
  completed: "bg-emerald-500/10 text-status-success",
  failed: "bg-rose-500/10 text-status-failed",
};

function getProject(analysis: Analysis) {
  return Array.isArray(analysis.projects)
    ? analysis.projects[0]
    : analysis.projects;
}

export default async function WorkspacePage() {
  const { orgId, orgSlug } = await auth.protect();
  const supabase = await createSupabaseServerClient();
  const [analysesResult, activeResult] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, status, created_at, projects(name, repository_url)", {
        count: "exact",
      })
      .order("created_at", { ascending: false }),
    supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "running"]),
  ]);
  const error = analysesResult.error ?? activeResult.error;

  if (error) {
    console.error("Failed to load the organization analyses:", error);
  }

  const analyses = (analysesResult.data ?? []) as Analysis[];
  const totalCount = analysesResult.count ?? 0;
  const activeCount = activeResult.count ?? 0;
  const organizationLabel = orgSlug ?? orgId ?? "Current organization";
  const supabaseProject = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
    .split(".")[0];

  return (
    <section className="flex flex-col gap-8 py-2">
      <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
            Workspace / {organizationLabel}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Analyses
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Repository maps created by your team, in one place.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-72">
          <div className="rounded-lg border bg-surface p-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Total analyses
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {error ? "—" : totalCount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-surface p-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
              In progress
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {error ? "—" : activeCount.toLocaleString()}
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-lg border bg-surface p-5">
          <h2 className="font-medium">Could not load analyses</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {error.code === "PGRST205"
              ? "The dashboard tables are missing from Supabase. Apply the migration at supabase/migrations/20261006120000_dashboard_schema.sql, then reload this page."
              : "Supabase rejected the analyses request. Use the error details below to identify the Clerk or Supabase configuration that needs attention."}
          </p>
          <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-xs leading-5 text-muted">
            {`${error.code ?? "UNKNOWN"}: ${error.message}`}
          </pre>
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-lg border bg-surface px-6 py-16 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full border font-mono text-sm text-muted">
            0
          </div>
          <h2 className="mt-4 text-base font-medium">No analyses visible</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            No analysis rows are visible to this organization. Check that the
            rows are in this Supabase project and use this Clerk organization
            ID.
          </p>
          <dl className="mx-auto mt-5 grid w-fit gap-2 text-left text-xs sm:grid-cols-[max-content_max-content]">
            <dt className="text-muted">Supabase project</dt>
            <dd className="font-mono">{supabaseProject}</dd>
            <dt className="text-muted">Clerk organization ID</dt>
            <dd className="font-mono">{orgId ?? "No active organization"}</dd>
          </dl>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_max-content] gap-4 border-b bg-background/60 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted sm:grid-cols-[minmax(0,1fr)_8rem_12rem]">
            <span>Repository</span>
            <span>Status</span>
            <span className="hidden sm:block">Started</span>
          </div>
          <ul>
            {analyses.map((analysis) => {
              const project = getProject(analysis);

              return (
                <li
                  key={analysis.id}
                  className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-4 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8rem_12rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {project?.name ?? "Unknown repository"}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-muted">
                      {project?.repository_url ?? "Project unavailable"}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[analysis.status]}`}
                  >
                    {statusLabels[analysis.status] ?? analysis.status}
                  </span>
                  <time
                    className="hidden text-sm text-muted sm:block"
                    dateTime={analysis.created_at}
                  >
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(analysis.created_at))}
                  </time>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <section className="border-t pt-5" aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="text-sm font-medium">
          Team access
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Invite a teammate to share this organization’s analyses.
        </p>
        <InviteMemberForm />
      </section>
    </section>
  );
}
