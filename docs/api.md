# Sponsum API (MVP)

Base URL: `http://localhost:4000`

Use `Authorization: Bearer <token>` for all mutating routes except `POST /auth/register` and `POST /auth/login`.

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

Create a claim as the authenticated user. The API sets `createdById` from the bearer token.

### `GET /claims/:id`

Get claim detail.

### `PATCH /claims/:id`

Patch claim metadata/status. Requires authentication and claim management access.

### `POST /claims/:id/publish`

Publish claim as marketplace listing. Requires authentication and claim management access. The listing seller is the authenticated user.

### `POST /claims/:id/transfer`

Transfer ownership share. Requires authentication and claim management access.

Required body:

```json
{
  "buyerId": "user-id",
  "ownershipFraction": 1
}
```

## Marketplace

### `GET /marketplace/listings`

List marketplace listings.

### `POST /marketplace/listings`

Create a marketplace listing for a claim. Requires authentication and claim management access.

Required body:

```json
{
  "claimId": "claim-id",
  "askPrice": 11500,
  "ownershipFraction": 1,
  "transferConditions": "standard transfer conditions"
}
```

### `POST /marketplace/listings/:id/buy`

Buy an open listing. Requires authentication. The buyer is always the authenticated user; request-body buyer ids are ignored. Sellers cannot buy their own listing.

## Transaction lifecycle

Prefix: `/api/v1/transactions`

### `POST /api/v1/transactions/create`

Create lifecycle-managed transaction claim. Requires authentication.

### `POST /api/v1/transactions/:claimId/fund`

Lifecycle transition to funding accepted. Requires authentication and claim actor access.

### `POST /api/v1/transactions/:claimId/transfer`

Lifecycle transition to active ownership transfer. Requires authentication and claim actor access.

### `POST /api/v1/transactions/:claimId/settle`

Lifecycle transition to partial/full settlement. Requires authentication and claim actor access.

### `GET /api/v1/transactions/:claimId`

Returns lifecycle view: parties, listings, settlement events.

## Settlement and disputes

### `GET /claims/:id/settlements`

List settlement events for a claim.

### `POST /claims/:id/settlements`

Add settlement event. Requires authentication and claim actor access.

### `POST /disputes`

Create a dispute. Requires authentication and claim actor access.

### `POST /disputes/:id/respond`

Respond to a dispute. Requires authentication and claim actor access.

## Trust controls

### `GET /claims/:id/collateral`

List collateral records for a claim.

### `POST /claims/:id/collateral`

Create collateral record. Requires authentication and claim actor access.

### `GET /claims/:id/escrow`

List escrow arrangements for a claim.

### `POST /claims/:id/escrow`

Create escrow arrangement. Requires authentication and claim actor access.

### `GET /claims/:id/custody`

List custody records for a claim.

### `POST /claims/:id/custody`

Create custody record. Requires authentication and claim actor access.

## Events

### `GET /claims/:id/events`

List event log entries for a claim.

## Security controls in API

- `helmet` security headers
- global request rate limiting
- strict env validation
- no fallback auth secret in runtime
- shared auth middleware on mutating routes
- ownership and claim-party access checks
- authenticated actor used for buyer/seller-sensitive marketplace actions
- structured lifecycle transition checks
