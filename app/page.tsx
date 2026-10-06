import Link from "next/link";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6">
      <header className="flex h-14 items-center justify-between border-b">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
          Cartograph
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded px-3 py-1.5 text-sm text-muted hover:bg-surface">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/workspace"
              className="rounded px-3 py-1.5 text-sm text-muted hover:bg-surface"
            >
              Open workspace
            </Link>
            <UserButton />
          </Show>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-4 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
          Codebase maps from real imports
        </p>
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          See how a codebase fits together.
        </h1>
        <p className="max-w-lg text-sm leading-6 text-muted">
          Cartograph traces the files and imports in a public TypeScript or
          JavaScript repository, then lays out the structure for your team.
        </p>
      </section>
    </main>
  );
}
