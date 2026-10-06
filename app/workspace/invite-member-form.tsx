"use client";

import { useActionState } from "react";
import {
  inviteOrganizationMember,
  type InviteResult,
} from "@/app/workspace/actions";

const initialState: InviteResult = { status: "idle", message: "" };

export function InviteMemberForm() {
  const [state, formAction, isPending] = useActionState(
    inviteOrganizationMember,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="invite-email" className="text-sm font-medium">
        Invite a teammate
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="invite-email"
          name="emailAddress"
          type="email"
          autoComplete="email"
          required
          placeholder="teammate@example.com"
          className="min-h-9 w-64 rounded border bg-surface px-3 text-sm text-foreground placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={isPending}
          className="min-h-9 rounded bg-accent px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Sending…" : "Send invite"}
        </button>
      </div>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="text-xs text-muted"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
