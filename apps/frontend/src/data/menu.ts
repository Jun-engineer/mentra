export type MenuItem = {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  description: string | null;
  videoUrl: string | null;
  steps: string[];
  updatedAt: string | null;
  createdAt: string | null;
};

export type MenuSubCategory = {
  id: string;
  label: string;
  items: MenuItem[];
};

export type MenuCategory = {
  id: string;
  label: string;
  subCategories: MenuSubCategory[];
};

export const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export const groupMenuItems = (items: MenuItem[]): MenuCategory[] => {
  const categoryMap = new Map<string, { label: string; subCategories: Map<string, MenuSubCategory> }>();

  for (const item of items) {
    const categoryId = slugify(item.category || "uncategorized");
    const subcategoryId = slugify(item.subcategory || "general");

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        label: item.category || "Uncategorized",
        subCategories: new Map()
      });
    }

    const categoryEntry = categoryMap.get(categoryId)!;

    if (!categoryEntry.subCategories.has(subcategoryId)) {
      categoryEntry.subCategories.set(subcategoryId, {
        id: subcategoryId,
        label: item.subcategory || "General",
        items: []
      });
    }

    const subEntry = categoryEntry.subCategories.get(subcategoryId)!;
    subEntry.items.push(item);
  }

  const sortedCategories = Array.from(categoryMap.entries())
    .map<MenuCategory>(([id, value]) => ({
      id,
      label: value.label,
      subCategories: Array.from(value.subCategories.values()).map(sub => ({
        ...sub,
        items: [...sub.items].sort((a, b) => a.title.localeCompare(b.title))
      }))
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  for (const category of sortedCategories) {
    category.subCategories.sort((a, b) => a.label.localeCompare(b.label));
  }

  return sortedCategories;
};
