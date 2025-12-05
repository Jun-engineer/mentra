# Mentra Monorepo

Mentra is a multi-tenant training and manual management platform built with a Turborepo monorepo. This repository contains the Next.js frontend, Lambda-based backend services, shared TypeScript packages, and AWS CDK infrastructure code.

## Workspace Structure

- `apps/frontend` – Next.js 14 App Router frontend with Tailwind CSS.
- `services/api` – Lambda handlers packaged with `tsup` for API Gateway.
- `packages/shared` – Shared domain contracts (Zod schemas, types).
- `infra/cdk` – AWS CDK stacks defining core infrastructure.
- `docs/` – Architecture notes and iteration planning.

## Getting Started

```bash
pnpm install
pnpm dev
```

Individual package scripts can be run with Turborepo filters:

```bash
pnpm --filter frontend dev
pnpm --filter api build
pnpm --filter mentra-infra synth
```

## Next Steps

1. Flesh out Cognito-backed authentication and tenant bootstrap flows.
2. Add REST endpoints for invitations and manual management in `services/api`.
3. Wire the frontend to call the API via React Query with authenticated requests.
4. Expand CDK stack to provision Cognito, API Gateway, and supporting IAM policies.
