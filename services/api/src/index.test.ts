import { describe, expect, it } from "vitest";
import { handler } from "./index";

describe("handler", () => {
  it("returns a 200 response", async () => {
    const result = await handler();
    expect(result.statusCode).toBe(200);
  });
});
