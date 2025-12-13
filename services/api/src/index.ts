import { randomUUID } from "node:crypto";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import createError from "http-errors";
import type { HttpError } from "http-errors";
import { z } from "zod";

const TABLE_NAME = process.env.MENTRA_TABLE_NAME;

if (!TABLE_NAME) {
  throw new Error("MENTRA_TABLE_NAME environment variable is required");
}

export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,PUT,OPTIONS"
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json"
};

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, "")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
};

const upsertSchema = z
  .object({
    itemId: z.string().optional(),
    title: z.string().trim().min(1, "Title is required"),
    category: z.string().trim().min(1, "Category is required"),
    subcategory: z.string().trim().min(1, "Subcategory is required").optional(),
    description: z.string().trim().optional(),
    videoUrl: z.string().trim().url("Video URL must be valid").optional(),
    steps: z.array(z.string().trim().min(1)).optional()
  })
  .refine(data => {
    const hasDescription = typeof data.description === "string" && data.description.length > 0;
    const hasVideo = typeof data.videoUrl === "string" && data.videoUrl.length > 0;
    return hasDescription || hasVideo;
  }, {
    message: "Provide a description or a video URL before posting",
    path: ["description"]
  });

type MenuRecord = {
  PK: string;
  SK: string;
  title: string;
  category: string;
  subcategory?: string;
  description?: string;
  videoUrl?: string;
  steps?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type MenuConfigRecord = {
  PK: string;
  SK: string;
  categoryOrder: string[];
  subcategoryOrder: Record<string, string[]>;
  itemOrder: Record<string, string[]>;
  updatedAt?: string;
};

type MenuTrainingRecord = {
  PK: string;
  SK: string;
  itemIds: string[];
  updatedAt?: string;
};

type MenuOrdering = {
  categoryOrder: string[];
  subcategoryOrder: Record<string, string[]>;
  itemOrder: Record<string, string[]>;
};

type TrainingPlaylist = {
  itemIds: string[];
};

const MENU_CONFIG_SK = "CONFIG#ORDERING";
const MENU_TRAINING_SK = "CONFIG#TRAINING";

const emptyOrdering: MenuOrdering = {
  categoryOrder: [],
  subcategoryOrder: {},
  itemOrder: {}
};

const emptyTraining: TrainingPlaylist = {
  itemIds: []
};

const orderingSchema = z.object({
  categoryOrder: z.array(z.string()),
  subcategoryOrder: z.record(z.array(z.string())),
  itemOrder: z.record(z.array(z.string()))
});

const trainingSchema = z.object({
  itemIds: z.array(z.string())
});

const toMenuResponse = (record: MenuRecord) => ({
  id: record.SK.replace(/^ITEM#/u, ""),
  title: record.title,
  category: record.category,
  subcategory: record.subcategory?.trim() || record.category || "General",
  description: record.description ?? null,
  videoUrl: record.videoUrl ?? null,
  steps: record.steps ?? [],
  updatedAt: record.updatedAt ?? null,
  createdAt: record.createdAt ?? null
});

const orderingKeyFor = (categorySlug: string, subcategorySlug: string) => `${categorySlug}::${subcategorySlug}`;

const getMenuOrdering = async (tenantId: string): Promise<MenuOrdering> => {
  const response = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#MENU`,
        SK: MENU_CONFIG_SK
      }
    })
  );

  if (!response.Item) {
    return { ...emptyOrdering };
  }

  const record = response.Item as MenuConfigRecord;
  return {
    categoryOrder: Array.isArray(record.categoryOrder) ? [...record.categoryOrder] : [],
    subcategoryOrder: typeof record.subcategoryOrder === "object" && record.subcategoryOrder
      ? { ...record.subcategoryOrder }
      : {},
    itemOrder: typeof record.itemOrder === "object" && record.itemOrder ? { ...record.itemOrder } : {}
  };
};

const saveMenuOrdering = async (tenantId: string, ordering: MenuOrdering) => {
  const now = new Date().toISOString();
  const record: MenuConfigRecord = {
    PK: `TENANT#${tenantId}#MENU`,
    SK: MENU_CONFIG_SK,
    categoryOrder: [...ordering.categoryOrder],
    subcategoryOrder: { ...ordering.subcategoryOrder },
    itemOrder: { ...ordering.itemOrder },
    updatedAt: now
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: record
    })
  );
};

