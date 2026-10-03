# Sponsum Dispute-Werkbank

Einstieg: [https://suite.movena.ch/sponsum/#/disputes](https://suite.movena.ch/sponsum/#/disputes)

Die Dispute-Fläche orchestriert zwei Spuren am selben Asset. Sie ist keine Gerichtsakte und kein Anwaltsprogramm.

## Lebenszyklus

| Schritt | Wo | Wirkung |
|---|---|---|
| **Eröffnen** | Dispute-Liste *Neuen Streitfall eröffnen* oder Forderung → *Dispute / Resolve* | Asset wird `DISPUTED` / `PARTIALLY_DISPUTED`. Live-Angebote werden zurückgezogen. |
| **Bearbeiten** | Dossier (Zeile in der Liste) | Stufen, eSchKG, Justitia, Gerichtsstand, Formulare, Export. |
| **Schliessen** | Dossier *Fall schliessen* mit Bestätigung | Werkbank `closed`. Ausgang Einigung oder Rückzug. Forderung: wieder freigeben (`ACCEPTED`, bestritten = 0), Status belassen, oder Asset `CLOSED`. |
| **Archivieren** | Nur nach Schliessen | Aus der Offen-Liste, Dossier bleibt nachschlagbar. |
| **Wiedereröffnen** | Geschlossen oder Archiv | Asset wieder bestritten, solange nicht `PAID`/`CLOSED`. |

Justitia/eSchKG bleiben deren SoR — Schliessen in Sponsum sendet nichts an das Gericht.

| Spur | Werkzeuge | System of Record |
|---|---|---|
| Aussergerichtlich | Verhandlung, Mediation, Movena Resolve | Sponsum-Status + Resolve-Fall |
| Staatlich | eSchKG-Ref, Justitia-Postfach, Eingabe-Entwurf | eSchKG / Justitia.swiss |

## Formulare

Vorlagen erzeugen **vollständige Schreiben** (Absender, Empfänger, Betreff, Sachverhalt, Begehren).  
Stammdaten kommen aus ERPNext (Debitor/Gesellschaft, Adresse, IBAN) plus Verknüpfungen Rechnung, Asset, Zession, Resolve, eSchKG.  
Ist `OPENAI_API_KEY` gesetzt, schreibt OpenAI den Entwurf nur aus dieser Aktenlage. Ohne Key bleibt der Brief-Vorlagentext.  
Gerichtliche Vorlagen verlinken nach `/justitia/?ref=<Asset>&holder=<Holder>&origin=<Origin>`. Einreichen bleibt Confirm in Justitia. Kein Rechtsrat.

## Export an Fachpersonen

`POST /api/sponsum/v1/disputes/:id/exports` mit `{ recipient, confirm: true }` erzeugt ein ZIP:

- `manifest.json`
- `cover.pdf` (Zu Handen, Holder-Hinweis, was *nicht* enthalten ist)
- bisherige Formularentwürfe

Kein stiller Massenexport, keine Kopie der Behördenakte.

## Gerichtsstand und Fristen

Ohne Schreibgenerator: Karte **Gerichtsstand, Zuständigkeit, Fristen** auf dem Dossier. `GET /api/sponsum/v1/disputes/:id/venue?family=&from=` ermittelt unabhängig vom Formulargenerator.

- **ZPO:** Art. 9/10 Wohnsitz/Sitz der beklagten Partei, Art. 31 Erfüllungsort, Art. 197 ff. Schlichtung, Art. 243 vereinfacht ≤ CHF 30'000, Klageantwort oft 20 Tage, Berufung/Beschwerde 30 Tage (Art. 311/321; Berufung i. d. R. ab CHF 10'000).
- **StPO:** Art. 31 Tatort/Wohnsitz/Ergreifen; Einsprache Strafbefehl 10 Tage (Art. 354), Berufung 10 (Art. 399), Beschwerde 10 (Art. 396).
- **Verwaltungsrechtspflege:** verfügende Behörde, kant. Verwaltungsgericht, BVGer/BGer; 30 Tage Art. 50 VwVG / Art. 100 BGG (kantonales VRPG prüfen).
- **SchKG:** Betreibungsamt Art. 46, Rechtsvorschlag 10 Tage Art. 74.

Fristen: Tag nach Zustellung, letzter Tag auf Sa/So/eidg. Feiertag → nächster Werktag. Justitia-7-Tage-Fiktion wird ausgewiesen, Receive bleibt manuell. Kein Rechtsrat.

## Fulfillment Box

Sponsum liest die Growth-Fulfillment-Box (Gegenpartei kann Leistung bestätigen oder **Nicht-/Schlechterfüllung** monieren). Rüge, Kategorien und Kommentar stehen im Dossier und gehen in den Formulargenerator. Deep-Link zurück nach Growth. Growth bleibt SoR für die Box.

## Grenzen

- Holder (`current_holder_party_id`) gewinnt gegen Origin-Creditor.
- Kein Auto-Receive, kein PROD-Submit, keine eCH-Typen 5/6.
- Texte sind keine Rechtsberatung.
