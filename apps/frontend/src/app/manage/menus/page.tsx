'use client';

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { MenuItem } from "@/data/menu";
import { groupMenuItems } from "@/data/menu";
import { TEMPLATE_MENU, type TemplateSeedItem } from "@/data/menu-templates";
import { deleteMenuItem, fetchMenuState, upsertMenuItem, type UpsertMenuInput } from "@/lib/menu-service";
import { useAuth } from "@/providers/auth-provider";

type FormValues = {
  title: string;
  category: string;
  subcategory: string;
  description: string;
  videoUrl: string;
  steps: string;
};

const defaultFormValues: FormValues = {
  title: "",
  category: "",
  subcategory: "",
  description: "",
  videoUrl: "",
  steps: ""
};

type ModalState = {
  open: boolean;
  mode: "create" | "edit";
  item?: MenuItem;
  initialValues?: Partial<FormValues>;
};

type StatusState = {
  type: "success" | "error";
  message: string;
};

const buildFormValues = (source?: MenuItem | null): FormValues => {
  if (!source) {
    return { ...defaultFormValues };
  }
  return {
    title: source.title,
    category: source.category,
    subcategory: source.subcategory,
    description: source.description ?? "",
    videoUrl: source.videoUrl ?? "",
    steps: (source.steps ?? []).join("\n")
  };
};

const buildTemplateValues = (categoryLabel: string, subcategoryLabel: string, template: TemplateSeedItem): Partial<FormValues> => ({
  title: template.title,
  category: categoryLabel,
  subcategory: subcategoryLabel,
  description: template.description,
  videoUrl: template.videoUrl ?? "",
  steps: template.steps.join("\n")
});

