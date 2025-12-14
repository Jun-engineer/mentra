'use client';

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MenuItem } from "@/data/menu";
import { groupMenuItems } from "@/data/menu";
import { fetchMenuState, fetchTrainingPlaylist, updateTrainingPlaylist } from "@/lib/menu-service";
import { PLACEHOLDER_ITEM_ID } from "@/app/items/[itemId]/constants";
import { appConfig } from "@/lib/config";
import { useAuth } from "@/providers/auth-provider";

const GripIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className} focusable="false">
    <circle cx="6" cy="6" r="1.5" fill="currentColor" />
    <circle cx="6" cy="10" r="1.5" fill="currentColor" />
    <circle cx="6" cy="14" r="1.5" fill="currentColor" />
    <circle cx="12" cy="6" r="1.5" fill="currentColor" />
    <circle cx="12" cy="10" r="1.5" fill="currentColor" />
    <circle cx="12" cy="14" r="1.5" fill="currentColor" />
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

type TrainingProgressEventDetail = {
  key: string;
};

const notifyTrainingProgressChange = (storageKey: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<TrainingProgressEventDetail>("mentra:training-progress-change", {
    detail: { key: storageKey }
  }));
};

type DragDataTraining = {
  type: "training";
  itemId: string;
};

type TrainingItemRowProps = {
  item: MenuItem;
  isAdmin: boolean;
  isCompleted: boolean;
  onToggleComplete: () => void;
  onRemove: () => void;
  disabled?: boolean;
};

const TrainingItemRow = ({ item, isAdmin, isCompleted, onToggleComplete, onRemove, disabled = false }: TrainingItemRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `training:${item.id}`,
    data: {
      type: "training",
      itemId: item.id
    } satisfies DragDataTraining,
    disabled: !isAdmin || disabled
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 transition ${isCompleted ? "opacity-60" : ""}`}
    >
      {isAdmin ? (
        <button
          type="button"
          aria-label={`Reorder ${item.title}`}
          className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:text-neutral-700 focus:text-neutral-700 focus:outline-none active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripIcon className="h-3 w-3" />
        </button>
      ) : null}
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={onToggleComplete}
        className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-400"
      />
      <Link
        href={`/items/${PLACEHOLDER_ITEM_ID}?id=${encodeURIComponent(item.id)}`}
        className={`flex-1 text-sm font-medium transition hover:underline ${isCompleted ? "line-through text-neutral-500" : "text-neutral-800"}`}
        prefetch={false}
      >
        {item.title}
      </Link>
      {isAdmin ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Remove ${item.title} from training menu`}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      ) : null}
    </li>
  );
};

type TrainingManageModalProps = {
  items: MenuItem[];
  selectedIds: string[];
  saving: boolean;
  onSave: (itemIds: string[]) => void;
  onClose: () => void;
};

