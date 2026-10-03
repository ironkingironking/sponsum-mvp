# Live Sponsum desk (Suite)

This is the surface Suite serves at `https://suite.movena.ch/sponsum/`.
It is the hash desk in `apps/api/public/sponsum/`, proxied to the Express API
on `/api/sponsum/v1`. It is **not** the unused claims Next.js app or `docs/api.md`.

Hard-refresh after deploy so `sponsum-desk.js?v=…` is not cached.

## Hash views

List hashes stay on the index. A trailing `/:id` is a dedicated dossier.
Unknown ids render an explicit not-found card (title + error), not the list
and not the previous page.

| Entity | List | Detail | API GET |
|---|---|---|---|
| Forderung | `#/receivables` | `#/receivables/:receivable_id` | `/api/sponsum/v1/receivables/:id/dossier` |
| Wechsel | `#/wechsel` | `#/wechsel/:instrument_id` | `/api/sponsum/v1/wechsel-drafts/:id/dossier` |
| Marktangebot | `#/market` | `#/market/:offer_id` | `/api/sponsum/v1/offers/:id` |
| Dispute / Resolve | `#/disputes` | `#/disputes/:dispute_id` | `/api/sponsum/v1/disputes/:id` — Track, Formulare `POST /disputes/:id/forms`, Export `POST /disputes/:id/exports` |
| Abschluss / Abrechnung | `#/settlement` (Zeilen klappen auf) | `#/settlement/:trade_or_instruction_id` öffnet dieselbe Liste mit aufgeklappter Zeile | `/api/sponsum/v1/settlements/:id` |
| Zession | `#/zession` | `#/zession/:assignment_id` | `/api/sponsum/v1/assignments/:id` |
| Kapitalbedarf | `#/capital` | `#/capital/need/:need_id` | `/api/sponsum/v1/capital/needs/:id` |
| Kapital-Provider | `#/capital` | `#/capital/provider/:provider_id` | `/api/sponsum/v1/capital/providers/:id` |
| Buchungsvorschlag | `#/accounting` | `#/accounting/:proposal_id` | `/api/sponsum/v1/accounting/:id` |
| KYC / Partei | `#/identity` | `#/identity/:party_id` | `/api/sponsum/v1/identity/:id` |
| Factor- / Institution-Node | `#/market` | `#/factors/:node_id` | `/api/sponsum/v1/factors/:id` |

Index-only (no per-row dossier): `#/hub`, `#/portfolio`, `#/risk`, `#/policy`, `#/protocol`.

## HTTP 404

Missing ids return HTTP 404:

```json
{ "error": { "code": "not_found", "message": "…" } }
```

The desk maps that to `notFoundCard`. The same lookup functions are used by
unit tests and by these GET routes.

## Workspace

`GET /api/sponsum/v1/workspace` loads the desk index (receivables, discovery,
settlements, disputes, capital, accounting, kyc, factors).
`GET /api/sponsum/v1/health` is not on this prefix; use `GET /health`.
