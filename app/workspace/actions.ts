"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

export type InviteResult = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function inviteOrganizationMember(
  _previousState: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  const { userId, orgId, has } = await auth.protect();

  if (!orgId) {
    return { status: "error", message: "Select an organization first." };
  }
  if (!has({ role: "org:admin" })) {
    return {
      status: "error",
      message: "You do not have permission to invite members.",
    };
  }

  const emailValue = formData.get("emailAddress");
  if (typeof emailValue !== "string") {
    return { status: "error", message: "Enter a valid email address." };
  }

  const emailAddress = emailValue.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  try {
    const clerk = await clerkClient();
    await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      inviterUserId: userId,
      emailAddress,
      role: "org:member",
      redirectUrl: "/sign-in",
    });
  } catch {
    return {
      status: "error",
      message: "Clerk could not send the invitation. Try again.",
    };
  }

  return { status: "success", message: `Invitation sent to ${emailAddress}.` };
}
