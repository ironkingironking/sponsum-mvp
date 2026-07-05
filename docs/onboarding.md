# Developer Onboarding

## 1. Prerequisites

- Node.js 20+
- npm 10+
- Docker

## 2. Bootstrap

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Use `npm run db:migrate` only when you are intentionally creating a new Prisma migration. For a normal checkout or deploy, `npm run db:deploy` is the expected command.

## 3. Verify services

- Web: `http://localhost:3000`
- API: `http://localhost:4000/health`

## 4. Local MVP smoke test

1. Open `http://localhost:3000`.
2. Register or log in.
3. Create a claim from the claims flow.
4. Open the created claim detail page.
5. Publish the claim to the marketplace.
6. Log in as a different user and buy the listing from `/marketplace`.

The expected result is a filled listing with the buyer assigned. Publishing as a non-owner and buying your own listing should both fail.

## 5. Test workflow

Run the fast checks:

```bash
npm run test:unit
npm run typecheck
```

Run the full release gate:

```bash
npm run check
npm audit --audit-level=low
```

Run the integration test against a local test database:

```bash
docker compose exec postgres createdb -U sponsum sponsum_integration
DATABASE_URL="postgresql://sponsum:sponsum@localhost:5432/sponsum_integration?schema=public" npm run db:deploy
DATABASE_URL="postgresql://sponsum:sponsum@localhost:5432/sponsum_integration?schema=public" npm run test:integration
```

Skip the `createdb` command if the database already exists. The integration test refuses to reset non-local databases and databases whose names do not include `test` or `integration`.

## 6. Daily workflow

- Keep branch changes scoped and review `git status -sb` before staging.
- Add migrations for schema changes instead of relying on `db:push`.
- Prefer shared API helpers in `apps/api/src/lib` for auth, ownership, and HTTP error handling.
- Keep new endpoint behavior covered by unit or integration tests when it affects auth, ownership, or transaction state.

## 7. Branching and release

- Feature branches off `develop`
- PR -> CI (`.github/workflows/ci.yml`)
- `develop` deploys staging
- tag `v*` or manual run deploys production workflow

## 8. Environments

- `.env.example`: local development
- `.env.staging.example`: staging reference
- `.env.production.example`: production reference

Never commit real `.env` files.

Required runtime values:

- `DATABASE_URL`
- `AUTH_SECRET` with at least 32 characters
- `CORS_ORIGIN`
- `NEXT_PUBLIC_API_BASE_URL`
- optional rate limit overrides: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`
