#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import { MentraStack } from "../lib/mentra-stack";

dotenv.config();

const app = new cdk.App();

const env = {
	account: process.env.CDK_DEFAULT_ACCOUNT,
	region: process.env.CDK_DEFAULT_REGION ?? process.env.MENTRA_AWS_REGION ?? "us-east-1"
};

new MentraStack(app, "MentraStack", {
	env,
	description: "Mentra foundational infrastructure stack"
});