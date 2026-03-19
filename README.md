# Sponsum

Sponsum is a hybrid marketplace for tradable claims with legal/financial workflows: creation, funding, transfer, settlement, disputes, and trust/collateral controls.

## Product structure

- `apps/web`: Next.js UI
- `apps/api`: Express + TypeScript API
- `packages/shared`: domain types/schemas
- `packages/ui`: shared UI components
- `prisma`: PostgreSQL schema + seed
- `docs`: architecture/API/onboarding

## Quickstart

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Endpoints:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## Security and env strategy

- Strict env parsing (`apps/api/src/lib/env.ts`)
- No weak fallback auth secret
- Helmet + rate limiting enabled globally
- Environment templates:
  - `.env.example`
  - `.env.staging.example`
  - `.env.production.example`

## CI/CD

- CI: `.github/workflows/ci.yml`
- Staging: `.github/workflows/staging.yml`
- Production: `.github/workflows/production.yml`

## Core API domains

- Auth: register/login/me
- Claims engine
- Marketplace + transfers
- Settlement + disputes
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
