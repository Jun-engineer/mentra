import Link from "next/link";
import { ManualSchema } from "@mentra/shared";

const previewManual = ManualSchema.parse({
  manualId: "MANUAL#seed",
  tenantId: "TENANT#demo",
  title: "Welcome to Mentra",
  content: "Use this workspace to create your first manual and share it with your team.",
  status: "draft",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 bg-gradient-to-br from-slate-900 to-neutral-800 text-white">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16 sm:px-12">
        <header className="flex flex-col gap-4">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Mentra</p>
          <h1 className="text-4xl font-semibold sm:text-5xl">Restaurant Training Ops, Simplified.</h1>
          <p className="max-w-2xl text-base text-neutral-300 sm:text-lg">
            Kick off your first iteration by onboarding a tenant, inviting team members, and drafting
            manuals your staff can trust from day one.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/app/dashboard"
              className="rounded-full bg-amber-300 px-6 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-amber-200"
            >
              Open dashboard prototype
            </Link>
            <Link
              href="/docs/roadmap"
              className="rounded-full border border-neutral-700 px-6 py-2 text-sm font-semibold text-neutral-100 transition hover:border-neutral-500"
            >
              Review development plan
            </Link>
          </div>
        </header>

        <section className="grid gap-6 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-8 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Manual Preview
            </p>
            <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium uppercase text-neutral-300">
              {previewManual.status}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-white">{previewManual.title}</h2>
          <p className="text-neutral-300">{previewManual.content}</p>
          <dl className="grid grid-cols-1 gap-2 text-sm text-neutral-500 sm:grid-cols-3">
            <div>
              <dt className="uppercase tracking-wide">Manual ID</dt>
              <dd className="text-neutral-300">{previewManual.manualId}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Tenant</dt>
              <dd className="text-neutral-300">{previewManual.tenantId}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Updated</dt>
              <dd className="text-neutral-300">
                {new Date(previewManual.updatedAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}
              </dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
            <h3 className="text-lg font-semibold text-white">Tenant Foundation</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Secure Cognito onboarding with tenant-aware claims and DynamoDB single-table design.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
            <h3 className="text-lg font-semibold text-white">Manager Invitations</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Generate SES-backed invites so managers can step in and build training flows fast.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
            <h3 className="text-lg font-semibold text-white">Manual Builder</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Author text-first manuals today, expand to video and assignments in upcoming sprints.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
