import { appConfig } from "@/lib/config";
import type { MenuItem } from "@/data/menu";

export type UpsertMenuInput = {
  itemId?: string;
  title: string;
  category: string;
  subcategory?: string;
  description?: string;
  videoUrl?: string;
  steps?: string[];
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

const buildUrl = (path: string) => {
  if (!appConfig.apiBaseUrl) {
    throw new Error("Mentra API base URL is not configured.");
  }
  return `${appConfig.apiBaseUrl}${path}`;
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

export const fetchMenuItems = async (config: FetchConfig = {}): Promise<MenuItem[]> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}`), {
    cache: config.cache ?? "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load menu items (${response.status})`);
  }

  const data = (await response.json()) as { items?: unknown };
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map(entry => normalizeItem(entry));
};

export const fetchMenuItem = async (itemId: string, config: FetchConfig = {}): Promise<MenuItem | null> => {
  const response = await fetch(buildUrl(`/menu/${appConfig.tenantId}/${itemId}`), {
    cache: config.cache ?? "no-store"
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

  if (!response.ok && response.status !== 404) {
    const message = await response.text();
    throw new Error(message || "Failed to delete menu item");
  }
};
