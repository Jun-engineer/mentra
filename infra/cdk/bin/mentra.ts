#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import { MentraPrereqStack } from "../lib/mentra-prereq-stack";
import { MentraStack } from "../lib/mentra-stack";

dotenv.config();

const app = new cdk.App();

const env = {
	account: process.env.CDK_DEFAULT_ACCOUNT,
	region: process.env.CDK_DEFAULT_REGION ?? process.env.MENTRA_AWS_REGION ?? "us-east-1"
};

const prereqStack = new MentraPrereqStack(app, "MentraPrereqStack", {
	env,
	description: "Mentra GitHub OIDC provider and deployment role",
	github: {
		owner: process.env.MENTRA_GITHUB_OWNER ?? "Jun-engineer",
		repo: process.env.MENTRA_GITHUB_REPO ?? "mentra",
		branch: process.env.MENTRA_GITHUB_BRANCH ?? "main",
		roleName: process.env.MENTRA_GITHUB_ROLE ?? "MentraGithubDeployRole",
		providerArn: process.env.MENTRA_GITHUB_PROVIDER_ARN as string | undefined,
		providerStrategy: process.env.MENTRA_GITHUB_PROVIDER_STRATEGY as "create" | "import" | undefined,
		roleStrategy: process.env.MENTRA_GITHUB_ROLE_STRATEGY as "create" | "import" | undefined,
		roleArn: process.env.MENTRA_GITHUB_ROLE_ARN as string | undefined
	}
});

const appStack = new MentraStack(app, "MentraStack", {
	env,
	description: "Mentra foundational infrastructure stack",
	site: {
		bucketName: process.env.MENTRA_SITE_BUCKET
	}
});

const dependencyPrefFlag = (process.env.MENTRA_INCLUDE_PREREQ_DEPENDENCY ?? "true").toLowerCase();
const roleStrategy = (process.env.MENTRA_GITHUB_ROLE_STRATEGY ?? "create").toLowerCase();
const providerStrategy = (process.env.MENTRA_GITHUB_PROVIDER_STRATEGY ?? "create").toLowerCase();
const shouldDependOnPrereq = dependencyPrefFlag !== "false" && dependencyPrefFlag !== "0";

if (shouldDependOnPrereq && (roleStrategy !== "import" || providerStrategy !== "import")) {
	appStack.addDependency(prereqStack);
}