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
3. **Idempotenz** auf `(receivable_id, sales_invoice)` (Audit DK-31):
   - Gibt es für die Forderung schon eine offene Loan Application oder einen Loan, kommt dieser zurück (`created: false`), auch wenn die Forderung inzwischen z. B. `FINANCED` ist. Abgelehnte oder geschlossene zählen nicht.
   - Parallele Aufrufe mit demselben Schlüssel (Doppelklick, Retry während der erste Aufruf noch auf Lending wartet) teilen sich eine Übergabe; es entsteht höchstens ein Antrag. Das gilt pro API-Prozess (Sponsum läuft als ein Container).
   - Hat Lending für eine andere Sponsum-Forderung derselben Rechnung (Altbestand vor der globalen Dublettenprüfung) etwas Offenes → `invoice_already_financed`.
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

## Forderungen aus ERPNext-Rechnungen (Audit DK-31, 2026-10-08)

ERPNext bleibt System of Record der Rechnung. Eine Forderung kann mit `sales_invoice` aus einer Sales Invoice entstehen (Desk: «Gebuchte Rechnung aus ERPNext»):

- **Anlage** (`POST /receivables` → `submitReceivable`): Sponsum liest die Rechnung live über den technischen Benutzer. Nur `docstatus = 1`, keine Gutschrift (`is_return`), `outstanding_amount > 0`. Betrag, Währung, Rechnungs- und Fälligkeitsdatum sowie der Kunde (Schuldner) kommen aus ERPNext, nicht aus der Anfrage. Widerspricht Schuldner oder Firma der Rechnung → `invoice_party_mismatch`.
- **Erneute Prüfung** vor jedem Schritt, der verkauft oder finanziert: Angebot, Liquiditätsanfrage und -annahme, Gebotsannahme, Zession, Bestätigung des Kapitalbedarfs und Kreditantrag. Der offene Betrag und die Fälligkeit folgen dabei ERPNext (Teilzahlungen). Ohne Live-Prüfung verweigern diese Schritte mit `invoice_check_required`.
- **Fehler:** `invoice_not_open` (Entwurf, storniert, bezahlt, Gutschrift), `invoice_not_found` (404), `erp_unavailable` (503, Anbindung fehlt oder verweigert; fail-closed).
- **Eindeutigkeit:** Dieselbe Rechnung desselben Gläubigers und dieselbe Sales Invoice gibt es über alle Mandanten höchstens einmal (`duplicate_invoice`).
- **Rechte:** Der technische Benutzer braucht dafür zusätzlich **Lesezugriff auf Sales Invoice** (O8).

Forderungen ohne `sales_invoice` (z. B. Rechnungen von Kunden, die nicht in ERPNext liegen) bleiben manuell erfasst.

**Verkauf oder Finanzierung, nie beides** (`receivable_encumbered`):

- Ist eine Forderung mit einem bestätigten Kapitalbedarf verknüpft oder `FINANCED`, verweigern Angebot, Liquiditätsanfrage, Gebotsannahme und Zession.
- Ist eine Forderung angeboten (`LIVE`-Angebot, Sperre), gehandelt, abgetreten, nicht mehr beim Gläubiger oder schon mit einem anderen Kapitalbedarf verknüpft, verweigert die Bestätigung des Kapitalbedarfs.
- Ein bestätigter Kapitalbedarf mit Kreditantrag lässt sich erst zurückziehen, wenn Lending nichts Offenes mehr hat (abgelehnt, geschlossen); sonst bleibt die Forderung reserviert.

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
| Forderung | `wechsel_not_lendable`, `receivable_not_lendable`, `receivable_without_invoice`, `receivable_not_held_by_borrower`, `invoice_already_financed` |
| Kreditnehmer | `borrower_not_customer`, `customer_not_found` |
| Beträge | `currency_mismatch`, `invalid_amount`, `loan_amount_exceeds_receivable` |

