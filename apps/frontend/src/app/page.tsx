'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { MenuCategory, MenuItem } from "@/data/menu";
import { groupMenuItems } from "@/data/menu";
import { deleteMenuItem, fetchMenuItems, upsertMenuItem } from "@/lib/menu-service";
import type { UpsertMenuInput } from "@/lib/menu-service";
import { useAuth } from "@/providers/auth-provider";

type ModalState = {
  open: boolean;
  mode: "create" | "edit";
  item?: MenuItem;
};

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

const PencilIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    focusable="false"
  >
    <path
      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"
      fill="currentColor"
    />
    <path
      d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      fill="currentColor"
    />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
    <path
      d="M6 7h12l-1 14H7L6 7zm5 2v10h2V9h-2zm5.5-5-1-1h-7l-1 1H5v2h14V4h-2.5z"
      fill="currentColor"
    />
  </svg>
);

const FloatingAddButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-3xl font-semibold text-white shadow-lg transition hover:bg-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-300"
    aria-label="Add menu item"
  >
    +
  </button>
);

const MenuItemForm = ({
  mode,
  item,
  onSubmit,
  onCancel,
  saving
}: {
  mode: "create" | "edit";
  item?: MenuItem;
  onSubmit: (values: UpsertMenuInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) => {
  const [values, setValues] = useState<FormValues>(() => buildFormValues(item));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const steps = values.steps
      .split("\n")
      .map(step => step.trim())
      .filter(Boolean);

    const payload: UpsertMenuInput = {
      itemId: item?.id,
      title: values.title.trim(),
      category: values.category.trim(),
      subcategory: values.subcategory.trim(),
      description: values.description.trim() || undefined,
      videoUrl: values.videoUrl.trim() || undefined,
      steps
    };

    try {
      await onSubmit(payload);
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "Failed to save menu item";
      setError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-8">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-semibold text-neutral-900">
          {mode === "create" ? "Add Menu Item" : "Edit Menu Item"}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">Provide at least a description or a video URL.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Title</span>
              <input
                required
                type="text"
                value={values.title}
                onChange={handleChange("title")}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Category</span>
              <input
                required
                type="text"
                value={values.category}
                onChange={handleChange("category")}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Subcategory</span>
              <input
                required
                type="text"
                value={values.subcategory}
                onChange={handleChange("subcategory")}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Video URL</span>
              <input
                type="url"
                value={values.videoUrl}
                onChange={handleChange("videoUrl")}
                placeholder="https://..."
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm text-neutral-700">
            <span>Description</span>
            <textarea
              value={values.description}
              onChange={handleChange("description")}
              className="min-h-[90px] rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-neutral-700">
            <span>Steps (one per line)</span>
            <textarea
              value={values.steps}
              onChange={handleChange("steps")}
              className="min-h-[120px] rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : mode === "create" ? "Create" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openSubCategories, setOpenSubCategories] = useState<Record<string, boolean>>({});
  const [modalState, setModalState] = useState<ModalState>({ open: false, mode: "create" });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin";

  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const items = await fetchMenuItems();
      setMenuItems(items);
      setMenuError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load menu";
      setMenuError(message);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (statusMessage) {
      timeout = setTimeout(() => setStatusMessage(null), 4000);
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [statusMessage]);

  useEffect(() => {
    if (!loading && user) {
      void loadMenu();
    }
    if (!user) {
      setMenuItems([]);
    }
  }, [loading, user, loadMenu]);

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSubCategory = (categoryId: string, subCategoryId: string) => {
    const key = `${categoryId}-${subCategoryId}`;
    setOpenSubCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupedCategories: MenuCategory[] = useMemo(() => groupMenuItems(menuItems), [menuItems]);

  const closeModal = () => setModalState({ open: false, mode: "create" });

  const handleCreateClick = () => {
    setModalState({ open: true, mode: "create" });
  };

  const handleEditClick = (item: MenuItem) => {
    setModalState({ open: true, mode: "edit", item });
  };

  const handleDeleteClick = async (item: MenuItem) => {
    const confirmed = window.confirm(`Delete “${item.title}”?`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteMenuItem(item.id);
      setStatusMessage("Menu item deleted");
      await loadMenu();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete menu item";
      setStatusMessage(message);
    }
  };

  const handleSubmit = async (values: UpsertMenuInput) => {
    setSaving(true);
    try {
      await upsertMenuItem(values);
      setStatusMessage(values.itemId ? "Menu item updated" : "Menu item created");
      closeModal();
      await loadMenu();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-semibold text-neutral-900">
            Mentra Manual
          </Link>
          {user ? (
            <div className="flex items-center gap-3 text-sm text-neutral-600">
              <span>{user.name}</span>
              <span className="hidden sm:inline text-neutral-300">•</span>
              <span className="hidden sm:inline capitalize text-neutral-500">{user.role}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-amber-300 px-4 py-1 text-sm font-medium text-amber-600 transition hover:bg-amber-50"
            >
              Log in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-neutral-500">Checking access…</div>
        ) : null}

        {!loading && !user ? (
          <section className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border border-amber-200/70 bg-amber-50/60 p-8 text-center">
            <h1 className="text-3xl font-semibold text-neutral-900">Welcome to Mentra</h1>
            <p className="text-sm text-neutral-600">Sign in with one of the demo accounts to browse the menu or manage content.</p>
            <Link
              href="/login"
              className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Go to login
            </Link>
          </section>
        ) : null}

        {!loading && user ? (
          <>
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-neutral-900">Training Library</h2>
                  <p className="text-sm text-neutral-500">Browse categories to open the training cards.</p>
                </div>
                {statusMessage ? <p className="text-sm text-amber-600">{statusMessage}</p> : null}
              </div>

              {menuError ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{menuError}</p> : null}

              {menuLoading ? (
                <div className="flex min-h-[20vh] items-center justify-center text-neutral-500">Loading menu…</div>
              ) : null}

              {!menuLoading && groupedCategories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-6 text-center text-sm text-amber-700">
                  No menu items yet. {isAdmin ? "Use the + button to add the first training card." : "Please contact your administrator for access."}
                </div>
              ) : null}

              <div className="flex flex-col gap-6">
                {groupedCategories.map(category => {
                  const isCategoryOpen = Boolean(openCategories[category.id]);

                  return (
                    <article key={category.id} id={category.id} className="pb-2">
                      <button
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        className="group flex w-full items-center justify-between gap-3 border-b border-amber-300 pb-2 text-left"
                        aria-expanded={isCategoryOpen}
                        aria-controls={`${category.id}-panel`}
                      >
                        <h3 className="text-xl font-semibold text-neutral-900">
                          <span className="border-b-2 border-transparent pb-1 transition group-hover:border-amber-400">
                            {category.label}
                          </span>
                        </h3>
                        <span className="text-2xl leading-none text-amber-500" aria-hidden="true">
                          {isCategoryOpen ? "−" : "+"}
                        </span>
                      </button>

                      {isCategoryOpen && (
                        <div id={`${category.id}-panel`} className="mt-3 space-y-2">
                          {category.subCategories.map(subCategory => {
                            const key = `${category.id}-${subCategory.id}`;
                            const isSubOpen = Boolean(openSubCategories[key]);

                            return (
                              <section key={subCategory.id} className="pl-2">
                                <button
                                  type="button"
                                  onClick={() => toggleSubCategory(category.id, subCategory.id)}
                                  className="flex w-full items-center justify-between gap-2 border-b border-neutral-200 pb-2 text-left"
                                  aria-expanded={isSubOpen}
                                  aria-controls={`${key}-panel`}
                                >
                                  <span className="text-base font-medium text-neutral-800">{subCategory.label}</span>
                                  <span className="text-xl leading-none text-amber-500" aria-hidden="true">
                                    {isSubOpen ? "−" : "+"}
                                  </span>
                                </button>

                                {isSubOpen && (
                                  <ul id={`${key}-panel`} className="mt-2 space-y-1">
                                    {subCategory.items.map(item => (
                                      <li key={item.id} className="group flex items-center justify-between gap-3 border-b border-dashed border-neutral-200 py-2">
                                        <Link
                                          href={`/items/${item.id}`}
                                          className="flex-1 text-sm font-medium text-neutral-800 hover:underline"
                                        >
                                          {item.title}
                                        </Link>
                                        {isAdmin ? (
                                          <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                                            <button
                                              type="button"
                                              onClick={() => handleEditClick(item)}
                                              className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-white text-amber-600 transition hover:bg-amber-100"
                                              aria-label={`Edit ${item.title}`}
                                            >
                                              <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteClick(item)}
                                              className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                                              aria-label={`Delete ${item.title}`}
                                            >
                                              <TrashIcon className="h-4 w-4" />
                                            </button>
                                          </div>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-dashed border-amber-200 bg-amber-50/40 p-6 text-center text-sm text-amber-700">
              Choose a menu item to open its training card.
            </section>
          </>
        ) : null}
      </main>

      {isAdmin && modalState.open ? (
        <MenuItemForm
          key={modalState.item?.id ?? "new"}
          mode={modalState.mode}
          item={modalState.item}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          saving={saving}
        />
      ) : null}

      {isAdmin ? <FloatingAddButton onClick={handleCreateClick} /> : null}
    </div>
  );
}
