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
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json"
};

const upsertSchema = z
  .object({
    itemId: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    category: z.string().min(1, "Category is required"),
    subcategory: z.string().min(1, "Subcategory is required"),
    description: z.string().trim().optional(),
    videoUrl: z.string().url("Video URL must be valid").optional(),
    steps: z.array(z.string().trim().min(1)).optional()
  })
  .refine(data => Boolean(data.description) || Boolean(data.videoUrl), {
    message: "Provide a description or a video URL before posting",
    path: ["description"]
  });

type MenuRecord = {
  PK: string;
  SK: string;
  title: string;
  category: string;
  subcategory: string;
  description?: string;
  videoUrl?: string;
  steps?: string[];
  createdAt?: string;
  updatedAt?: string;
};

const toMenuResponse = (record: MenuRecord) => ({
  id: record.SK.replace(/^ITEM#/u, ""),
  title: record.title,
  category: record.category,
  subcategory: record.subcategory,
  description: record.description ?? null,
  videoUrl: record.videoUrl ?? null,
  steps: record.steps ?? [],
  updatedAt: record.updatedAt ?? null,
  createdAt: record.createdAt ?? null
});

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
    subcategory: payload.subcategory,
    description: payload.description?.trim() || undefined,
    videoUrl: payload.videoUrl,
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

  return toMenuResponse(record);
};

const deleteMenuItem = async (tenantId: string, itemId: string) => {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#MENU`,
        SK: `ITEM#${itemId}`
      }
    })
  );
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
        const items = await listMenuItems(tenantId);
        return ok(200, { items });
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
