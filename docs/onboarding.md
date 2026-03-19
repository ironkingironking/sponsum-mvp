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
npm run db:migrate
npm run db:seed
npm run dev
```

## 3. Verify services

- Web: `http://localhost:3000`
- API: `http://localhost:4000/health`

## 4. Daily workflow

```bash
npm run check
```

## 5. Branching and release

- Feature branches off `develop`
- PR -> CI (`.github/workflows/ci.yml`)
- `develop` deploys staging
- tag `v*` or manual run deploys production workflow

## 6. Environments

- `.env.example`: local development
- `.env.staging.example`: staging reference
- `.env.production.example`: production reference

Never commit real `.env` files.
