# Mentra – First Development Plan

## 1. Goal of First Iteration

Deliver a vertical slice that allows a store owner to register a tenant, invite a manager, and let the manager create and view basic manuals (text only). This provides the foundation for tenant isolation, role-based access, and manual management while deferring media uploads, training orchestration, and wage incentives to later iterations.

## 2. Scope Summary

- Multi-tenant foundation with TenantID propagation from authentication to persisted entities.
- Authentication and authorization wired to Amazon Cognito (Hosted UI during MVP).
- Owner registration flow with tenant bootstrap (Tenant + Owner user records).
- Manager invitation flow via email link and role assignment.
- Manual management (CRUD with text content, optional category reference) stored in DynamoDB.
- Mobile-first manual browsing page for staff (read-only) using placeholder auth while staff invitation is not yet implemented.

Out of scope for iteration 1: video uploads, training assignments, wage incentive rules, analytics dashboards.

## 3. Key Assumptions & Open Questions

1. Tenants use a shared Cognito user pool with custom attributes for role and tenant mapping.
2. Owner onboarding occurs via Cognito Hosted UI; the application supplements user profile with tenant metadata post sign-up.
3. Email delivery for invitations leverages Amazon SES; if unavailable, a placeholder link generator will be used in development.
4. Staff invitation will reuse the invitation infrastructure but is deferred to iteration 2.
5. CloudFront distribution and custom domains will be provisioned after core functionality stabilizes.
6. Need confirmation on supported languages/localization requirements.
7. Need branding guidelines for “bright and clean” theme beyond reference to Deputy.

## 4. Architecture Overview

### 4.1 Frontend

- Framework: Next.js 14 (App Router) with TypeScript.
- UI Toolkit: Tailwind CSS + Headless UI for accessibility-friendly components.
- State: React Query for data fetching, Zustand for lightweight client state.
- Authentication: Amplify Auth + Cognito Hosted UI integration (SSR-friendly via Next middleware).
- Folder structure: `app/(auth)/`, `app/(dashboard)/`, `app/(staff)/` with shared components in `components/` and data access in `lib/api`.

### 4.2 Backend

- Runtime: AWS Lambda (Node.js 20.x) with TypeScript using AWS CDK for infrastructure.
- API Gateway REST API with Lambda integration; endpoints namespaced per tenant.
- Business logic packaged as individual Lambda functions (owner onboarding, invitation, manual CRUD).
- Validation via `zod` schemas shared between frontend and backend packages.

### 4.3 Infrastructure

- AWS CDK (TypeScript) monorepo inside `infra/cdk` deploying:
  - Cognito User Pool + User Pool Client with Hosted UI
  - DynamoDB single-table design (see section 5)
  - SQS queue for async email invitations (future use)
  - SES domain identity (placeholder in dev)
  - IAM roles/policies enforcing tenant isolation at the Lambda layer
- CI/CD: GitHub Actions workflow for lint, test, build, CDK synth. Deployment pipeline targeted for iteration 2.

## 5. Data Model (DynamoDB Single Table)

| PK            | SK                                  | Attributes                                              | Notes                                      |
|---------------|--------------------------------------|---------------------------------------------------------|--------------------------------------------|
| TENANT#<id>   | METADATA                             | name, timezone, createdAt, ownerUserId                  | Tenant metadata                             |
| TENANT#<id>   | USER#<userId>                        | role (OWNER/MANAGER/STAFF), email, status, invitedBy    | User records per tenant                     |
| TENANT#<id>   | INVITE#<inviteId>                    | email, role, code, expiresAt                            | Invitation tokens                           |
| TENANT#<id>   | MANUAL#<manualId>                    | title, categoryId, content, status, createdBy, updatedAt | Manual entities                             |
| TENANT#<id>   | CATEGORY#<categoryId>                | name, sortKey                                           | Manual categories (optional for iteration 1) |

GSI1 (Email Lookup): PK = `EMAIL#<email>`, SK = `TENANT#<id>#USER#<userId>` for cross-tenant email resolution.

## 6. API Surface (Iteration 1)

- `POST /tenants` – bootstrap tenant + owner profile (private admin endpoint called post sign-up).
- `POST /invitations` – create invitation for manager; sends email and stores token.
- `POST /invitations/{code}/accept` – accept invitation and attach Cognito user to tenant.
- `GET /manuals` – list manuals for current tenant (supports role filtering).
- `POST /manuals` – create manual (owner/manager only).
- `PATCH /manuals/{manualId}` – update manual (owner/manager).
- `DELETE /manuals/{manualId}` – soft delete manual (owner/manager).

## 7. Frontend Experience Targets

- **Owner Dashboard:** Tenant overview, invitation management, manual list.
- **Manager Dashboard:** Same manual management UI, invitation creation (managers limited to staff invites once implemented).
- **Staff Manual Viewer:** Mobile-first list/detail views, responsive typography, offline-ready caching (PWA optional in later sprint).

## 8. Development Tasks & Sequencing

1. **Repository Setup**
   - Initialize Turborepo with `apps/frontend`, `services/api`, `packages/shared`, `infra/cdk`.
   - Configure ESLint, Prettier, TypeScript project references, Husky pre-commit hooks.
   - Add GitHub Actions workflow for lint/test/build.

2. **Infrastructure Bootstrap**
   - Define CDK stack for Cognito user pool, DynamoDB table, basic IAM roles.
   - Implement CDK context for dev/staging environments.
   - Add mock SES configuration for local testing.

3. **Backend Services**
   - Implement shared `auth` middleware verifying JWT and extracting tenant/role from claims.
   - Create Lambda handlers for tenant bootstrap, invitation creation/acceptance, manual CRUD.
   - Add unit tests using Vitest + AWS SDK v3 clients with LocalStack mocks.

4. **Frontend Application**
   - Implement authentication flow with Amplify.
   - Build dashboard layout, tenant summary, manual CRUD UI.
   - Build staff manual list/detail screens with mobile-first design.
   - Add API hooks via React Query and validation sharing with backend.

5. **Developer Experience**
   - Local development scripts (e.g., `npm run dev:frontend`, `npm run dev:api` using SST or AWS SAM local).
   - Seed data scripts for manual categories.

6. **Verification**
   - End-to-end smoke test script covering owner sign-up → tenant creation → manager invite → manual creation → staff view.
   - Document testing approach in `docs/testing.md`.

## 9. Deliverables for Iteration Completion

- Running Next.js frontend with authenticated owner/manager/manual flows.
- Deployed backend (dev environment) with working API Gateway endpoints.
- DynamoDB table populated via flows (tenants, users, manuals).
- Documentation covering architecture, API contracts, and environment setup.
- CI pipeline passing lint/test/build steps.

## 10. Next Iterations Preview

- Video uploads via S3 presigned URLs + CloudFront delivery.
- Training creation/assignment and progress tracking entities.
- Wage incentive logic with calculation rules and reporting UI.
- Notification infrastructure (email/SMS) for training reminders.
- Multi-language support and advanced analytics.
