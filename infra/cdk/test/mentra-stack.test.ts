import { App } from "aws-cdk-lib";
import { describe, expect, it } from "vitest";
import { MentraPrereqStack } from "../lib/mentra-prereq-stack";
import { MentraStack } from "../lib/mentra-stack";

describe("Mentra CDK stacks", () => {
  it("synthesizes prerequisite stack", () => {
    const app = new App();
    const prereq = new MentraPrereqStack(app, "TestPrereqStack");
    expect(prereq).toBeDefined();
  });

  it("synthesizes application stack", () => {
    process.env.CDK_SKIP_ASSET_BUNDLING = "1";
    const app = new App();
    const stack = new MentraStack(app, "TestStack");
    expect(stack).toBeDefined();
  });
});
