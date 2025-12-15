'use client';

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MenuItem } from "@/data/menu";
import { fetchTrainingPlaylist, updateTrainingPlaylist, upsertMenuItem, type UpsertMenuInput } from "@/lib/menu-service";
import { useAuth } from "@/providers/auth-provider";

const buildEmptyForm = (): FormValues => ({
  title: "",
  category: "Training",
  subcategory: "",
  description: "",
  videoUrl: "",
  steps: ""
});

type FormValues = {
  title: string;
  category: string;
  subcategory: string;
  description: string;
  videoUrl: string;
  steps: string;
};

type FormState = {
  open: boolean;
  mode: "create" | "edit";
  item?: MenuItem;
};

type StatusState = {
  type: "success" | "error";
  message: string;
};

export default function TrainingManagementPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [trainingIds, setTrainingIds] = useState<string[]>([]);
  const [trainingItems, setTrainingItems] = useState<MenuItem[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(true);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({ open: false, mode: "create" });
  const [formValues, setFormValues] = useState<FormValues>(buildEmptyForm);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) {
      setMenuOpen(false);
    }
  }, [user]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!status) {
      return;
    }
    const timeout = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const loadTraining = useCallback(async () => {
    setTrainingLoading(true);
    try {
      const state = await fetchTrainingPlaylist();
      setTrainingIds(state.itemIds);
      setTrainingItems(state.items);
      setTrainingError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load training playlist.";
      setTrainingError(message);
    } finally {
      setTrainingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      void loadTraining();
    }
  }, [loading, user, isAdmin, loadTraining]);

  const orderedTraining = useMemo(() => {
    const lookup = new Map(trainingItems.map(item => [item.id, item]));
    return trainingIds.map(id => lookup.get(id)).filter(Boolean) as MenuItem[];
  }, [trainingIds, trainingItems]);

  const openCreateForm = () => {
    setFormState({ open: true, mode: "create" });
    setFormValues(buildEmptyForm());
    setFormError(null);
  };

  const openEditForm = (item: MenuItem) => {
    setFormState({ open: true, mode: "edit", item });
    setFormValues({
      title: item.title ?? "",
      category: item.category ?? "Training",
      subcategory: item.subcategory ?? "",
      description: item.description ?? "",
      videoUrl: item.videoUrl ?? "",
      steps: (item.steps ?? []).join("\n")
    });
    setFormError(null);
  };

  const closeForm = () => {
    setFormState({ open: false, mode: "create" });
    setFormValues(buildEmptyForm());
    setFormError(null);
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = formValues.title.trim();
    if (!title) {
      setFormError("Title is required.");
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const steps = formValues.steps
        .split(/\r?\n/)
        .map(step => step.trim())
        .filter(step => step.length > 0);

      const payload: UpsertMenuInput = {
        itemId: formState.mode === "edit" ? formState.item?.id : undefined,
        title,
        category: formValues.category.trim() || "Training",
        subcategory: formValues.subcategory.trim() || undefined,
        description: formValues.description.trim() || undefined,
        videoUrl: formValues.videoUrl.trim() || undefined,
        steps
      };

      const saved = await upsertMenuItem(payload);

      if (formState.mode === "create") {
        const nextIds = Array.from(new Set([...trainingIds, saved.id]));
        await updateTrainingPlaylist(nextIds);
        setStatus({ type: "success", message: `Created ${saved.title}.` });
      } else {
        setStatus({ type: "success", message: `Updated ${saved.title}.` });
      }

      await loadTraining();
      closeForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save training.";
      setFormError(message);
    } finally {
      setFormSaving(false);
    }
  };

  if (loading || (user && !isAdmin && trainingLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-neutral-500">
        Loading…
      </div>
    );
  }

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-neutral-500">
        Redirecting…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/icons/mentra-icon-64.png" alt="Mentra" width={40} height={40} className="h-10 w-10" priority />
              <span className="text-2xl font-semibold text-neutral-900">Mentra Manual</span>
            </Link>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(prev => !prev)}
                aria-label={menuOpen ? "Hide menu" : "Show menu"}
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <MenuIcon className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16 text-center text-neutral-700 sm:px-6">
          <h1 className="text-3xl font-semibold text-neutral-900">Administrator access required</h1>
          <p className="text-sm">You need admin privileges to manage training content.</p>
          <Link href="/" className="inline-flex justify-center rounded-full border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50">
            ← Back to training library
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/icons/mentra-icon-64.png" alt="Mentra" width={40} height={40} className="h-10 w-10" priority />
            <span className="text-2xl font-semibold text-neutral-900">Mentra Manual</span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-neutral-600">
            <span className="hidden sm:inline text-neutral-500">{user?.name}</span>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(prev => !prev)}
                aria-label={menuOpen ? "Hide menu" : "Show menu"}
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <MenuIcon className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl">
                  <Link
                    href="/manage/training"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Training Management
                  </Link>
                  <Link
                    href="/manage/menus"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Menu Management
                  </Link>
                  <Link
                    href="/manage/users"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    User Management
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-3">
          <Link href="/" className="text-sm font-medium text-blue-600 transition hover:text-blue-700">
            ← Back to training library
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900">Training Management</h1>
          <p className="text-sm text-neutral-600">Create new training modules or refine existing entries that appear in the Training Menu.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-neutral-500">
            {orderedTraining.length} training item{orderedTraining.length === 1 ? "" : "s"}
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            + Create training
          </button>
        </div>

        {status ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${status.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-600"}`}>
            {status.message}
          </div>
        ) : null}

        {trainingLoading ? (
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
            Loading training modules…
          </div>
        ) : trainingError ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
            {trainingError}
          </div>
        ) : orderedTraining.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
            No training modules yet. Create the first training to get started.
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {orderedTraining.map(item => (
              <li key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ""}</p>
                    <h2 className="text-lg font-semibold text-neutral-900">{item.title}</h2>
                    {item.description ? (
                      <p className="text-sm text-neutral-600">{item.description}</p>
                    ) : null}
                    {item.videoUrl ? (
                      <p className="text-xs text-blue-600">
                        <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          View training video ↗
                        </a>
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditForm(item)}
                    className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Edit
                  </button>
                </div>
                {item.steps && item.steps.length ? (
                  <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-neutral-700">
                    {item.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {formState.open ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">
                    {formState.mode === "create" ? "Create training" : `Edit ${formState.item?.title ?? "training"}`}
                  </h2>
                  <p className="text-sm text-neutral-600">Fill in the details that appear in the Training Menu.</p>
                </div>
                <button
                  type="button"
                  onClick={formSaving ? undefined : closeForm}
                  disabled={formSaving}
                  className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
                >
                  Close
                </button>
              </div>

              <form className="mt-4 space-y-4" onSubmit={handleFormSubmit}>
                <label className="block text-sm font-medium text-neutral-700">
                  Title
                  <input
                    type="text"
                    value={formValues.title}
                    onChange={event => setFormValues(prev => ({ ...prev, title: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Category
                  <input
                    type="text"
                    value={formValues.category}
                    onChange={event => setFormValues(prev => ({ ...prev, category: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Training"
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Subcategory
                  <input
                    type="text"
                    value={formValues.subcategory}
                    onChange={event => setFormValues(prev => ({ ...prev, subcategory: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="General"
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Description
                  <textarea
                    value={formValues.description}
                    onChange={event => setFormValues(prev => ({ ...prev, description: event.target.value }))}
                    className="mt-1 h-24 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Optional summary for the training module"
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Video URL
                  <input
                    type="url"
                    value={formValues.videoUrl}
                    onChange={event => setFormValues(prev => ({ ...prev, videoUrl: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="https://"
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Steps (one per line)
                  <textarea
                    value={formValues.steps}
                    onChange={event => setFormValues(prev => ({ ...prev, steps: event.target.value }))}
                    className="mt-1 h-32 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Outline the actions team members should take"
                  />
                </label>
                {formError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {formError}
                  </div>
                ) : null}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={formSaving ? undefined : closeForm}
                    disabled={formSaving}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSaving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {formSaving ? "Saving…" : formState.mode === "create" ? "Create training" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

const MenuIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
    <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
  </svg>
);
