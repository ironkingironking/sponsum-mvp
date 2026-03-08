# Sponsum MVP Monorepo

Sponsum is a browser-based hybrid marketplace for tradable claims, contractual obligations, and alternative financing instruments.

## Stack

- Frontend: Next.js (App Router, TypeScript)
- Backend: Node.js + Express (TypeScript)
- Database: PostgreSQL + Prisma
- Monorepo: npm workspaces

## Repository Layout

- `apps/web` -> Next.js frontend
- `apps/api` -> Node.js API backend
- `packages/shared` -> shared types/schemas/constants
- `packages/ui` -> shared UI components
- `prisma` -> schema + seed
- `docs` -> architecture notes

## Quick Start

1. Copy env file:

```bash
cp .env.example .env
```

2. Start PostgreSQL (Docker):

```bash
docker compose up -d postgres
```

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client and migrate:

```bash
npm run db:generate
npm run db:migrate
```

5. Seed sample data:

```bash
npm run db:seed
```

6. Start API + Web:

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000

### Login (Seed Data)

- Login page: `http://localhost:3000/auth/login`
- Example user: `issuer@sponsum.io`
- Password: `mockpass123`
- Creating claims now requires login (`POST /claims` expects `Authorization: Bearer <token>`).
- Template selection for claim creation is integrated in `/claims/create/wizard/1`.

## Seeded Template Coverage

The seed includes all 7 core templates:

1. Sell an Invoice
2. Borrow with Collateral
3. Bill of Exchange
4. Finance a Venture (Commenda-like)
5. Annuity / Gült-style Claim
6. Provide a Guarantee
7. Buy a Marketplace Claim

## Architecture Summary

- Claim Engine: one extensible `Claim` model with configurable parties, transferability, settlement model, governing law, and jurisdiction.
- Template Engine: 7 first-class templates mapped to the same claim primitives.
- Marketplace Engine: listing, publish, and buy/transfer endpoints with partial ownership support.
- Settlement Engine: claim-scoped settlement events, lifecycle status updates, and default-trigger handling.
- Dispute Module: structured dispute cases with response workflow and claim-status transitions.
- Trust/Collateral/Escrow/Custody: separate linked modules by `relatedClaimId`.
- Event Engine: all major actions write to `EventLog` for audit timeline.

## Settlement + Dispute Integration

- `POST /claims/:id/settlements` creates a settlement event and updates claim status.
- `DEFAULT_TRIGGERED` can auto-open a dispute (if claimant/respondent IDs are provided).
- `POST /disputes` marks claims as `DISPUTED`.
- `POST /disputes/:id/respond` updates dispute state and synchronizes claim status (`RESOLVED` or back to `ACTIVE` for rejected cases).
- Each transition writes to `EventLog` (`dispute_opened`, `dispute_updated`, `dispute_resolved`, etc.).

## Mocked vs Production-Ready

- Mocked in MVP:
  - advanced auth hardening (refresh-token rotation, RBAC enforcement on all routes, account recovery)
  - file storage and document verification flows
  - legal compliance automation and enforceability checks
  - payment rails and smart-contract execution
- Production-ready foundation:
  - basic email/password auth with signed bearer tokens (`/auth/register`, `/auth/login`, `/auth/me`)
  - modular PostgreSQL/Prisma data model
  - typed API + validation structure
  - reusable shared types/template definitions
  - local dev setup (Docker + seed + monorepo scripts)

## Future Extension Ideas

1. Extend auth with refresh-token rotation, RBAC middleware, and route-level authorization policies.
2. Add S3-compatible upload + hash/signature verification pipeline.
3. Add rule-based settlement scheduler (cron/queue) with overdue/default automation.
4. Add dispute inbox and mediation/arbitration role workflows.
5. Add trust scoring job that recalculates from settlement/dispute outcomes.