const MenuItemForm = ({
  mode,
  item,
  initialValues,
  onSubmit,
  onCancel,
  saving
}: {
  mode: "create" | "edit";
  item?: MenuItem;
  initialValues?: Partial<FormValues>;
  onSubmit: (values: UpsertMenuInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) => {
  const [values, setValues] = useState<FormValues>(() => ({ ...buildFormValues(item), ...initialValues }));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof FormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const steps = values.steps
      .split(/\r?\n/)
      .map(step => step.trim())
      .filter(step => step.length > 0);

    const payload: UpsertMenuInput = {
      itemId: item?.id,
      title: values.title.trim(),
      category: values.category.trim(),
      subcategory: values.subcategory.trim() || undefined,
      description: values.description.trim() || undefined,
      videoUrl: values.videoUrl.trim() || undefined,
      steps
    };

    if (!payload.title) {
      setError("Title is required.");
      return;
    }
    if (!payload.category) {
      setError("Category is required.");
      return;
    }
    if (!payload.description && !payload.videoUrl) {
      setError("Add a description or a video URL to help the team.");
      return;
    }

    try {
      await onSubmit(payload);
      setError(null);
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "Failed to save menu item.";
      setError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8 max-h-[90vh]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">
              {mode === "create" ? "Create menu item" : `Edit ${item?.title ?? "menu item"}`}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">Provide at least a description or a video URL.</p>
          </div>
          <button
            type="button"
            onClick={saving ? undefined : onCancel}
            disabled={saving}
            className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Title</span>
              <input
                required
                type="text"
                value={values.title}
                onChange={handleChange("title")}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Category</span>
              <input
                required
                type="text"
                value={values.category}
                onChange={handleChange("category")}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Subcategory</span>
              <input
                type="text"
                value={values.subcategory}
                onChange={handleChange("subcategory")}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Optional"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Video URL</span>
              <input
                type="url"
                value={values.videoUrl}
                onChange={handleChange("videoUrl")}
                placeholder="https://"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm text-neutral-700">
            <span>Description</span>
            <textarea
              value={values.description}
              onChange={handleChange("description")}
              className="min-h-[90px] rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-neutral-700">
            <span>Steps (one per line)</span>
            <textarea
              value={values.steps}
              onChange={handleChange("steps")}
              className="min-h-[120px] rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={saving ? undefined : onCancel}
              disabled={saving}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CreateChoiceModal = ({
  onSelectTemplate,
  onSelectCustom,
  onClose
}: {
  onSelectTemplate: () => void;
  onSelectCustom: () => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h2 className="text-xl font-semibold text-neutral-900">Create menu item</h2>
      <p className="mt-2 text-sm text-neutral-600">Start from a Mentra template or build a custom entry from scratch.</p>
      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={onSelectTemplate}
          className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-medium text-blue-600 transition hover:border-blue-300 hover:bg-blue-100"
        >
          Browse templates
          <span className="mt-1 block text-xs font-normal text-blue-700">Use pre-defined examples organised by category.</span>
        </button>
        <button
          type="button"
          onClick={onSelectCustom}
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
        >
          Start blank
          <span className="mt-1 block text-xs font-normal text-neutral-600">Open an empty form and fill everything manually.</span>
        </button>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

const TemplatePickerModal = ({
  onSelect,
  onClose
}: {
  onSelect: (categoryLabel: string, subcategoryLabel: string, item: TemplateSeedItem) => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
    <div className="w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8 max-h-[85vh]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Choose a template</h2>
          <p className="text-sm text-neutral-600">Pick any item to pre-fill a new menu entry. You can adjust all details before saving.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100"
        >
          Close
        </button>
      </div>
      <div className="mt-6 space-y-5">
        {TEMPLATE_MENU.map(category => (
          <section key={category.id} className="rounded-2xl border border-neutral-200 p-4">
            <h3 className="text-lg font-semibold text-neutral-900">{category.label}</h3>
            <div className="mt-3 space-y-3">
              {category.subcategories.map(sub => (
                <div key={sub.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <p className="text-sm font-medium text-neutral-800">{sub.label}</p>
                  <ul className="mt-2 space-y-2 text-sm text-neutral-600">
                    {sub.items.map(item => (
                      <li key={item.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-neutral-800">{item.title}</p>
                          <p className="text-xs text-neutral-500">{item.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelect(category.label, sub.label, item)}
                          className="whitespace-nowrap rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                        >
                          Use template
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  </div>
);

const MenuIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
    <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
  </svg>
);

const PencilIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
    <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
    <path d="M6 7h12l-1 14H7L6 7zm5 2v10h2V9h-2zm5.5-5-1-1h-7l-1 1H5v2h14V4h-2.5z" fill="currentColor" />
  </svg>
);

export default function MenuManagementPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ open: false, mode: "create" });
  const [saving, setSaving] = useState(false);
  const [createFlowStep, setCreateFlowStep] = useState<"idle" | "choice" | "template">("idle");

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

  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const state = await fetchMenuState();
      setMenuItems(state.items);
      setMenuError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load menu.";
      setMenuError(message);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      void loadMenu();
    }
  }, [loading, user, isAdmin, loadMenu]);

  const closeModal = () => {
    setModalState({ open: false, mode: "create", item: undefined, initialValues: undefined });
    setCreateFlowStep("idle");
  };

  const handleSave = async (values: UpsertMenuInput) => {
    setSaving(true);
    try {
      const saved = await upsertMenuItem(values);
      setStatus({ type: "success", message: values.itemId ? `Updated ${saved.title}.` : `Created ${saved.title}.` });
      closeModal();
      await loadMenu();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save menu item.";
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClick = () => {
    setCreateFlowStep("choice");
  };

  const handleCreateCustom = () => {
    setModalState({ open: true, mode: "create", initialValues: undefined });
    setCreateFlowStep("idle");
  };

  const handleTemplateSelect = (categoryLabel: string, subcategoryLabel: string, template: TemplateSeedItem) => {
    setModalState({
      open: true,
      mode: "create",
      initialValues: buildTemplateValues(categoryLabel, subcategoryLabel, template)
    });
    setCreateFlowStep("idle");
  };

  const handleEdit = (item: MenuItem) => {
    setModalState({ open: true, mode: "edit", item, initialValues: undefined });
    setCreateFlowStep("idle");
  };

  const handleDelete = async (item: MenuItem) => {
    const confirmed = typeof window === "undefined" ? false : window.confirm(`Delete “${item.title}”?`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteMenuItem(item.id);
      setStatus({ type: "success", message: `Deleted ${item.title}.` });
      await loadMenu();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete menu item.";
      setStatus({ type: "error", message });
    }
  };

  const groupedMenu = useMemo(() => groupMenuItems(menuItems), [menuItems]);

  if (loading || (user && !isAdmin && menuLoading)) {
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
          <p className="text-sm">You need admin privileges to manage menu content.</p>
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
          <h1 className="text-3xl font-bold text-neutral-900">Menu Management</h1>
          <p className="text-sm text-neutral-600">Create, edit, or remove menu items that power the Training Menu and the in-venue library.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-neutral-500">{menuItems.length} item{menuItems.length === 1 ? "" : "s"}</div>
          <button
            type="button"
            onClick={handleCreateClick}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            + New menu item
          </button>
        </div>

        {status ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${status.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-600"}`}>
            {status.message}
          </div>
        ) : null}

        {menuLoading ? (
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
            Loading menu items…
          </div>
        ) : menuError ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
            {menuError}
          </div>
        ) : groupedMenu.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
            No menu items yet. Use the button above to create your first entry.
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {groupedMenu.map(category => (
              <section key={category.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">{category.label}</h2>
                    <p className="text-xs text-neutral-500">{category.subCategories.reduce((total, sub) => total + sub.items.length, 0)} item(s)</p>
                  </div>
                </header>
                <div className="mt-4 space-y-4">
                  {category.subCategories.map(sub => (
                    <div key={sub.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{sub.label}</h3>
                        <span className="text-xs text-neutral-400">{sub.items.length} item{sub.items.length === 1 ? "" : "s"}</span>
                      </div>
                      <ul className="mt-3 space-y-3">
                        {sub.items.map(item => (
                          <li key={item.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                                {item.description ? <p className="text-sm text-neutral-600">{item.description}</p> : null}
                                {item.videoUrl ? (
                                  <p className="text-xs text-blue-600">
                                    <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                      View video ↗
                                    </a>
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 transition hover:bg-blue-50"
                                  aria-label={`Edit ${item.title}`}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item)}
                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                                  aria-label={`Delete ${item.title}`}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {item.steps && item.steps.length ? (
                              <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-neutral-700">
                                {item.steps.map((step, index) => (
                                  <li key={index}>{step}</li>
                                ))}
                              </ol>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {modalState.open ? (
          <MenuItemForm
            mode={modalState.mode}
            item={modalState.item}
            initialValues={modalState.initialValues}
            onSubmit={handleSave}
            onCancel={closeModal}
            saving={saving}
          />
        ) : null}

        {createFlowStep === "choice" ? (
          <CreateChoiceModal
            onSelectTemplate={() => setCreateFlowStep("template")}
            onSelectCustom={handleCreateCustom}
            onClose={() => setCreateFlowStep("idle")}
          />
        ) : null}

        {createFlowStep === "template" ? (
          <TemplatePickerModal
            onSelect={handleTemplateSelect}
            onClose={() => setCreateFlowStep("idle")}
          />
        ) : null}
      </main>
    </div>
  );
}
