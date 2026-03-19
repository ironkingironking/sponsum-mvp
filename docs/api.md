# Sponsum API (MVP)

Base URL: `http://localhost:4000`

## Auth

### `POST /auth/register`
Create a user account.

### `POST /auth/login`
Returns `{ user, token }`.

### `GET /auth/me`
Requires `Authorization: Bearer <token>`.

## Claims

### `GET /claims`
List claims.

### `POST /claims`
Create claim (authenticated).

### `GET /claims/:id`
Get claim detail.

### `PATCH /claims/:id`
Patch claim metadata/status.

### `POST /claims/:id/publish`
Publish claim as marketplace listing.

### `POST /claims/:id/transfer`
Transfer ownership share.

## Transaction lifecycle (new boundary)

Prefix: `/api/v1/transactions`

### `POST /api/v1/transactions/create`
Create lifecycle-managed transaction claim.

### `POST /api/v1/transactions/:claimId/fund`
Lifecycle transition to funding accepted.

### `POST /api/v1/transactions/:claimId/transfer`
Lifecycle transition to active ownership transfer.

### `POST /api/v1/transactions/:claimId/settle`
Lifecycle transition to partial/full settlement.

### `GET /api/v1/transactions/:claimId`
Returns lifecycle view: parties, listings, settlement events.

## Settlement and disputes

### `GET /claims/:id/settlements`
### `POST /claims/:id/settlements`
### `POST /disputes`
### `POST /disputes/:id/respond`

## Security controls in API

- `helmet` security headers
- global request rate limiting
- strict env validation
- no fallback auth secret in runtime
- structured lifecycle transition checks
