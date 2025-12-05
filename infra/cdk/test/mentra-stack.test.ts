import { App } from "aws-cdk-lib";
import { describe, expect, it } from "vitest";
import { MentraStack } from "../lib/mentra-stack";

describe("MentraStack", () => {
  it("synthesizes without error", () => {
    const app = new App();
    const stack = new MentraStack(app, "TestStack");
    expect(stack).toBeDefined();
  });
});
