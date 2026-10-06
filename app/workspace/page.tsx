import { auth } from "@clerk/nextjs/server";
import { InviteMemberForm } from "@/app/workspace/invite-member-form";

export default async function WorkspacePage() {
  const { orgId, orgSlug } = await auth.protect();
  const activeOrganization = orgSlug ?? orgId;

  return (
    <section className="flex flex-col gap-2">
      <p className="font-mono text-xs uppercase tracking-wide text-muted">
        Workspace
      </p>
      <h1 className="text-lg font-semibold">Your organization</h1>
      <p className="text-sm text-muted">
        Active organization from the signed-in session:
      </p>
      <output className="w-fit rounded border bg-surface px-3 py-2 font-mono text-sm">
        {activeOrganization ?? "No active organization"}
      </output>
      <div className="mt-6 w-fit border-t pt-4">
        <InviteMemberForm />
      </div>
    </section>
  );
}