const getTrainingPlaylist = async (tenantId: string): Promise<TrainingPlaylist> => {
  const response = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#MENU`,
        SK: MENU_TRAINING_SK
      }
    })
  );

  if (!response.Item) {
    return { ...emptyTraining };
  }

  const record = response.Item as MenuTrainingRecord;
  return {
    itemIds: Array.isArray(record.itemIds) ? [...record.itemIds] : []
  };
};

const saveTrainingPlaylist = async (tenantId: string, playlist: TrainingPlaylist) => {
  const now = new Date().toISOString();
  const uniqueItemIds = [...new Set(playlist.itemIds)];
  const record: MenuTrainingRecord = {
    PK: `TENANT#${tenantId}#MENU`,
    SK: MENU_TRAINING_SK,
    itemIds: uniqueItemIds,
    updatedAt: now
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: record
    })
  );
};

const normaliseOrderingWithItems = (menuItems: ReturnType<typeof toMenuResponse>[], ordering: MenuOrdering): MenuOrdering => {
  const categorySlugs = new Set<string>();
  const subcategorySlugMap = new Map<string, Set<string>>();
  const itemSlugMap = new Map<string, string[]>();

  for (const item of menuItems) {
    const categorySlug = slugify(item.category || "uncategorized") || "uncategorized";
    const subcategorySlug = slugify(item.subcategory || item.category || "general") || "general";

    categorySlugs.add(categorySlug);

    if (!subcategorySlugMap.has(categorySlug)) {
      subcategorySlugMap.set(categorySlug, new Set<string>());
    }
    subcategorySlugMap.get(categorySlug)!.add(subcategorySlug);

    const key = orderingKeyFor(categorySlug, subcategorySlug);
    if (!itemSlugMap.has(key)) {
      itemSlugMap.set(key, []);
    }
    itemSlugMap.get(key)!.push(item.id);
  }

  const cleaned: MenuOrdering = {
    categoryOrder: [],
    subcategoryOrder: {},
    itemOrder: {}
  };

  const seenCategories = new Set<string>();
  for (const slug of ordering.categoryOrder) {
    if (categorySlugs.has(slug) && !seenCategories.has(slug)) {
      cleaned.categoryOrder.push(slug);
      seenCategories.add(slug);
    }
  }

  const remainingCategories = [...categorySlugs].filter(slug => !seenCategories.has(slug)).sort();
  cleaned.categoryOrder.push(...remainingCategories);

  for (const categorySlug of cleaned.categoryOrder) {
    const availableSubcategories = subcategorySlugMap.get(categorySlug) ?? new Set<string>();
    const seenSubcategories = new Set<string>();
    const existingOrder = ordering.subcategoryOrder[categorySlug] ?? [];

    cleaned.subcategoryOrder[categorySlug] = [];

    for (const slug of existingOrder) {
      if (availableSubcategories.has(slug) && !seenSubcategories.has(slug)) {
        cleaned.subcategoryOrder[categorySlug].push(slug);
        seenSubcategories.add(slug);
      }
    }

    const remainingSubcategories = [...availableSubcategories]
      .filter(slug => !seenSubcategories.has(slug))
      .sort();
    cleaned.subcategoryOrder[categorySlug].push(...remainingSubcategories);

    for (const subSlug of cleaned.subcategoryOrder[categorySlug]) {
      const key = orderingKeyFor(categorySlug, subSlug);
      const availableItems = itemSlugMap.get(key) ?? [];
      const seenItems = new Set<string>();
      const existingItems = ordering.itemOrder[key] ?? [];

      cleaned.itemOrder[key] = [];

      for (const itemId of existingItems) {
        if (availableItems.includes(itemId) && !seenItems.has(itemId)) {
          cleaned.itemOrder[key].push(itemId);
          seenItems.add(itemId);
        }
      }

      const remainingItems = availableItems
        .filter(itemId => !seenItems.has(itemId))
        .sort();
      cleaned.itemOrder[key].push(...remainingItems);
    }
  }

  return cleaned;
};

const normaliseTrainingPlaylistWithItems = (
  menuItems: ReturnType<typeof toMenuResponse>[],
  playlist: TrainingPlaylist
): string[] => {
  const existingIds = new Set(menuItems.map(item => item.id));
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const itemId of playlist.itemIds) {
    if (existingIds.has(itemId) && !seen.has(itemId)) {
      ordered.push(itemId);
      seen.add(itemId);
    }
  }

  return ordered;
};

