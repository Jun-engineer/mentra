import { appConfig } from "@/lib/config";
import type { MenuItem, MenuOrdering } from "@/data/menu";

export type UpsertMenuInput = {
  itemId?: string;
  title: string;
  category: string;
  subcategory?: string;
  description?: string;
  videoUrl?: string;
  steps?: string[];
};

export type MenuState = {
  items: MenuItem[];
  ordering: MenuOrdering;
};

export type TrainingPlaylistState = {
  itemIds: string[];
  items: MenuItem[];
};

type ApiMenuItem = {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  subcategory?: unknown;
  description?: unknown;
  videoUrl?: unknown;
  steps?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
};

type FetchConfig = {
  cache?: RequestInit["cache"];
  signal?: AbortSignal;
};

const defaultOrdering: MenuOrdering = {
  categoryOrder: [],
  subcategoryOrder: {},
  itemOrder: {}
};

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  return null;
};

const ensureString = (value: unknown, fallback: string): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

const asTrimmedStringOrEmpty = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const resolveApiBaseUrl = (): string => {
  if (appConfig.apiBaseUrl) {
    return appConfig.apiBaseUrl;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  throw new Error("Mentra API base URL is not configured.");
};

const buildUrl = (path: string) => {
  const base = resolveApiBaseUrl();
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalisedPath}`;
};

const normalizeItem = (item: ApiMenuItem): MenuItem => {
  const idValue = ensureString(item.id, "").trim();
  if (!idValue) {
    throw new Error("Mentra API returned an item without an id");
  }

  const steps = Array.isArray(item.steps)
    ? item.steps.map(step => ensureString(step, "")).filter(step => step.length > 0)
    : [];

  const category = ensureString(item.category, "Uncategorized");
  const subcategoryInput = asTrimmedStringOrEmpty(item.subcategory);
  const subcategory = subcategoryInput || category || "General";

  return {
    id: idValue,
    title: ensureString(item.title, "Untitled Item"),
    category,
    subcategory,
    description: asStringOrNull(item.description),
    videoUrl: asStringOrNull(item.videoUrl),
    steps,
    updatedAt: asStringOrNull(item.updatedAt),
    createdAt: asStringOrNull(item.createdAt)
  };
};

const normalizeOrdering = (value: unknown): MenuOrdering => {
  if (!value || typeof value !== "object") {
    return { ...defaultOrdering };
  }

  const categoryOrder = Array.isArray((value as { categoryOrder?: unknown }).categoryOrder)
    ? ((value as { categoryOrder: unknown[] }).categoryOrder.filter(entry => typeof entry === "string") as string[])
    : [];

  const rawSubcategories = (value as { subcategoryOrder?: unknown }).subcategoryOrder;
  const subcategoryOrder: Record<string, string[]> = {};
  if (rawSubcategories && typeof rawSubcategories === "object") {
    for (const [key, entries] of Object.entries(rawSubcategories as Record<string, unknown>)) {
      if (Array.isArray(entries)) {
        subcategoryOrder[key] = entries.filter(entry => typeof entry === "string") as string[];
      }
    }
  }

  const rawItemOrder = (value as { itemOrder?: unknown }).itemOrder;
  const itemOrder: Record<string, string[]> = {};
  if (rawItemOrder && typeof rawItemOrder === "object") {
    for (const [key, entries] of Object.entries(rawItemOrder as Record<string, unknown>)) {
      if (Array.isArray(entries)) {
        itemOrder[key] = entries.filter(entry => typeof entry === "string") as string[];
      }
    }
  }

  return {
    categoryOrder,
    subcategoryOrder,
    itemOrder
  };
};

export const fetchMenuState = async (config: FetchConfig = {}): Promise<MenuState> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}`), {
    cache: config.cache ?? "no-store",
    signal: config.signal
  });

  if (!response.ok) {
    throw new Error(`Failed to load menu items (${response.status})`);
  }

  const data = (await response.json()) as { items?: unknown; ordering?: unknown };
  const items = Array.isArray(data.items) ? data.items : [];
  const ordering = normalizeOrdering(data.ordering);

  return {
    items: items.map(entry => normalizeItem(entry)),
    ordering
  };
};

export const fetchMenuItem = async (itemId: string, config: FetchConfig = {}): Promise<MenuItem | null> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}/${itemId}`), {
    cache: config.cache ?? "no-store",
    signal: config.signal
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load menu item (${response.status})`);
  }

  const data = (await response.json()) as { item?: unknown };
  if (!data.item) {
    return null;
  }

  return normalizeItem(data.item);
};

export const fetchTrainingPlaylist = async (config: FetchConfig = {}): Promise<TrainingPlaylistState> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}/training`), {
    cache: config.cache ?? "no-store",
    signal: config.signal
  });

  if (response.status === 404) {
    return {
      itemIds: [],
      items: []
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to load training playlist (${response.status})`);
  }

  const data = (await response.json()) as { itemIds?: unknown; items?: unknown };
  const itemIds = Array.isArray(data.itemIds)
    ? (data.itemIds.filter(entry => typeof entry === "string") as string[])
    : [];
  const items = Array.isArray(data.items) ? data.items : [];
  const normalisedItems = items.map(entry => normalizeItem(entry as ApiMenuItem));

  const validIds = itemIds.filter(id => normalisedItems.some(item => item.id === id));

  return {
    itemIds: validIds,
    items: validIds.map(id => normalisedItems.find(item => item.id === id)!).filter(Boolean)
  };
};

export const updateTrainingPlaylist = async (itemIds: string[]): Promise<void> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}/training`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ itemIds })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to update training playlist (status ${response.status})`);
  }
};

export const upsertMenuItem = async (payload: UpsertMenuInput): Promise<MenuItem> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to save menu item");
  }

  const data = (await response.json()) as { item?: unknown };
  if (!data.item) {
    throw new Error("Unexpected response shape from Mentra API");
  }

  return normalizeItem(data.item);
};

export const deleteMenuItem = async (itemId: string): Promise<void> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}/${itemId}`), {
    method: "DELETE"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to delete menu item (status ${response.status})`);
  }
};

export const updateMenuOrdering = async (ordering: MenuOrdering): Promise<void> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}/ordering`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(ordering)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to update menu ordering (status ${response.status})`);
  }
};
