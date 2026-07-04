# Deployment

Sponsum deploys through GitHub Actions to an SSH-accessible host running Docker Compose.

## Workflows

- `.github/workflows/ci.yml`: runs on pull requests and pushes to `main` or `develop`.
- `.github/workflows/staging.yml`: runs on pushes to `develop` and manual dispatch.
- `.github/workflows/production.yml`: runs on `v*` tags and manual dispatch.

CI starts PostgreSQL, applies Prisma migrations with `npm run db:deploy`, runs unit and integration tests, type checks, and builds the monorepo.

## Remote host requirements

The deployment host must have:

- Docker and Docker Compose available to the deploy user.
- SSH access from GitHub Actions using the configured private key.
- A git checkout of this repository at the configured deploy path.
- Permission for the deploy user to run `git fetch`, `git reset --hard`, and `docker compose`.

The workflow resets the checkout to the GitHub commit being deployed. Do not keep manual production-only changes inside the deploy checkout.

## GitHub secrets

Staging:

- `STAGING_SSH_HOST`
- `STAGING_SSH_USER`
- `STAGING_SSH_KEY`
- `STAGING_DEPLOY_PATH`
- `STAGING_ENV_FILE`
- optional `STAGING_HEALTH_URL`

Production:

- `PRODUCTION_SSH_HOST`
- `PRODUCTION_SSH_USER`
- `PRODUCTION_SSH_KEY`
- `PRODUCTION_DEPLOY_PATH`
- `PRODUCTION_ENV_FILE`
- optional `PRODUCTION_HEALTH_URL`

`*_ENV_FILE` should contain the full runtime `.env` file for that environment.

## Runtime environment

Minimum API/web values:

```bash
NODE_ENV=production
DATABASE_URL="postgresql://sponsum:<password>@postgres:5432/sponsum?schema=public"
API_PORT=4000
AUTH_SECRET="replace-with-32-plus-character-random-secret"
CORS_ORIGIN="https://app.example.com"
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
NEXT_PUBLIC_API_BASE_URL="https://api.example.com"
```

Docker Compose also accepts PostgreSQL container values:

```bash
POSTGRES_USER=sponsum
POSTGRES_PASSWORD=<password>
POSTGRES_DB=sponsum
POSTGRES_PORT=5432
```

Use environment-specific values from `.env.staging.example` and `.env.production.example` as templates. Never commit real `.env` files.

## Rollout steps performed by the workflow

1. Validate required GitHub secrets.
2. Upload the environment file to the remote deploy path.
3. Fetch and reset the remote git checkout to the target commit.
4. Build the API and web Docker images.
5. Start PostgreSQL.
6. Run Prisma migrations with `npm run db:deploy`.
7. Start API and web containers.
8. Run the optional health check URL when configured.

## Production checklist

- CI is green on the commit being deployed.
- `AUTH_SECRET` is strong and environment-specific.
- `CORS_ORIGIN` matches the public web origin.
- `NEXT_PUBLIC_API_BASE_URL` matches the public API origin.
- Database backups are configured outside this repository.
- `PRODUCTION_HEALTH_URL` points to a stable health endpoint, usually `/health`.
