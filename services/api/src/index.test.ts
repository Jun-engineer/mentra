import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

let handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;
let docClient: import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient;

const mockEvent = (overrides: Partial<APIGatewayProxyEventV2>): APIGatewayProxyEventV2 => {
  const base: APIGatewayProxyEventV2 = {
    version: "2.0",
    routeKey: overrides.routeKey ?? "GET /health",
    rawPath: overrides.rawPath ?? "/health",
    rawQueryString: "",
    cookies: [],
    headers: {},
    queryStringParameters: null,
    pathParameters: overrides.pathParameters ?? {},
    stageVariables: null,
    body: overrides.body ?? null,
    isBase64Encoded: false,
    requestContext: {
      accountId: "000000000000",
      apiId: "test",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: overrides.requestContext?.http.method ?? "GET",
        path: overrides.requestContext?.http.path ?? overrides.rawPath ?? "/health",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest"
      },
      requestId: "test-id",
      routeKey: overrides.routeKey ?? "GET /health",
      stage: "$default",
      time: "08/Dec/2025:00:00:00 +0000",
      timeEpoch: Date.now()
    }
  };

  return base;
};

beforeAll(async () => {
  process.env.MENTRA_TABLE_NAME = "test-table";
  const mod = await import("./index");
  handler = mod.handler;
  docClient = mod.docClient;
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("handler", () => {
  it("returns health payload", async () => {
    const response = await handler(
      mockEvent({
        routeKey: "GET /health",
        rawPath: "/health",
        requestContext: { http: { method: "GET", path: "/health" } }
      })
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("\"status\":\"ok\"");
  });

  it("lists menu items", async () => {
    const sendSpy = vi.spyOn(docClient, "send").mockImplementation(async command => {
      if (command instanceof QueryCommand) {
        return {
          Items: [
            {
              PK: "TENANT#tenant-1#MENU",
              SK: "ITEM#abc123",
              title: "Signature burger",
              category: "Foods",
              subcategory: "Main",
              steps: ["Step 1"]
            }
          ]
        } as never;
      }

      if (command instanceof GetCommand) {
        return {} as never;
      }

      if (command instanceof PutCommand) {
        return {} as never;
      }

      throw new Error(`Unexpected command: ${command.constructor.name}`);
    });

    const response = await handler(
      mockEvent({
        routeKey: "GET /menu/{tenantId}",
        rawPath: "/menu/tenant-1",
        pathParameters: { tenantId: "tenant-1" },
        requestContext: { http: { method: "GET", path: "/menu/tenant-1" } }
      })
    );

    expect(sendSpy).toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledTimes(3);
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body ?? "{}");
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].id).toBe("abc123");
  });

  it("validates post body", async () => {
    const sendSpy = vi.spyOn(docClient, "send");

    const response = await handler(
      mockEvent({
        routeKey: "POST /menu/{tenantId}",
        rawPath: "/menu/acme",
        pathParameters: { tenantId: "acme" },
        requestContext: { http: { method: "POST", path: "/menu/acme" } },
        body: JSON.stringify({
          title: "",
          category: "Foods",
          subcategory: "Main"
        })
      })
    );

    expect(response.statusCode).toBe(400);
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