const ensureItemInOrdering = async (tenantId: string, record: MenuRecord) => {
  const ordering = await getMenuOrdering(tenantId);

  const itemId = record.SK.replace(/^ITEM#/u, "");
  const categorySlug = slugify(record.category || "uncategorized") || "uncategorized";
  const subcategorySlug = slugify(record.subcategory || record.category || "general") || "general";
  const key = orderingKeyFor(categorySlug, subcategorySlug);

  let changed = false;

  if (!ordering.categoryOrder.includes(categorySlug)) {
    ordering.categoryOrder.push(categorySlug);
    changed = true;
  }

  const subcategoryOrder = ordering.subcategoryOrder[categorySlug] ?? [];
  if (!subcategoryOrder.includes(subcategorySlug)) {
    ordering.subcategoryOrder[categorySlug] = [...subcategoryOrder, subcategorySlug];
    changed = true;
  }

  const itemOrder = ordering.itemOrder[key] ?? [];
  if (!itemOrder.includes(itemId)) {
    ordering.itemOrder[key] = [...itemOrder, itemId];
    changed = true;
  }

  if (changed) {
    await saveMenuOrdering(tenantId, ordering);
  }
};

const removeItemFromOrdering = async (tenantId: string, itemId: string, category: string, subcategory?: string) => {
  const ordering = await getMenuOrdering(tenantId);
  const categorySlug = slugify(category || "uncategorized") || "uncategorized";
  const subcategorySlug = slugify(subcategory || category || "general") || "general";
  const key = orderingKeyFor(categorySlug, subcategorySlug);

  const existingItems = ordering.itemOrder[key];
  if (!existingItems) {
    return;
  }

  const filteredItems = existingItems.filter(id => id !== itemId);
  if (filteredItems.length === existingItems.length) {
    return;
  }

  ordering.itemOrder[key] = filteredItems;
  await saveMenuOrdering(tenantId, ordering);
};

const removeItemFromTraining = async (tenantId: string, itemId: string) => {
  const playlist = await getTrainingPlaylist(tenantId);
  if (!playlist.itemIds.includes(itemId)) {
    return;
  }

  const nextIds = playlist.itemIds.filter(id => id !== itemId);
  await saveTrainingPlaylist(tenantId, { itemIds: nextIds });
};

const ok = (statusCode: number, payload: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(payload)
});

const fromHttpError = (error: HttpError): APIGatewayProxyResultV2 => ({
  statusCode: error.status ?? 500,
  headers: jsonHeaders,
  body: JSON.stringify({ message: error.message })
});

const ensureTenantId = (params: APIGatewayProxyEventV2["pathParameters"]): string => {
  const tenantId = params?.tenantId;
  if (!tenantId) {
    throw new createError.BadRequest("Missing tenantId in request path");
  }
  return tenantId;
};

const ensureItemId = (params: APIGatewayProxyEventV2["pathParameters"]): string => {
  const itemId = params?.itemId;
  if (!itemId) {
    throw new createError.BadRequest("Missing itemId in request path");
  }
  return itemId;
};

const listMenuItems = async (tenantId: string) => {
  const response = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#MENU`,
        ":sk": "ITEM#"
      }
    })
  );

  return (response.Items ?? []).map(item => toMenuResponse(item as MenuRecord));
};

const listMenuState = async (tenantId: string) => {
  const items = await listMenuItems(tenantId);
  const ordering = await getMenuOrdering(tenantId);
  const normalisedOrdering = normaliseOrderingWithItems(items, ordering);

  if (JSON.stringify(ordering) !== JSON.stringify(normalisedOrdering)) {
    await saveMenuOrdering(tenantId, normalisedOrdering);
  }

  return { items, ordering: normalisedOrdering };
};

const getMenuItem = async (tenantId: string, itemId: string) => {
  const response = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#MENU`,
        SK: `ITEM#${itemId}`
      }
    })
  );

  if (!response.Item) {
    throw new createError.NotFound("Menu item not found");
  }

  return toMenuResponse(response.Item as MenuRecord);
};

const upsertMenuItem = async (tenantId: string, payload: z.infer<typeof upsertSchema>) => {
  const now = new Date().toISOString();
  const itemId = payload.itemId ?? randomUUID();
  const existingItem = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#MENU`,
        SK: `ITEM#${itemId}`
      }
    })
  );
  const record: MenuRecord = {
    PK: `TENANT#${tenantId}#MENU`,
    SK: `ITEM#${itemId}`,
    title: payload.title,
    category: payload.category,
    subcategory: payload.subcategory ?? undefined,
    description: payload.description && payload.description.length > 0 ? payload.description : undefined,
    videoUrl: payload.videoUrl && payload.videoUrl.length > 0 ? payload.videoUrl : undefined,
    steps: payload.steps ?? [],
    createdAt: (existingItem.Item as MenuRecord | undefined)?.createdAt ?? now,
    updatedAt: now
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: record
    })
  );

  await ensureItemInOrdering(tenantId, record);

  return toMenuResponse(record);
};