const TrainingManageModal = ({ items, selectedIds, saving, onSave, onClose }: TrainingManageModalProps) => {
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string[]>(selectedIds);

  useEffect(() => {
    setSelection(selectedIds);
  }, [selectedIds]);

  const grouped = useMemo(() => groupMenuItems(items), [items]);
  const searchValue = search.trim().toLowerCase();
  const selectedSet = useMemo(() => new Set(selection), [selection]);

  const toggleSelection = (itemId: string) => {
    setSelection(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const handleSave = () => {
    onSave(selection);
  };

  const matchesSearch = (item: MenuItem, categoryLabel: string, subcategoryLabel: string) => {
    if (!searchValue) {
      return true;
    }
    const haystack = `${item.title} ${categoryLabel} ${subcategoryLabel}`.toLowerCase();
    return haystack.includes(searchValue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl sm:p-8 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Manage training menu</h2>
            <p className="mt-1 text-sm text-neutral-600">Select which menu items appear in the training menu. New selections are added to the end of the list.</p>
          </div>
          <button
            type="button"
            onClick={saving ? undefined : onClose}
            disabled={saving}
            className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by item, category, or subcategory"
              className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <span className="text-sm text-neutral-500">
              {selection.length} selected
            </span>
          </div>

          <div className="space-y-4">
            {grouped.map(category => (
              <div key={category.id} className="rounded-xl border border-neutral-200">
                <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-neutral-800">{category.label}</h3>
                </header>
                <div className="space-y-3 p-4">
                  {category.subCategories.map(subcategory => {
                    const visibleItems = subcategory.items.filter(item => matchesSearch(item, category.label, subcategory.label));
                    if (!visibleItems.length) {
                      return null;
                    }
                    return (
                      <div key={subcategory.id} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{subcategory.label}</p>
                        <div className="space-y-2">
                          {visibleItems.map(item => {
                            const isSelected = selectedSet.has(item.id);
                            return (
                              <label
                                key={item.id}
                                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition ${isSelected ? "border-blue-300 bg-blue-50" : "border-neutral-200"}`}
                              >
                                <span className={`font-medium ${isSelected ? "text-blue-700" : "text-neutral-800"}`}>{item.title}</span>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelection(item.id)}
                                  disabled={saving}
                                  className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-400"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            onClick={saving ? undefined : onClose}
            disabled={saving}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saving ? undefined : handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function TrainingPageClient() {
  const { user, loading, logout } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [trainingPlaylist, setTrainingPlaylist] = useState<MenuItem[]>([]);
  const [trainingCompletion, setTrainingCompletion] = useState<Record<string, boolean>>({});
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingPlaylistHydrated, setTrainingPlaylistHydrated] = useState(false);
  const [trainingManageOpen, setTrainingManageOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const trainingStorageKey = useMemo(() => {
    const tenant = appConfig.tenantId ?? "default";
    const userId = user?.id ?? "guest";
    return `mentra:training-progress:${tenant}:${userId}`;
  }, [user?.id]);

  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const state = await fetchMenuState();
      setMenuItems(state.items);
      setMenuError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load menu";
      setMenuError(message);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const loadTrainingPlaylist = useCallback(async () => {
    if (!user) {
      return;
    }
    setTrainingLoading(true);
    try {
      const state = await fetchTrainingPlaylist();
      setTrainingPlaylist(state.items);
      setTrainingError(null);
      setTrainingPlaylistHydrated(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load training menu";
      setTrainingError(message);
    } finally {
      setTrainingLoading(false);
    }
  }, [user]);

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
      void loadTrainingPlaylist();
      if (isAdmin) {
        void loadMenu();
      } else {
        setMenuItems([]);
      }
    }
    if (!user) {
      setMenuItems([]);
      setTrainingPlaylist([]);
      setTrainingCompletion({});
      setTrainingError(null);
      setTrainingLoading(false);
      setTrainingSaving(false);
      setTrainingManageOpen(false);
      setTrainingPlaylistHydrated(false);
    }
  }, [loading, user, isAdmin, loadMenu, loadTrainingPlaylist]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(trainingStorageKey);
      if (!stored) {
        setTrainingCompletion({});
        return;
      }
      const parsed = JSON.parse(stored) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== "object") {
        setTrainingCompletion({});
        return;
      }
      const next: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "boolean") {
          next[key] = value;
        }
      }
      setTrainingCompletion(next);
    } catch (storageError) {
      console.warn("Failed to load training progress", storageError);
      setTrainingCompletion({});
    }
  }, [user, trainingStorageKey]);

  useEffect(() => {
    if (!trainingPlaylistHydrated) {
      return;
    }
    setTrainingCompletion(prev => {
      const validIds = new Set(trainingPlaylist.map(item => item.id));
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [id, value] of Object.entries(prev)) {
        if (validIds.has(id)) {
          next[id] = value;
        } else {
          changed = true;
        }
      }
      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(trainingStorageKey, JSON.stringify(next));
          notifyTrainingProgressChange(trainingStorageKey);
        } catch (storageError) {
          console.warn("Failed to persist training progress", storageError);
        }
      }
      return next;
    });
  }, [trainingPlaylistHydrated, trainingPlaylist, trainingStorageKey]);

  const menuItemsById = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const item of menuItems) {
      map.set(item.id, item);
    }
    return map;
  }, [menuItems]);

  const trainingCompletedCount = useMemo(() => {
    return trainingPlaylist.reduce((count, item) => (trainingCompletion[item.id] ? count + 1 : count), 0);
  }, [trainingPlaylist, trainingCompletion]);

  const trainingProgressPercent = useMemo(() => {
    if (!trainingPlaylist.length) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round((trainingCompletedCount / trainingPlaylist.length) * 100)));
  }, [trainingCompletedCount, trainingPlaylist]);

  const trainingSelectedIds = useMemo(() => trainingPlaylist.map(item => item.id), [trainingPlaylist]);

  const syncTrainingMenu = useCallback(
    async (nextItems: MenuItem[], successMessage?: string) => {
      if (!isAdmin) {
        return true;
      }

      setTrainingSaving(true);
      try {
        await updateTrainingPlaylist(nextItems.map(item => item.id));
        setTrainingError(null);
        if (successMessage) {
          setStatusMessage(successMessage);
        }
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update training menu";
        const lowercase = message.toLowerCase();
        const isNetworkError = error instanceof TypeError || lowercase.includes("failed to fetch") || lowercase.includes("network");
        if (isNetworkError) {
          const friendlyMessage = "Could not reach Mentra API. Changes are saved locally for now.";
          setTrainingError(friendlyMessage);
          setStatusMessage("Training menu saved locally. We'll sync when the connection returns.");
        } else {
          setTrainingError(message);
          setStatusMessage(message);
          await loadTrainingPlaylist();
        }
        return false;
      } finally {
        setTrainingSaving(false);
      }
    },
    [isAdmin, loadTrainingPlaylist]
  );

  const handleTrainingDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!isAdmin || trainingSaving) {
        return;
      }

      const { active, over } = event;
      if (!active || !over) {
        return;
      }

      const activeData = active.data.current as DragDataTraining | undefined;
      const overData = over.data.current as DragDataTraining | undefined;

      if (!activeData || activeData.type !== "training") {
        return;
      }

      if (!overData || overData.type !== "training") {
        return;
      }

      if (activeData.itemId === overData.itemId) {
        return;
      }

      setTrainingPlaylist(prev => {
        const fromIndex = prev.findIndex(item => item.id === activeData.itemId);
        const toIndex = prev.findIndex(item => item.id === overData.itemId);

        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
          return prev;
        }

        const next = arrayMove(prev, fromIndex, toIndex);
        void syncTrainingMenu(next);
        return next;
      });
    },
    [isAdmin, trainingSaving, syncTrainingMenu]
  );

  const handleTrainingRemove = useCallback(
    (itemId: string) => {
      if (!isAdmin || trainingSaving) {
        return;
      }

      setTrainingPlaylist(prev => {
        const next = prev.filter(item => item.id !== itemId);
        if (next.length === prev.length) {
          return prev;
        }
        void syncTrainingMenu(next, "Training menu updated");
        return next;
      });
    },
    [isAdmin, trainingSaving, syncTrainingMenu]
  );

  const handleTrainingToggleComplete = useCallback(
    (itemId: string) => {
      setTrainingCompletion(prev => {
        const next = { ...prev };
        if (next[itemId]) {
          delete next[itemId];
        } else {
          next[itemId] = true;
        }
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(trainingStorageKey, JSON.stringify(next));
            notifyTrainingProgressChange(trainingStorageKey);
          } catch (storageError) {
            console.warn("Failed to persist training progress", storageError);
          }
        }
        return next;
      });
    },
    [trainingStorageKey]
  );

  const handleTrainingManageSave = useCallback(
    async (nextIds: string[]) => {
      if (!isAdmin || trainingSaving) {
        return;
      }

      const nextItems = nextIds
        .map(id => menuItemsById.get(id))
        .filter((value): value is MenuItem => Boolean(value));

      const currentIds = trainingSelectedIds;
      const unchanged = nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index]);
      setTrainingManageOpen(false);
      if (unchanged) {
        return;
      }

      setTrainingPlaylist(nextItems);
      const success = await syncTrainingMenu(nextItems, "Training menu updated");
      if (!success) {
        return;
      }
    },
    [isAdmin, menuItemsById, syncTrainingMenu, trainingSaving, trainingSelectedIds]
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/icons/mentra-icon-64.png" alt="Mentra" width={40} height={40} className="h-10 w-10" priority />
            <span className="text-2xl font-semibold text-neutral-900">Mentra Manual</span>
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
              className="rounded-full border border-blue-300 px-4 py-1 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
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
          <section className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border border-blue-200/70 bg-blue-50/60 p-8 text-center">
            <h1 className="text-3xl font-semibold text-neutral-900">Welcome to Mentra</h1>
            <p className="text-sm text-neutral-600">Sign in with one of the demo accounts to browse the training menu.</p>
            <Link
              href="/login"
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Go to login
            </Link>
          </section>
        ) : null}

        {!loading && user ? (
          <>
            <section className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-neutral-900">Training Menu</h1>
                  <p className="text-sm text-neutral-600">Reorder items, manage the list, and track completion progress.</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <Link href="/" className="text-sm font-medium text-blue-600 transition hover:text-blue-700">
                    ← Back to training library
                  </Link>
                  {statusMessage ? <p className="text-sm text-blue-600">{statusMessage}</p> : null}
                </div>
              </div>

              {trainingError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{trainingError}</p>
              ) : null}

              {trainingLoading ? (
                <div className="flex h-20 items-center justify-center text-sm text-neutral-600">Loading training menu…</div>
              ) : null}

              {!trainingLoading && trainingPlaylist.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                    <div className="flex items-center justify-between text-xs font-medium text-neutral-600">
                      <span>{trainingCompletedCount} of {trainingPlaylist.length} completed</span>
                      <span>{trainingProgressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${trainingProgressPercent}%` }} />
                    </div>
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTrainingDragEnd}>
                    <SortableContext
                      items={trainingPlaylist.map(item => `training:${item.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-2">
                        {trainingPlaylist.map(item => (
                          <TrainingItemRow
                            key={item.id}
                            item={item}
                            isAdmin={isAdmin}
                            isCompleted={Boolean(trainingCompletion[item.id])}
                            onToggleComplete={() => handleTrainingToggleComplete(item.id)}
                            onRemove={() => handleTrainingRemove(item.id)}
                            disabled={trainingSaving}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </div>
              ) : null}

              {!trainingLoading && trainingPlaylist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-6 text-sm text-neutral-700">
                  {isAdmin
                    ? "No items in the training menu yet. Use the Manage training menu button to add cards."
                    : "Your training menu is empty right now. Check back soon."}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {menuError ? <p className="text-sm text-red-600">{menuError}</p> : null}
                {isAdmin ? (
                  <div className="flex items-center gap-3">
                    {trainingSaving ? <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">Syncing…</span> : null}
                    <button
                      type="button"
                      onClick={() => setTrainingManageOpen(true)}
                      disabled={trainingLoading || trainingSaving || menuLoading}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Manage training menu
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </main>

      {isAdmin && trainingManageOpen ? (
        <TrainingManageModal
          items={menuItems}
          selectedIds={trainingSelectedIds}
          saving={trainingSaving}
          onSave={handleTrainingManageSave}
          onClose={() => setTrainingManageOpen(false)}
        />
      ) : null}
    </div>
  );
}
