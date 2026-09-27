# Benutzer- und Mandantentrennung

Ausgeliefert am 27.09.2026: `personal-access-20260927T140306Z`.

Die Sponsum-API verlangt eine bestätigte Suite-Sitzung. Benutzer sehen eigene und ausdrücklich freigegebene Datensätze; freigegebene Datensätze sind nur lesbar. Adminrechte gelten ausschliesslich für den explizit konfigurierten Mandanten. Bestandsdaten ohne persönlichen Eigentümer sind nur dessen Admins zugänglich.

`SPONSUM_ACCESS_CONFIG` verweist auf eine private JSON-Datei:

```json
{
  "proxySecretFile": "/private/sponsum-proxy-secret",
  "allowedOrigins": ["https://suite.example.test"],
  "legacyTenant": "tenant-a",
  "tenants": {
    "tenant-a": { "groups": ["sponsum-a"], "adminGroups": ["sponsum-admin-a"] }
  }
}
```

Nur der authentifizierte Proxy setzt `X-Movena-Proxy-Secret`, `X-Movena-Tenant-Id`, `X-Movena-Subject`, `X-Movena-Email` und `X-Movena-Groups`. Der Mandant kommt aus der registrierten Serverzuordnung. Clientseitige Mandanten-, Rollen- oder Eigentümer-Overrides werden abgelehnt. Konfiguration wird pro Anfrage gelesen; ohne sie ist die API gesperrt.

`access-context.ts` isoliert jede Anfrage, `scoped-store.ts` filtert Datensätze und Beziehungen vor Zählungen, Dossiers und Downloads. POST sieht nur schreibberechtigte Datensätze, also auch vor externen Formular-/Signaturaktionen. Der Store erhält fremde Datensätze und verweigert veraltete oder manipulierte Snapshots. Partei-IDs bei KYC und Käuferprofilen sind intern mandantengebunden. GET führt keine Datenspeicherung oder automatische Demo-Erzeugung durch.

`GET /api/sponsum/v1/session` zeigt die eigene bestätigte Identität. Eigentümer und Mandanten-Admins können über `POST /api/sponsum/v1/access/assets/:id` oder `/access/capital_needs/:id` mit `{ "readers": ["SSO-Subject"] }` Lesefreigaben setzen; eine leere Liste widerruft sie. Auch eine Freigabe an eine bekannte ID erlaubt keinen Zugriff aus einem anderen Mandanten. KYC und Providerbestätigungen erfordern Mandantenadministration. Externe Provider brauchen künftig eine separate, explizit verifizierte Dienstanbindung.

Die ursprünglichen globalen ERP-Parteisuchen und Fulfilment-Dateizugriffe sind in persönlichen Anfragen gesperrt. Parteien werden aus dem berechtigten Sponsum-Bestand abgeleitet. Die Suite-KI greift mit derselben verifizierten Identität auf diese API zu.

## Tests und vorhandene Vorarbeiten

59 Unit-Tests und 3 relevante HTTP-Tests bestanden. Der Live-Zugriff über die echte Suite-Sitzung und die Abweisung von Header-/Mandanten-Manipulationen sind geprüft. Testdaten wurden ausschliesslich in temporären Stores erzeugt.

Der umfassende Typecheck enthält fünf vorher bestehende Fehler in `dispute-workbench.ts`, `skribble.ts` sowie kollidierende Typdeklarationen in `service.ts`. Die alte Prisma-HTTP-Integration benötigt eine nicht verfügbare lokale Datenbank. Diese Baseline ist nicht als bestanden markiert.

Der Arbeitsbaum enthielt beim Start umfangreiche, bereits live verwendete Vorarbeiten inklusive noch unversionierter Laufzeitmodule. Im Index werden nur unsere Sicherheitserweiterungen der bereits versionierten Dateien aufgenommen. Vier Schutzänderungen an der noch nicht committeten Workbench sind zusätzlich in `access-preexisting-workbench.patch` versioniert. Sie sind im jetzigen Arbeitsbaum und Live-Release bereits angewendet. Wenn diese Vorarbeiten später separat committet werden, müssen diese vier Änderungen erhalten bleiben; sie verhindern GET-Schreibzugriffe, globale Fulfilment-Abfragen und die Nutzung fremder Parteien-Caches.

Die Änderung enthält keine Secrets und erzeugt keine neuen Fachsystem-Konten oder fachlichen Produktivdatensätze.