const deleteMenuItem = async (tenantId: string, itemId: string) => {
  const key = {
    PK: `TENANT#${tenantId}#MENU`,
    SK: `ITEM#${itemId}`
  };

  const existing = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key
    })
  );

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: key
    })
  );

  const record = existing.Item as MenuRecord | undefined;
  if (record) {
    await removeItemFromOrdering(tenantId, itemId, record.category, record.subcategory);
    await removeItemFromTraining(tenantId, itemId);
  }
};

const isHttpError = (error: unknown): error is HttpError => {
  return Boolean(error) && typeof error === "object" && "status" in (error as Record<string, unknown>);
};

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    if (event.requestContext.http.method === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: ""
      };
    }

    switch (event.routeKey) {
      case "GET /health":
        return ok(200, { status: "ok" });
      case "GET /menu/{tenantId}": {
        const tenantId = ensureTenantId(event.pathParameters);
        const state = await listMenuState(tenantId);
        return ok(200, state);
      }
      case "GET /menu/{tenantId}/ordering": {
        const tenantId = ensureTenantId(event.pathParameters);
        const ordering = await getMenuOrdering(tenantId);
        return ok(200, { ordering });
      }
      case "PUT /menu/{tenantId}/ordering": {
        const tenantId = ensureTenantId(event.pathParameters);
        let json: unknown = {};
        if (event.body) {
          try {
            json = JSON.parse(event.body);
          } catch {
            throw new createError.BadRequest("Request body must be valid JSON");
          }
        }
        const parsed = orderingSchema.parse(json);
        await saveMenuOrdering(tenantId, parsed);
        return ok(204, {});
      }
      case "GET /menu/{tenantId}/training": {
        const tenantId = ensureTenantId(event.pathParameters);
        const [menuItems, playlist] = await Promise.all([
          listMenuItems(tenantId),
          getTrainingPlaylist(tenantId)
        ]);

        const normalisedIds = normaliseTrainingPlaylistWithItems(menuItems, playlist);
        if (JSON.stringify(normalisedIds) !== JSON.stringify(playlist.itemIds)) {
          await saveTrainingPlaylist(tenantId, { itemIds: normalisedIds });
        }

        const itemById = new Map(menuItems.map(item => [item.id, item]));
        const items = normalisedIds
          .map(itemId => itemById.get(itemId))
          .filter((item): item is ReturnType<typeof toMenuResponse> => Boolean(item));

        return ok(200, { itemIds: normalisedIds, items });
      }
      case "PUT /menu/{tenantId}/training": {
        const tenantId = ensureTenantId(event.pathParameters);
        let json: unknown = {};
        if (event.body) {
          try {
            json = JSON.parse(event.body);
          } catch {
            throw new createError.BadRequest("Request body must be valid JSON");
          }
        }
        const parsed = trainingSchema.parse(json);
        await saveTrainingPlaylist(tenantId, { itemIds: parsed.itemIds });
        return ok(204, {});
      }
      case "GET /menu/{tenantId}/{itemId}": {
        const tenantId = ensureTenantId(event.pathParameters);
        const itemId = ensureItemId(event.pathParameters);
        const item = await getMenuItem(tenantId, itemId);
        return ok(200, { item });
      }
      case "POST /menu/{tenantId}": {
        const tenantId = ensureTenantId(event.pathParameters);
        let json: unknown = {};
        if (event.body) {
          try {
            json = JSON.parse(event.body);
          } catch {
            throw new createError.BadRequest("Request body must be valid JSON");
          }
        }
        const payload = upsertSchema.parse(json);
        const item = await upsertMenuItem(tenantId, payload);
        return ok(201, { item });
      }
      case "DELETE /menu/{tenantId}/{itemId}": {
        const tenantId = ensureTenantId(event.pathParameters);
        const itemId = ensureItemId(event.pathParameters);
        await deleteMenuItem(tenantId, itemId);
        return ok(204, {});
      }
      default:
        return ok(404, { message: "Route not found" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return ok(400, { message: issue?.message ?? "Invalid request payload" });
    }

    if (isHttpError(error)) {
      return fromHttpError(error);
    }

    const fallbackMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("Unhandled Mentra API error", error);
    return ok(500, { message: fallbackMessage });
  }
};
