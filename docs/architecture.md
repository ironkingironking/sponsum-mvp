# Sponsum Architecture

## Runtime layout

- `apps/web`: Next.js operator UI
- `apps/api`: Express API application boundary
- `packages/shared`: cross-app types + schemas
- `packages/ui`: shared UI package
- `prisma`: relational data model and committed migrations
- `.github/workflows`: CI plus staging/production deployment automation

## Layering inside API

- `modules/*/route.ts`: HTTP adapters
- `modules/*/service.ts`: application/domain orchestration
- `lib/*`: infrastructure and cross-cutting helpers
- `app.ts`: constructs the Express app for both runtime and integration tests
- `index.ts`: process entrypoint that binds the app to `API_PORT`

This keeps transport, business logic, and infrastructure concerns separable while allowing integration tests to exercise the same app wiring as production.

Important shared helpers:

- `lib/env.ts`: typed runtime env validation
- `lib/auth.ts`: bearer-token parsing and authenticated user lookup
- `lib/claim-access.ts`: claim ownership and claim-party authorization checks
- `lib/http-error.ts`: consistent status/error responses for expected domain failures
- `lib/prisma.ts`: Prisma client boundary

## Domain map

### Claims domain

- claim creation and state management by authenticated issuers
- template-driven authoring
- marketplace publication
- dispute linkage

### Marketplace domain

- listing publication and fills
- ownership fraction transfer
- authenticated buyer attribution
- self-buy prevention

### Settlement, dispute, and trust domains

- settlement event tracking
- dispute creation and response
- collateral, escrow, and custody records
- trust profile records
- event log reads for claim history

### Transaction lifecycle domain

Explicit lifecycle for investor readability:

1. `create` -> claim issued
2. `fund` -> accepted/funded
3. `transfer` -> active ownership transfer
4. `settle` -> partial/full settlement

Transition guards are centralized in `transaction-lifecycle/schemas.ts`.

## Security baseline

- typed env validation (`lib/env.ts`)
- `helmet` headers
- global rate limit
- mandatory strong `AUTH_SECRET`
- bearer-token protected write paths
- owner/party checks before claim-sensitive mutations
- marketplace purchases use the authenticated actor rather than trusting request-body buyer ids

Public read endpoints are intentionally available for marketplace-style browsing. Mutating routes require `Authorization: Bearer <token>` unless explicitly part of auth registration/login.

## Data and migrations

PostgreSQL is the system of record. Prisma schema changes are captured in committed migrations under `prisma/migrations`.

- Local bootstrap, CI, staging, and production use `npm run db:deploy`.
- Local schema work uses `npm run db:migrate` to create a migration.
- `npm run db:push` is reserved for short-lived prototyping.

The seed script remains local/demo oriented and should not be part of production deploys.

## Verification layers

- Unit tests cover token/auth helpers and shared schemas.
- Integration tests boot the Express app via `createApp()` and run against a local PostgreSQL database.
- CI applies migrations, runs unit and integration tests, type checks, and builds the monorepo.
- Deployment workflows run a pre-deploy build check, then roll out over SSH with Docker Compose.

## Scalability path

### MVP (now)

Single API process, Next.js web app, and PostgreSQL.

### Next split

- `claims-service`
- `marketplace-service`
- `settlement-service`
- async events via queue/outbox

The new transaction lifecycle module is already isolated to become a standalone service later.
