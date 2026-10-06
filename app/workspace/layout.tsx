import Link from "next/link";
import {
  OrganizationSwitcher,
  UserButton,
} from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ThemeControl } from "@/app/workspace/theme-control";

export default async function WorkspaceLayout({
  children,
}: LayoutProps<"/workspace">) {
  await auth.protect();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex min-h-14 items-center justify-between gap-4 border-b bg-surface px-4">
        <Link href="/workspace" className="font-mono text-sm font-semibold">
          cartograph
        </Link>
        <div className="flex items-center gap-3">
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/workspace"
            afterSelectOrganizationUrl="/workspace"
            afterLeaveOrganizationUrl="/workspace"
          />
          <ThemeControl />
          <UserButton />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4">
        {children}
      </main>
    </div>
  );
}
