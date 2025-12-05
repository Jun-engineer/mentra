# Mentra Infrastructure (AWS CDK)

This package defines the AWS infrastructure for the Mentra platform using the AWS Cloud Development Kit (CDK) with TypeScript.

## Bootstrap

```bash
pnpm install
pnpm --filter mentra-infra build
```

Before synthesizing or deploying, ensure the target AWS account is bootstrapped:

```bash
cd infra/cdk
pnpm cdk bootstrap aws://<account>/<region>
```

## Stacks

- `MentraStack` – provisions the shared DynamoDB table that backs the single-table multi-tenant design. Cognito, API Gateway, and additional resources will be added in upcoming iterations.
