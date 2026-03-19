# Sponsum Architecture

## Runtime layout

- `apps/web`: Next.js operator UI
- `apps/api`: Express API (application boundary)
- `packages/shared`: cross-app types + schemas
- `packages/ui`: shared UI package
- `prisma`: relational data model
- `infra`: deployment manifests (planned)

## Layering inside API

- `modules/*/route.ts`: HTTP adapters
- `modules/*/service.ts`: application/domain orchestration
- `lib/*`: infrastructure helpers (env, token, prisma)

This keeps transport, business logic, and infra concerns separable.

## Domain map

### Claims domain

- claim creation and state management
- template-driven authoring
- dispute linkage

### Marketplace domain

- listing publication and fills
- ownership fraction transfer

### Transaction lifecycle domain (new)

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

## Scalability path

### MVP (now)

Single API process + PostgreSQL.

### Next split

- `claims-service`
- `marketplace-service`
- `settlement-service`
- async events via queue/outbox

The new transaction lifecycle module is already isolated to become a standalone service later.
