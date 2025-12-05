import { describe, expect, it } from "vitest";
import { CreateManualInputSchema } from "./index";

describe("CreateManualInputSchema", () => {
  it("accepts valid payloads", () => {
    const result = CreateManualInputSchema.safeParse({
      tenantId: "TENANT#001",
      title: "Welcome Manual",
      content: "Always wash hands",
      status: "draft"
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty titles", () => {
    const result = CreateManualInputSchema.safeParse({
      tenantId: "TENANT#001",
      title: "",
      content: "Body",
      status: "draft"
    });
    expect(result.success).toBe(false);
  });
});
