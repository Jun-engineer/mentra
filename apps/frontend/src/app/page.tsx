'use client';

import Image from "next/image";
import Link from "next/link";
import { PLACEHOLDER_ITEM_ID } from "@/app/items/[itemId]/constants";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import type { MenuCategory, MenuItem, MenuOrdering } from "@/data/menu";
import { groupMenuItems } from "@/data/menu";
import { TEMPLATE_MENU } from "@/data/menu-templates";
import { deleteMenuItem, fetchMenuState, fetchTrainingPlaylist, updateMenuOrdering, upsertMenuItem } from "@/lib/menu-service";
import type { UpsertMenuInput } from "@/lib/menu-service";
import { appConfig } from "@/lib/config";
import { useAuth } from "@/providers/auth-provider";

type ModalState = {
  open: boolean;
  mode: "create" | "edit";
  item?: MenuItem;
  initialValues?: Partial<FormValues>;
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

type DragDataCategory = {
  type: "category";
  categoryId: string;
};

type DragDataSubcategory = {
  type: "subcategory";
  categoryId: string;
  subcategoryId: string;
};

type DragDataSubcategoryContainer = {
  type: "subcategory-container";
  categoryId: string;
  subcategoryId: string;
};

type DragDataItem = {
  type: "item";
  categoryId: string;
  subcategoryId: string;
  itemId: string;
};
type DragData = DragDataCategory | DragDataSubcategory | DragDataSubcategoryContainer | DragDataItem;

const orderingKeyFor = (categoryId: string, subcategoryId: string) => `${categoryId}::${subcategoryId}`;

const cloneOrdering = (ordering: MenuOrdering): MenuOrdering => ({
  categoryOrder: [...ordering.categoryOrder],
  subcategoryOrder: Object.fromEntries(
    Object.entries(ordering.subcategoryOrder).map(([key, list]) => [key, [...list]])
  ),
  itemOrder: Object.fromEntries(Object.entries(ordering.itemOrder).map(([key, list]) => [key, [...list]]))
});

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

type CategoryPanelProps = {
  category: MenuCategory;
  isOpen: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  children: React.ReactNode;
};

const CategoryPanel = ({ category, isOpen, onToggle, isAdmin, children }: CategoryPanelProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `category:${category.id}`,
    data: {
      type: "category",
      categoryId: category.id
    } satisfies DragDataCategory,
    disabled: !isAdmin
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <article ref={setNodeRef} style={style} className="pb-2">
      <div className="flex items-start gap-3">
        {isAdmin ? (
          <button
            type="button"
            aria-label={`Reorder ${category.label}`}
            className="mt-1 flex h-9 w-9 cursor-grab items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:text-neutral-700 focus:text-neutral-700 focus:outline-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripIcon className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="group flex flex-1 items-center justify-between gap-3 border-b border-blue-300 pb-2 text-left"
          aria-expanded={isOpen}
          aria-controls={`${category.id}-panel`}
        >
          <h3 className="text-xl font-semibold text-neutral-900">
            <span className="border-b-2 border-transparent pb-1 transition group-hover:border-blue-400">
              {category.label}
            </span>
          </h3>
          <span className="text-2xl leading-none text-blue-500" aria-hidden="true">
            {isOpen ? "−" : "+"}
          </span>
        </button>
      </div>
      {isOpen ? children : null}
    </article>
  );
};

type SubcategoryPanelProps = {
  categoryId: string;
  subcategory: MenuCategory["subCategories"][number];
  isOpen: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  children: React.ReactNode;
};

const SubcategoryPanel = ({ categoryId, subcategory, isOpen, onToggle, isAdmin, children }: SubcategoryPanelProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `subcategory:${categoryId}:${subcategory.id}`,
    data: {
      type: "subcategory",
      categoryId,
      subcategoryId: subcategory.id
    } satisfies DragDataSubcategory,
    disabled: !isAdmin
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <section ref={setNodeRef} style={style} className="pl-2">
      <div className="flex items-start gap-2">
        {isAdmin ? (
          <button
            type="button"
            aria-label={`Reorder ${subcategory.label}`}
            className="mt-1 flex h-8 w-8 cursor-grab items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:text-neutral-700 focus:text-neutral-700 focus:outline-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripIcon className="h-3 w-3" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="group flex flex-1 items-center justify-between gap-2 border-b border-neutral-200 pb-2 text-left"
          aria-expanded={isOpen}
          aria-controls={`${categoryId}-${subcategory.id}-panel`}
        >
          <span className="text-base font-medium text-neutral-800">{subcategory.label}</span>
          <span className="text-xl leading-none text-blue-500" aria-hidden="true">
            {isOpen ? "−" : "+"}
          </span>
        </button>
      </div>
      {isOpen ? children : null}
    </section>
  );
};

type SubcategoryDropZoneProps = {
  categoryId: string;
  subcategoryId: string;
  children: React.ReactNode;
};

const SubcategoryDropZone = ({ categoryId, subcategoryId, children }: SubcategoryDropZoneProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `dropzone:${categoryId}:${subcategoryId}`,
    data: {
      type: "subcategory-container",
      categoryId,
      subcategoryId
    } satisfies DragDataSubcategoryContainer
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-2 space-y-1 rounded-lg ${isOver ? "border border-dashed border-blue-400 bg-blue-50/60 p-2" : ""}`}
    >
      {children}
    </div>
  );
};

type MenuItemRowProps = {
  item: MenuItem;
  categoryId: string;
  subcategoryId: string;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const MenuItemRow = ({ item, categoryId, subcategoryId, isAdmin, onEdit, onDelete }: MenuItemRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item:${item.id}`,
    data: {
      type: "item",
      categoryId,
      subcategoryId,
      itemId: item.id
    } satisfies DragDataItem,
    disabled: !isAdmin
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
      className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2"
    >
      {isAdmin ? (
        <button
          type="button"
          aria-label={`Reorder ${item.title}`}
          className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:text-neutral-700 focus:text-neutral-700 focus:outline-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripIcon className="h-3 w-3" />
        </button>
      ) : null}
      <Link
        href={`/items/${PLACEHOLDER_ITEM_ID}?id=${encodeURIComponent(item.id)}`}
        className="flex-1 text-sm font-medium text-neutral-800 hover:underline"
        prefetch={false}
      >
        {item.title}
      </Link>
      {isAdmin ? (
        <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 transition hover:bg-blue-100"
            aria-label={`Edit ${item.title}`}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
            aria-label={`Delete ${item.title}`}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </li>
  );
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

const MenuIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
    <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
  </svg>
);

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
      <h2 className="text-xl font-semibold text-neutral-900">Create new training card</h2>
      <p className="mt-2 text-sm text-neutral-600">Start from a Mentra template or build a custom entry from scratch.</p>
      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={onSelectTemplate}
          className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-medium text-blue-600 transition hover:border-blue-300 hover:bg-blue-100"
        >
          Use template
          <span className="mt-1 block text-xs font-normal text-blue-700">Pick from Food, Drink, or Training playbooks.</span>
        </button>
        <button
          type="button"
          onClick={onSelectCustom}
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
        >
          Customize
          <span className="mt-1 block text-xs font-normal text-neutral-600">Open a blank form and fill everything manually.</span>
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

const TemplateSeedModal = ({
  creating,
  onCreate,
  onClose
}: {
  creating: boolean;
  onCreate: () => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
    <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl sm:p-8 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Seed sample training library</h2>
          <p className="mt-1 text-sm text-neutral-600">
            We’ll create every category, subcategory, and example card shown below so you can explore the full experience immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={creating ? undefined : onClose}
          disabled={creating}
          className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
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
                  <ul className="mt-2 space-y-1 text-sm text-neutral-600">
                    {sub.items.map(item => (
                      <li key={item.id}>
                        <span className="font-medium text-neutral-800">{item.title}</span>
                        <span className="text-neutral-500"> — {item.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={creating ? undefined : onClose}
          disabled={creating}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {creating ? "Creating…" : "Create sample content"}
        </button>
      </div>
    </div>
  </div>
);

const FloatingAddButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-3xl font-semibold text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300"
    aria-label="Add menu item"
  >
    +
  </button>
);

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
      subcategory: values.subcategory.trim() || undefined,
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
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/30 px-4 py-8">
      <div className="relative w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:px-8 max-h-[90vh]">
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
              <span>Subcategory <span className="text-xs text-neutral-400">(optional for Training)</span></span>
              <input
                type="text"
                value={values.subcategory}
                onChange={handleChange("subcategory")}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-neutral-700">
              <span>Video URL</span>
              <input
                type="url"
                value={values.videoUrl}
                onChange={handleChange("videoUrl")}
                placeholder="https://..."
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
              onClick={onCancel}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
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
  const [createFlowStep, setCreateFlowStep] = useState<"idle" | "choice" | "template">("idle");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ordering, setOrdering] = useState<MenuOrdering | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderingSaving, setOrderingSaving] = useState(false);
  const [templateCreating, setTemplateCreating] = useState(false);
  const [trainingPlaylist, setTrainingPlaylist] = useState<MenuItem[]>([]);
  const [trainingCompletion, setTrainingCompletion] = useState<Record<string, boolean>>({});
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingPlaylistHydrated, setTrainingPlaylistHydrated] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = user?.role === "admin";
  const tenantId = appConfig.tenantId ?? "default";
  const trainingStorageKey = useMemo(() => {
    const userId = user?.id ?? "guest";
    return `mentra:training-progress:${tenantId}:${userId}`;
  }, [tenantId, user?.id]);

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

  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const state = await fetchMenuState();
      setMenuItems(state.items);
      setOrdering(state.ordering);
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
      void loadMenu();
      void loadTrainingPlaylist();
    }
    if (!user) {
      setMenuItems([]);
      setTrainingPlaylist([]);
      setTrainingCompletion({});
      setTrainingError(null);
      setTrainingLoading(false);
      setTrainingPlaylistHydrated(false);
    }
  }, [loading, user, loadMenu, loadTrainingPlaylist]);

  const readTrainingCompletion = useCallback(() => {
    if (!user) {
      setTrainingCompletion({});
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
    if (!user) {
      setTrainingCompletion({});
      return;
    }
    readTrainingCompletion();
  }, [user, trainingStorageKey, readTrainingCompletion]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const handleProgressChange = (event: Event) => {
      const customEvent = event as CustomEvent<TrainingProgressEventDetail | undefined>;
      const detailKey = customEvent.detail?.key;
      if (detailKey && detailKey !== trainingStorageKey) {
        return;
      }
      readTrainingCompletion();
    };
    const handlePageShow = () => {
      readTrainingCompletion();
    };
    window.addEventListener("mentra:training-progress-change", handleProgressChange as EventListener);
    window.addEventListener("pageshow", handlePageShow as EventListener);
    return () => {
      window.removeEventListener("mentra:training-progress-change", handleProgressChange as EventListener);
      window.removeEventListener("pageshow", handlePageShow as EventListener);
    };
  }, [user, trainingStorageKey, readTrainingCompletion]);

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

  useEffect(() => {
    if (!user) {
      setUserMenuOpen(false);
    }
  }, [user]);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) {
        return;
      }
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSubCategory = (categoryId: string, subCategoryId: string) => {
    const key = `${categoryId}-${subCategoryId}`;
    setOpenSubCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupedCategories: MenuCategory[] = useMemo(() => {
    return groupMenuItems(menuItems, ordering ?? undefined);
  }, [menuItems, ordering]);

  const categoryLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of groupedCategories) {
      map.set(category.id, category.label);
    }
    return map;
  }, [groupedCategories]);

  const subcategoryLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of groupedCategories) {
      for (const sub of category.subCategories) {
        map.set(orderingKeyFor(category.id, sub.id), sub.label);
      }
    }
    return map;
  }, [groupedCategories]);

  const trainingCompletedCount = useMemo(() => {
    return trainingPlaylist.reduce((count, item) => (trainingCompletion[item.id] ? count + 1 : count), 0);
  }, [trainingPlaylist, trainingCompletion]);

  const trainingProgressPercent = useMemo(() => {
    if (!trainingPlaylist.length) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round((trainingCompletedCount / trainingPlaylist.length) * 100)));
  }, [trainingCompletedCount, trainingPlaylist]);

  const closeModal = () => {
    setModalState({ open: false, mode: "create", item: undefined, initialValues: undefined });
    setCreateFlowStep("idle");
  };

  const handleCreateClick = () => {
    setCreateFlowStep("choice");
  };

  const handleCreateCustom = () => {
    setModalState({ open: true, mode: "create", initialValues: undefined });
    setCreateFlowStep("idle");
  };

  const handleCreateWithTemplate = () => {
    setCreateFlowStep("template");
  };

  const handleTemplateCreate = () => {
    if (templateCreating) {
      return;
    }

    setTemplateCreating(true);
    void (async () => {
      try {
        const orderingPayload: MenuOrdering = {
          categoryOrder: [],
          subcategoryOrder: {},
          itemOrder: {}
        };

        const operations: Promise<unknown>[] = [];

        for (const category of TEMPLATE_MENU) {
          if (!orderingPayload.categoryOrder.includes(category.id)) {
            orderingPayload.categoryOrder.push(category.id);
          }

          orderingPayload.subcategoryOrder[category.id] = category.subcategories.map(sub => sub.id);

          for (const sub of category.subcategories) {
            const key = `${category.id}::${sub.id}`;
            orderingPayload.itemOrder[key] = sub.items.map(item => item.id);

            for (const item of sub.items) {
              operations.push(
                upsertMenuItem({
                  itemId: item.id,
                  title: item.title,
                  category: category.label,
                  subcategory: sub.label,
                  description: item.description,
                  videoUrl: item.videoUrl,
                  steps: item.steps
                })
              );
            }
          }
        }

        await Promise.all(operations);
        await updateMenuOrdering(orderingPayload);
        setStatusMessage("Sample content created");
        setCreateFlowStep("idle");
        setOrdering(orderingPayload);
        await loadMenu();
        await loadTrainingPlaylist();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create sample menu";
        setStatusMessage(message);
      } finally {
        setTemplateCreating(false);
      }
    })();
  };

  const handleTemplateFlowClose = () => {
    setCreateFlowStep("idle");
  };

  const persistOrdering = useCallback(
    async (nextOrdering: MenuOrdering) => {
      setOrdering(nextOrdering);

      if (!isAdmin) {
        return;
      }

      setOrderingSaving(true);
      try {
        await updateMenuOrdering(nextOrdering);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update ordering";
        setStatusMessage(message);
        await loadMenu();
      } finally {
        setOrderingSaving(false);
      }
    },
    [isAdmin, loadMenu]
  );
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!isAdmin) {
        return;
      }

      if (!ordering) {
        return;
      }

      const { active, over } = event;
      if (!active || !over) {
        return;
      }

      const activeData = active.data.current as DragData | undefined;
      const overData = over.data.current as DragData | undefined;

      if (!activeData) {
        return;
      }

      if (activeData.type === "category") {
        if (!overData || overData.type !== "category") {
          return;
        }
        if (activeData.categoryId === overData.categoryId) {
          return;
        }
        const fromIndex = ordering.categoryOrder.indexOf(activeData.categoryId);
        const toIndex = ordering.categoryOrder.indexOf(overData.categoryId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
          return;
        }
        const nextOrdering = cloneOrdering(ordering);
        nextOrdering.categoryOrder = arrayMove(ordering.categoryOrder, fromIndex, toIndex);
        void persistOrdering(nextOrdering);
        return;
      }

      if (activeData.type === "subcategory") {
        if (!overData || (overData.type !== "subcategory" && overData.type !== "subcategory-container")) {
          return;
        }
        if (overData.categoryId !== activeData.categoryId) {
          return;
        }
        const currentList = ordering.subcategoryOrder[activeData.categoryId] ?? [];
        const fromIndex = currentList.indexOf(activeData.subcategoryId);
        if (fromIndex < 0) {
          return;
        }

        const toIndex = overData.type === "subcategory"
          ? currentList.indexOf(overData.subcategoryId)
          : currentList.length - 1;

        if (toIndex < 0 || fromIndex === toIndex) {
          return;
        }

        const nextOrdering = cloneOrdering(ordering);
        nextOrdering.subcategoryOrder[activeData.categoryId] = arrayMove(currentList, fromIndex, toIndex);
        void persistOrdering(nextOrdering);
        return;
      }

      if (activeData.type === "item") {
        if (
          !overData ||
          (overData.type !== "item" && overData.type !== "subcategory" && overData.type !== "subcategory-container")
        ) {
          return;
        }

        const sourceKey = orderingKeyFor(activeData.categoryId, activeData.subcategoryId);
        const sourceList = ordering.itemOrder[sourceKey] ?? [];
        const fromIndex = sourceList.indexOf(activeData.itemId);
        if (fromIndex < 0) {
          return;
        }

        const targetCategoryId = overData.categoryId;
        const targetSubcategoryId = overData.subcategoryId;
        const targetKey = orderingKeyFor(targetCategoryId, targetSubcategoryId);
        const targetList = ordering.itemOrder[targetKey] ?? [];

        let toIndex = targetList.length;
        if (overData.type === "item") {
          const found = targetList.indexOf(overData.itemId);
          toIndex = found >= 0 ? found : targetList.length;
        }

        const nextOrdering = cloneOrdering(ordering);

        if (sourceKey === targetKey) {
          const boundedIndex = Math.min(Math.max(toIndex, 0), sourceList.length - 1);
          nextOrdering.itemOrder[sourceKey] = arrayMove(sourceList, fromIndex, boundedIndex);
          void persistOrdering(nextOrdering);
          return;
        }

        const updatedSource = [...sourceList];
        updatedSource.splice(fromIndex, 1);
        nextOrdering.itemOrder[sourceKey] = updatedSource;

        const updatedTarget = [...targetList];
        const insertIndex = Math.min(Math.max(toIndex, 0), updatedTarget.length);
        updatedTarget.splice(insertIndex, 0, activeData.itemId);
        nextOrdering.itemOrder[targetKey] = updatedTarget;

        const targetCategoryLabel = categoryLabelById.get(targetCategoryId) ?? targetCategoryId;
        const targetSubcategoryLabel = subcategoryLabelById.get(targetKey) ?? targetCategoryLabel;

        setMenuItems(prev =>
          prev.map(item =>
            item.id === activeData.itemId
              ? {
                  ...item,
                  category: targetCategoryLabel,
                  subcategory: targetSubcategoryLabel
                }
              : item
          )
        );

        void (async () => {
          const movedItem = menuItems.find(item => item.id === activeData.itemId);
          if (!movedItem) {
            return;
          }
          try {
            await upsertMenuItem({
              itemId: movedItem.id,
              title: movedItem.title,
              category: targetCategoryLabel,
              subcategory: targetSubcategoryLabel,
              description: movedItem.description ?? undefined,
              videoUrl: movedItem.videoUrl ?? undefined,
              steps: movedItem.steps
            });
            setStatusMessage(`Moved “${movedItem.title}” to ${targetCategoryLabel} • ${targetSubcategoryLabel}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to move item";
            setStatusMessage(message);
            await loadMenu();
          }
        })();

        void persistOrdering(nextOrdering);
      }
    },
    [categoryLabelById, isAdmin, loadMenu, menuItems, ordering, persistOrdering, subcategoryLabelById]
  );
  const handleEditClick = (item: MenuItem) => {
    setCreateFlowStep("idle");
    setModalState({ open: true, mode: "edit", item, initialValues: undefined });
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
      await loadTrainingPlaylist();
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
      await loadTrainingPlaylist();
    } finally {
      setSaving(false);
    }
  };

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
              <span className="hidden sm:inline text-neutral-500">{user.name}</span>
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(prev => !prev)}
                  aria-label={userMenuOpen ? "Hide menu" : "Show menu"}
                  aria-expanded={userMenuOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <MenuIcon className="h-4 w-4" />
                </button>
                {userMenuOpen ? (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl">
                    {isAdmin ? (
                      <>
                        <Link
                          href="/manage/training"
                          onClick={() => setUserMenuOpen(false)}
                          className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Training Management
                        </Link>
                        <Link
                          href="/manage/menus"
                          onClick={() => setUserMenuOpen(false)}
                          className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Menu Management
                        </Link>
                        <Link
                          href="/manage/users"
                          onClick={() => setUserMenuOpen(false)}
                          className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                        >
                          User Management
                        </Link>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
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
            <p className="text-sm text-neutral-600">Sign in with one of the demo accounts to browse the menu or manage content.</p>
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-neutral-900">Training Library</h2>
                  {orderingSaving ? <p className="mt-1 text-xs text-neutral-500">Syncing order…</p> : null}
                </div>
                {statusMessage ? <p className="text-sm text-blue-600">{statusMessage}</p> : null}
              </div>

              {menuError ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{menuError}</p> : null}

              <div className="rounded-3xl border border-blue-200 bg-blue-50/60 p-6">
                <Link href="/training" className="inline-flex items-center gap-2 text-xl font-semibold text-neutral-900 transition hover:text-blue-600">
                  Training Menu
                </Link>
                <div className="mt-4 space-y-3">
                  {trainingError ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{trainingError}</p>
                  ) : null}
                  {trainingLoading ? (
                    <div className="flex h-16 items-center justify-center text-sm text-neutral-600">Loading training menu…</div>
                  ) : null}
                  {!trainingLoading && trainingPlaylist.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-neutral-600">
                        <span>{trainingCompletedCount} of {trainingPlaylist.length} completed</span>
                        <span>{trainingProgressPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${trainingProgressPercent}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {!trainingLoading && !trainingError && trainingPlaylist.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-blue-200 bg-white px-4 py-4 text-sm text-neutral-600">
                      {isAdmin
                        ? "No training menu items yet. Visit the training menu page to add cards."
                        : "Your training menu is empty right now. Check back soon."}
                    </p>
                  ) : null}
                </div>
              </div>

              {menuLoading ? (
                <div className="flex min-h-[20vh] items-center justify-center text-neutral-500">Loading menu…</div>
              ) : null}

              {!menuLoading && groupedCategories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-6 text-center text-sm text-blue-700">
                  No menu items yet. {isAdmin ? "Use the + button to add the first training card." : "Please contact your administrator for access."}
                </div>
              ) : null}

              <div className="flex flex-col gap-6">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={groupedCategories.map(category => `category:${category.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {groupedCategories.map(category => {
                      const isCategoryOpen = Boolean(openCategories[category.id]);
                      const subcategoryItems = category.subCategories.map(
                        subCategory => `subcategory:${category.id}:${subCategory.id}`
                      );

                      return (
                        <CategoryPanel
                          key={category.id}
                          category={category}
                          isOpen={isCategoryOpen}
                          onToggle={() => toggleCategory(category.id)}
                          isAdmin={isAdmin}
                        >
                          <SortableContext
                            items={subcategoryItems}
                            strategy={verticalListSortingStrategy}
                          >
                            <div id={`${category.id}-panel`} className="mt-3 space-y-2">
                              {category.subCategories.map(subCategory => {
                                const key = `${category.id}-${subCategory.id}`;
                                const isSubOpen = Boolean(openSubCategories[key]);

                                return (
                                  <SubcategoryPanel
                                    key={subCategory.id}
                                    categoryId={category.id}
                                    subcategory={subCategory}
                                    isOpen={isSubOpen}
                                    onToggle={() => toggleSubCategory(category.id, subCategory.id)}
                                    isAdmin={isAdmin}
                                  >
                                    <SubcategoryDropZone
                                      categoryId={category.id}
                                      subcategoryId={subCategory.id}
                                    >
                                      <SortableContext
                                        items={subCategory.items.map(item => `item:${item.id}`)}
                                        strategy={verticalListSortingStrategy}
                                      >
                                        <ul id={`${key}-panel`} className="space-y-1">
                                          {subCategory.items.map(item => (
                                            <MenuItemRow
                                              key={item.id}
                                              item={item}
                                              categoryId={category.id}
                                              subcategoryId={subCategory.id}
                                              isAdmin={isAdmin}
                                              onEdit={() => handleEditClick(item)}
                                              onDelete={() => handleDeleteClick(item)}
                                            />
                                          ))}
                                        </ul>
                                      </SortableContext>
                                      {subCategory.items.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                                          Drop items here
                                        </div>
                                      ) : null}
                                    </SubcategoryDropZone>
                                  </SubcategoryPanel>
                                );
                              })}
                            </div>
                          </SortableContext>
                        </CategoryPanel>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>
            </section>

            
          </>
        ) : null}
      </main>

      {isAdmin && createFlowStep === "choice" ? (
        <CreateChoiceModal
          onSelectTemplate={handleCreateWithTemplate}
          onSelectCustom={handleCreateCustom}
          onClose={handleTemplateFlowClose}
        />
      ) : null}

      {isAdmin && createFlowStep === "template" ? (
        <TemplateSeedModal
          creating={templateCreating}
          onCreate={handleTemplateCreate}
          onClose={handleTemplateFlowClose}
        />
      ) : null}

      {isAdmin && modalState.open ? (
        <MenuItemForm
          key={modalState.item?.id ?? `new-${modalState.initialValues?.category ?? "blank"}`}
          mode={modalState.mode}
          item={modalState.item}
          initialValues={modalState.initialValues}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          saving={saving}
        />
      ) : null}

      {isAdmin ? <FloatingAddButton onClick={handleCreateClick} /> : null}
    </div>
  );
}
