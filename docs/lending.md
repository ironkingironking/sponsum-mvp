# Sponsum ↔ Frappe Lending

**Stand:** 2026-10-03. Verdrahtet: Bestätigung, Kreditantrag und Status in Kapitalbedarf, Route und Desk. Live antwortet Lending mit `lending_not_configured`, bis Kreditprodukt (O1) und technischer Benutzer (O8) stehen.
**Entscheidung:** movena-suite `docs/architecture/frappe-lending.md`, Runbook `docs/runbooks/frappe-lending.md`

## Schnitt

| Gegenstand | System of Record |
|---|---|
| Forderung (ReceivableAsset), Halter, Zession, Handel, Settlement, Dispute, Wechsel, Kapitalbedarf | Sponsum |
| Loan Application, Loan, Auszahlung, Tilgungsplan, Zins, Klassifikation | Frappe Lending auf `erp.movena.ch` |
| Customer, Sales Invoice, Buchungen | ERPNext auf `erp.movena.ch` |

- Sponsum legt höchstens **einen Entwurf einer Loan Application pro Forderung** an und liest den Kreditstatus live aus Lending.
- Sponsum rechnet keine Zinsen, Tilgungen oder Salden, führt kein zweites Journal und kopiert den Tilgungsplan nicht.
- Beträge werden so angezeigt, wie Lending sie liefert.
- Der Justitia-Vertrag (Sendung ↔ ReceivableAsset) bleibt unverändert.

## Code

| Datei | Inhalt |
|---|---|
| `apps/api/src/modules/sponsum/lending-bridge.ts` | `lendingConfigFromEnv`, `createHttpLendingTransport` (Frappe REST), `assertLendable`, `requestLoanApplication`, `readLendingStatus` |
| `apps/api/src/modules/sponsum/lending-mock.ts` | In-Memory-Lending für Tests und lokale Entwicklung, inklusive Mapping Antrag → Loan und Tilgungsplan |
| `apps/api/src/modules/sponsum/lending-bridge.test.ts` | 10 Tests, ohne Netzwerk |
| `apps/api/src/modules/sponsum/service.ts` | `confirmCapitalNeed`, `requestCapitalNeedLoan`, `receivableLending`; `LendingError` wird zu `DomainError` mit gleichem Code; `setLendingDeps` für Tests |
| `apps/api/src/modules/sponsum/route.ts` | `POST /capital/needs/:id/confirm`, `POST /capital/needs/:id/lending`, `GET /receivables/:id/lending`; `lending_not_configured`/`lending_unreachable` → 503, `lending_forbidden` → 502, `confirmation_required`/`invalid_amount` → 400 |
| `apps/api/public/sponsum/sponsum-desk.js` | Karte „Frappe Lending“ im Dossier des Kapitalbedarfs: Bestätigen (Auswahl der eigenen Forderungen), „Kredit in Lending anlegen“, Status mit Quelle und Deep-Link |
| `apps/api/src/modules/sponsum/capital-lending.test.ts`, `capital-lending.integration.ts` | Service- und HTTP-Tests der Verdrahtung |

Die Module sind bewusst eigenständig: Sie importieren weder `store.ts` noch `@sponsum/shared` und lassen sich so getrennt von der uncommitteten Desk-Arbeit committen.

## Übergabe „Kredit in Lending anlegen“

Ablauf von `requestLoanApplication({ need, receivable, confirm: true }, deps)`:

1. **Bestätigung:** ohne `confirm: true` → `confirmation_required`.
2. **Einrichtung:** Fehlt die Lending-Konfiguration → `lending_not_configured`. Das ist der heutige Zustand, solange Kreditprodukt und Konten nicht entschieden sind (O1).
3. **Idempotenz:** Gibt es für die Forderung schon eine offene Loan Application oder einen Loan, kommt dieser zurück (`created: false`), auch wenn die Forderung inzwischen z. B. `FINANCED` ist. Abgelehnte oder geschlossene zählen nicht.
4. **Eignung**, geprüft von Sponsum, bevor etwas geschrieben wird:
   - Kapitalbedarf `CONFIRMED` (O5) und als `SHORT_DEBT` oder `LONG_DEBT`, verknüpft mit genau dieser Forderung
   - kein Wechsel, also weder `LEGAL_BILL_OF_EXCHANGE` noch `BITCREDIT_EBILL` (O3)
   - Forderung `VERIFIED`, `ACCEPTED` oder `PARTIALLY_PAID`, mit ERPNext-Rechnung
   - Kreditnehmer (O6) ist der Suchende; er muss Gläubiger und aktueller Halter der Forderung sein (`current_holder_party_id`) und als `customer:<Name>` ein ERPNext-Kunde
   - gleiche Währung; Betrag > 0 und höchstens `outstanding_amount`
