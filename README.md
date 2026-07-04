# Sponsum

Sponsum is an MVP for a hybrid marketplace of tradable claims. It covers the first usable product loop: issuers create legally described claims, publish them to a marketplace, investors buy listings, and both sides can follow settlement, dispute, collateral, escrow, and custody context.

## Product structure

- `apps/web`: Next.js operator and investor UI
- `apps/api`: Express + TypeScript API
- `packages/shared`: domain types/schemas
- `packages/ui`: shared UI components
- `prisma`: PostgreSQL schema + seed
- `docs`: architecture, API, onboarding, and deployment notes

## MVP flow

The current MVP is designed around one complete transaction path:

1. Register or log in.
2. Create a claim as the issuer.
3. Open the live claim detail page.
4. Publish the claim as a marketplace listing.
5. Buy the listing as a different authenticated user.
6. Track settlement, dispute, and trust-control records from the claim view.

The API now enforces the important ownership boundaries for this loop: write paths require a bearer token, non-owners cannot publish or mutate another issuer's claim, and a seller cannot buy their own marketplace listing.

## Quickstart

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Endpoints:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

If port `5432` is already taken locally, set `POSTGRES_PORT` in `.env` and update `DATABASE_URL` to match.

## Verification

```bash
npm run test:unit
npm run check
npm audit --audit-level=low
```

`npm run check` runs unit tests, type checks, and the full monorepo build.

For full API integration verification, create a dedicated local test database and run:

```bash
docker compose exec postgres createdb -U sponsum sponsum_integration
DATABASE_URL="postgresql://sponsum:sponsum@localhost:5432/sponsum_integration?schema=public" npm run db:deploy
DATABASE_URL="postgresql://sponsum:sponsum@localhost:5432/sponsum_integration?schema=public" npm run test:integration
```

The integration test includes the authenticated claim publishing and marketplace buying flow. See [`docs/onboarding.md`](docs/onboarding.md) for the full test workflow.

## Database workflow

- `npm run db:deploy`: apply committed Prisma migrations. Use this for CI, staging, production, and fresh local bootstrap.
- `npm run db:migrate`: create and apply a new Prisma migration during local schema work.
- `npm run db:push`: prototype-only schema sync when a migration is intentionally not being created yet.
- `npm run db:seed`: load local demo data.

## Security and env strategy

- Strict env parsing (`apps/api/src/lib/env.ts`)
- No weak fallback auth secret
- Helmet + rate limiting enabled globally
- Shared auth helpers (`apps/api/src/lib/auth.ts`)
- Claim ownership/party checks (`apps/api/src/lib/claim-access.ts`)
- Environment templates:
  - `.env.example`
  - `.env.staging.example`
  - `.env.production.example`

## CI/CD

- CI: `.github/workflows/ci.yml` runs migrations, unit tests, integration tests, type checks, and build against PostgreSQL.
- Staging: `.github/workflows/staging.yml` deploys from `develop` or manual dispatch over SSH and Docker Compose.
- Production: `.github/workflows/production.yml` deploys from `v*` tags or manual dispatch over SSH and Docker Compose.

## Core API domains

- Auth: register/login/me
- Claims engine
- Marketplace + transfers
- Settlement + disputes
- Collateral, escrow, custody, trust, and event records
- Transaction lifecycle (`/api/v1/transactions/*`)

## Transaction lifecycle (investor-readable)

1. create
2. fund
3. transfer
4. settle

Implemented in `apps/api/src/modules/transaction-lifecycle` with explicit transition guards.

## Documentation

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/api.md`](docs/api.md)
- [`docs/onboarding.md`](docs/onboarding.md)
- [`docs/deployment.md`](docs/deployment.md)