## Verdrahtung (2026-10-03)

1. `CapitalNeed.status` kennt `CONFIRMED`; `receivable_id: string | null`, `confirmed_by`, `confirmed_at`. Ereignisse `CAPITAL_NEED_CONFIRMED` und `LENDING_APPLICATION_REQUESTED`.
2. **Bestätigen (O5):** nur die Mandantenadministration (`adminGroups`), nur mit `confirm: true`, nur mit einer eigenen Forderung des Suchenden, die die Lending-Regeln erfüllt. Idempotent für dieselbe Forderung; `already_confirmed` bei einer anderen.
3. **Kredit anlegen:** ebenfalls nur die Mandantenadministration; ruft `requestLoanApplication`.
4. **Sicherheit (O7):** nur als Referenz. Der Loan trägt die Sponsum-ID; die Zession bleibt in Sponsum. Lending hat keine Sicherheiten- oder Abschlagslogik.
5. **Eigene Forderungen der Firma (O11):** laufen über Capital Interests mit externen Anbietern, nicht über Lending (`borrower_not_customer`).
6. **Rückzahlung (O2):** Sponsum zeigt den Lending-Status nur an und verweist darauf; es gibt keinen zweiten Abschluss und keinen Statusabgleich.

7. **Kunden als Kreditnehmer (Option 1, 2026-10-03):** Movena finanziert die Forderungen seiner Kunden. `GET /lending/customers` liefert die aktiven ERPNext-Kunden der kreditgebenden Firma live über den technischen Benutzer (nur Lesen auf Customer), als `customer:<ERPNext-Name>`. Sponsum speichert davon nichts.
   - Nur die Mandantenadministration des Lending-Mandanten sieht die Liste (`MOVENA_LENDING_TENANT`, Default der Legacy-Mandant). Andere Mandanten bekommen eine leere Liste.
   - Im Desk erscheinen die Kunden beim Kapitalbedarf als „Mandant oder Kunde“ und bei „Neue Forderung“ im neuen Feld „Gläubiger“. Default bleibt die eigene Firma.
   - Damit gilt für eine solche Forderung: Kunde = Gläubiger = Halter = Suchender. Genau das verlangt die Lending-Prüfung.

8. **Lombardkredit (O12, 2026-10-03):** Seite „Lombard“ im Desk, nur für die Mandantenadministration des Lending-Mandanten.
   - Sicherheiten mit aktuellem Lending-Kurs, Abschlag und Beleihungsquote (`GET /lombard`).
   - Antrag (`POST /lombard`): Kunde, Betrag, bis zu drei Sicherheiten mit Menge, öffentliche Verwahr-Referenz. Erst wenn Lending den Entwurf der gesicherten Loan Application (Produkt `MOVENA_LENDING_LOMBARD_PRODUCT`, `is_secured_loan`, `proposed_pledges`) angenommen hat, hält Sponsum den Antrag als Kapitalbedarf der Art `LOMBARD` fest.
   - Status (`GET /lombard/:id`): Verpfändung, Maximum, Sicherheitenwert und Unterdeckung, so wie Lending sie berechnet.
   - Verwahr-Referenz: Private Schlüssel, Seeds und Hex-Schlüssel werden abgelehnt. In Lending kommt die Referenz in „Reference No“ der Loan Security Assignment.
   - Desk-Smoke: `node e2e/lombard-desk.mjs` (Headless-Chromium, API simuliert).

Noch offen für den Live-Betrieb: Kreditprodukt und Konten (O1), technischer Benutzer mit `Loan LOS User` + `Loan Reporter` + Lesezugriff auf Customer und Sales Invoice sowie die `MOVENA_LENDING_*`-Variablen in der `.env` des Dienstes (O8). Beides richtet ein Mensch ein.

Test: `node --import tsx --test apps/api/src/modules/sponsum/lending-bridge.test.ts`, oder `npm test`.