5. **Kunde:** Er muss in ERPNext existieren, sonst `customer_not_found`.
6. **Anlage** des Entwurfs `Loan Application`:
   - `applicant_type=Customer`, `applicant`
   - `company` und `loan_product` aus der Konfiguration
   - `loan_amount`, `posting_date`
   - `movena_sponsum_receivable_id`, `movena_sponsum_capital_need_id`
   - **Kein** Zinssatz, keine Konten, kein Plan: Die kommen aus dem Loan Product in Lending.
7. **Rückgabe:** `deep_link` auf `https://erp.movena.ch/desk/loan-application/<name>` bzw. `/desk/loan/<name>`.

Lending modelliert die ERPNext-Firma als Kreditgeberin. Ist die Forderung eine eigene Forderung der Firma (`company:<Firma>`), lehnt die Brücke sie mit `borrower_not_customer` ab: Movena kann in Lending nicht bei sich selbst Kredit aufnehmen. Solche Fälle bleiben Capital Interests mit externen Anbietern.

Prüfung, Genehmigung, Auszahlung und Buchung laufen in Lending. Die Felder `movena_sponsum_*` gehen dabei per Mapping vom Antrag auf den Loan über; das liefert `movena_debtors` in Welle 2.

## Status (read-only)

`readLendingStatus(receivableId, deps)` liefert drei Fälle:

- **Phase Antrag:** `stage: "APPLICATION"` mit Name und Status
- **Phase Kredit:** `stage: "LOAN"` mit
  - `status`, `loan_amount`, `disbursed_amount`, `total_amount_paid` und `total_payment`, wie Lending sie liefert
  - der nächsten Rate aus dem aktiven `Loan Repayment Schedule` von Lending
  - Quelle `LENDING · Loan` und `deep_link`
- **Nichts in Lending:** `null`

## Konfiguration

Nur Namen, keine Werte im Repo:

| Variable | Inhalt |
|---|---|
| `MOVENA_LENDING_URL` | z. B. `https://erp.movena.ch` |
| `MOVENA_LENDING_SITE` | optional, Frappe-Site-Header |
| `MOVENA_LENDING_CREDENTIALS_FILE` | Datei mit einer Zeile `<API_KEY>:<API_SECRET>` des technischen ERPNext-Benutzers mit Lending-Rolle (O8). Den Benutzer legt ein Mensch an; die Datei kommt aus dem Secret-Store. |
| `MOVENA_LENDING_COMPANY` | ERPNext-Firma, die als Kreditgeberin bucht |
| `MOVENA_LENDING_LOAN_PRODUCT` | Loan Product (O1) |

## Fehlercodes

Stabil, Meldungen auf Deutsch.

| Gruppe | Codes |
|---|---|
| Einrichtung und Verbindung | `lending_not_configured`, `lending_unreachable` (Netzwerk, 5xx), `lending_forbidden` (401/403), `lending_rejected` (andere 4xx, mit der ersten Zeile von Frappes Meldung, ohne Traceback und ohne Zugangsdaten) |
| Bestätigung | `confirmation_required` |
| Kapitalbedarf | `capital_need_not_confirmed`, `capital_need_not_debt`, `capital_need_receivable_mismatch` |
| Forderung | `wechsel_not_lendable`, `receivable_not_lendable`, `receivable_without_invoice`, `receivable_not_held_by_borrower` |
| Kreditnehmer | `borrower_not_customer`, `customer_not_found` |
| Beträge | `currency_mismatch`, `invalid_amount`, `loan_amount_exceeds_receivable` |

## Verdrahtung (2026-10-03)

1. `CapitalNeed.status` kennt `CONFIRMED`; `receivable_id: string | null`, `confirmed_by`, `confirmed_at`. Ereignisse `CAPITAL_NEED_CONFIRMED` und `LENDING_APPLICATION_REQUESTED`.
2. **Bestätigen (O5):** nur die Mandantenadministration (`adminGroups`), nur mit `confirm: true`, nur mit einer eigenen Forderung des Suchenden, die die Lending-Regeln erfüllt. Idempotent für dieselbe Forderung; `already_confirmed` bei einer anderen.
3. **Kredit anlegen:** ebenfalls nur die Mandantenadministration; ruft `requestLoanApplication`.
4. **Sicherheit (O7):** nur als Referenz. Der Loan trägt die Sponsum-ID; die Zession bleibt in Sponsum. Lending hat keine Sicherheiten- oder Abschlagslogik.
5. **Eigene Forderungen der Firma (O11):** laufen über Capital Interests mit externen Anbietern, nicht über Lending (`borrower_not_customer`).
6. **Rückzahlung (O2):** Sponsum zeigt den Lending-Status nur an und verweist darauf; es gibt keinen zweiten Abschluss und keinen Statusabgleich.

Noch offen für den Live-Betrieb: Kreditprodukt und Konten (O1), technischer Benutzer mit `Loan LOS User` + `Loan Reporter` + Lesezugriff auf Customer sowie die `MOVENA_LENDING_*`-Variablen in der `.env` des Dienstes (O8). Beides richtet ein Mensch ein.

Test: `node --import tsx --test apps/api/src/modules/sponsum/lending-bridge.test.ts`, oder `npm test`.
