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

export type MenuOrdering = {
  categoryOrder: string[];
  subcategoryOrder: Record<string, string[]>;
  itemOrder: Record<string, string[]>;
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

export const groupMenuItems = (items: MenuItem[], ordering?: MenuOrdering): MenuCategory[] => {
  const categoryMap = new Map<string, { label: string; subCategories: Map<string, MenuSubCategory> }>();
  const itemLookup = new Map<string, MenuItem>();

  for (const item of items) {
    itemLookup.set(item.id, item);
    const trimmedCategory = item.category?.trim() ?? "";
    const trimmedSubcategory = item.subcategory?.trim() ?? "";
    const fallbackSubcategoryLabel = trimmedSubcategory || trimmedCategory || "General";

    const categoryId = slugify(trimmedCategory || "uncategorized");
    const subcategoryId = slugify(trimmedSubcategory || trimmedCategory || "general");

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        label: trimmedCategory || "Uncategorized",
        subCategories: new Map()
      });
    }

    const categoryEntry = categoryMap.get(categoryId)!;

    if (!categoryEntry.subCategories.has(subcategoryId)) {
      categoryEntry.subCategories.set(subcategoryId, {
        id: subcategoryId,
        label: fallbackSubcategoryLabel,
        items: []
      });
    }

    const subEntry = categoryEntry.subCategories.get(subcategoryId)!;
    subEntry.items.push(item);
  }

  const effectiveOrdering: MenuOrdering = ordering ?? {
    categoryOrder: [],
    subcategoryOrder: {},
    itemOrder: {}
  };

  const categoryIds = Array.from(categoryMap.keys());
  const orderedCategoryIds = [
    ...effectiveOrdering.categoryOrder.filter(id => categoryMap.has(id)),
    ...categoryIds
      .filter(id => !effectiveOrdering.categoryOrder.includes(id))
      .sort((a, b) => categoryMap.get(a)!.label.localeCompare(categoryMap.get(b)!.label))
  ];

  return orderedCategoryIds.map<MenuCategory>(categoryId => {
    const categoryEntry = categoryMap.get(categoryId)!;
    const subcategoryIds = Array.from(categoryEntry.subCategories.keys());
    const orderedSubcategoryIds = [
      ...((effectiveOrdering.subcategoryOrder[categoryId] ?? []).filter(id => categoryEntry.subCategories.has(id))),
      ...subcategoryIds
        .filter(id => !(effectiveOrdering.subcategoryOrder[categoryId] ?? []).includes(id))
        .sort((a, b) =>
          categoryEntry.subCategories.get(a)!.label.localeCompare(categoryEntry.subCategories.get(b)!.label)
        )
    ];

    const subCategories = orderedSubcategoryIds.map<MenuSubCategory>(subId => {
      const subEntry = categoryEntry.subCategories.get(subId)!;
      const key = `${categoryId}::${subId}`;
      const orderedItemIds = effectiveOrdering.itemOrder[key] ?? [];
      const orderedItems = [
        ...orderedItemIds
          .map(itemId => itemLookup.get(itemId))
          .filter((item): item is MenuItem => Boolean(item)),
        ...subEntry.items
          .filter(item => !orderedItemIds.includes(item.id))
          .sort((a, b) => a.title.localeCompare(b.title))
      ];

      return {
        id: subEntry.id,
        label: subEntry.label,
        items: orderedItems
      };
    });

    return {
      id: categoryId,
      label: categoryEntry.label,
      subCategories
    };
  });
};
