const API = "/api/sponsum/v1";
const SELLER = "seller-ui";
const main = document.getElementById("sp-main");
let workspace = null;
let lastError = "";
let busy = false;

const STATUS_LABELS = {
  UNVERIFIED: "Ungeprüft",
  VERIFIED: "Geprüft",
  ACCEPTED: "Akzeptiert",
  PARTIALLY_DISPUTED: "Teilweise bestritten",
  DISPUTED: "Bestritten",
  OFFERED: "Angeboten",
  TRADE_LOCKED: "Im Abschluss",
  FINANCED: "Finanziert",
  TRANSFERRED: "Übertragen",
  PARTIALLY_PAID: "Teilbezahlt",
  PAID: "Bezahlt",
  DEFAULTED: "Ausgefallen",
  CLOSED: "Geschlossen",
  LIVE: "Aktiv",
  DRAFT: "Entwurf",
  WITHDRAWN: "Zurückgezogen",
  TRADED: "Gehandelt",
  EXPIRED: "Abgelaufen",
  OPEN: "Offen",
  COUNTERED: "Gegenvorschlag",
  LAPSED: "Verfallen",
  CREATED: "Erstellt",
  INSTRUCTION_ISSUED: "Zahlung angewiesen",
  SETTLEMENT_PENDING: "Zahlung ausstehend",
  SETTLEMENT_CONFIRMED: "Zahlung bestätigt",
  ASSIGNMENT_EFFECTIVE: "Zession wirksam",
  COMPLETED: "Abgeschlossen",
  SETTLEMENT_FAILED: "Zahlung fehlgeschlagen",
  DISPUTED_SETTLEMENT: "Zahlungsstreit",
  CANCELLED: "Storniert",
  ISSUED: "Ausgestellt",
  SEEN: "Erfasst",
  CONFIRMED: "Bestätigt",
  PARTIAL: "Teilzahlung",
  FAILED: "Fehlgeschlagen",
  MISMATCH: "Betrag weicht ab",
  UNLOCKED: "Frei",
  OFFER_LOCK: "Angebotssperre",
  TRADE_LOCK: "Abschlusssperre",
  ASSIGNED: "Abgetreten",
  PASSED: "Bestanden",
  NONE: "Keine",
  PENDING: "Ausstehend",
  PROPOSED: "Vorgeschlagen",
  POSTED: "Gebucht",
  REJECTED: "Abgelehnt",
  EFFECTIVE: "Wirksam",
  RESERVED: "Reserviert",
  ACTIVE: "Aktiv",
  RELEASED: "Freigegeben",
  SUPERSEDED: "Ersetzt",
  NOT_A_BILL_OF_EXCHANGE: "Kein Wechsel nach OR",
  NOT_A_WECHSELAVAL: "Kein Wechselaval",
  COMMERCIAL_ACKNOWLEDGEMENT: "Kaufmännische Anerkennung",
  ACKNOWLEDGED: "Bezogener bestätigt",
  SECURED: "Gesichert",
  SURETY: "Bürgschaft",
  GUARANTEE: "Garantie",
  ALLOW: "Erlaubt",
  DENY: "Gesperrt",
  FLAG: "Kennzeichnung",
  TRUE_SALE: "Echter Verkauf",
  WITH_RECOURSE: "Mit Regress",
  WITHOUT_RECOURSE: "Ohne Regress",
  SILENT: "Still",
  ORDINARY_RECEIVABLE: "Gewöhnliche Forderung",
  ASSIGNED_RECEIVABLE: "Abgetretene Forderung",
  ELECTRONIC_TRADE_INSTRUMENT: "Elektronischer Handelsbeleg",
  REGISTER_RIGHT: "Registerwertrecht",
  LEGAL_BILL_OF_EXCHANGE: "Gesetzlicher Wechsel",
  EQUITY: "Eigenkapital",
  SHORT_DEBT: "Kurzfristiges FK",
  LONG_DEBT: "Langfristiges FK",
  INVESTOR: "Investor",
  LENDER: "Gläubiger",
  FAMILY_OFFICE: "Family Office",
  INTRODUCED: "Vorgespräch",
  GEZOGEN: "Gezogener Wechsel",
  SOLA: "Solawechsel",
  HANDELSWECHSEL: "Handelswechsel",
  FINANZWECHSEL: "Finanzwechsel",
  TAGWECHSEL: "Tagwechsel",
  SICHTWECHSEL: "Sichtwechsel",
  NACHSICHTWECHSEL: "Nachsichtwechsel",
  PENDING: "Ausstehend",
  SES: "Einfache Signatur (SES)",
  QES: "Qualifizierte Signatur (QES)",
  DRAWER: "Aussteller",
  DRAWEE: "Bezogener",
  TRANSFEROR: "Zedent",
  TRANSFEREE: "Zessionar",
  SUITE_CONFIRM: "Bestätigung in der Suite",
  negotiation: "Verhandlung",
  mediation: "Mediation",
  resolve: "Movena Resolve",
  settled: "Verglichen",
  withdrawn: "Zurückgezogen",
  idle: "Noch nicht eröffnet",
  eschkg: "eSchKG / Betreibung",
  justitia_inbox: "Justitia-Zustellung",
  justitia_filed: "Justitia-Eingabe",
  open: "Offen",
  closed: "Geschlossen",
  archived: "Archiviert",
  restore: "Forderung wieder freigeben",
  close_asset: "Forderung schliessen",
  keep: "Forderungsstatus belassen"
};

function labelOf(code) {
  if (code == null || code === "") return "—";
  return STATUS_LABELS[code] || String(code).replaceAll("_", " ");
}

function formatChf(value, currency = "CHF") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${currency} ${new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function daysLeft(date) {
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const end = match ? Date.UTC(+match[1], +match[2] - 1, +match[3]) : Date.parse(date);
  if (!Number.isFinite(end)) return 0;
  const start = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  return Math.max(0, Math.round((end - start) / 86400000));
}

function formatDue(iso) {
  return `${formatDate(iso)} (${daysLeft(iso)} Tage)`;
}

function formatIban(iban) {
  const compact = String(iban || "").replace(/\s+/g, "");
  if (!compact) return "—";
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

function badge(status) {
  const code = String(status || "");
  const danger = /DISPUTE|DEFAULT|FAILED|DENIED|DENY|MISMATCH/.test(code);
  const warn = /VERIFIED|PENDING|FLAG|OFFER|LOCK|ISSUED|SEEN/.test(code);
  const ok = /ACCEPTED|COMPLETED|TRANSFERRED|CONFIRMED|PASSED|ALLOW|EFFECTIVE|PAID/.test(code);
  const cls = danger ? "danger" : warn ? "warn" : ok ? "ok" : "";
  return `<span class="badge ${cls}" title="${code}"><span class="visually-hidden">Status: </span>${labelOf(code)}</span>`;
}

function policyBadge(value) {
  return `<span class="badge ${String(value).toLowerCase()}"><span class="visually-hidden">Regel: </span>${labelOf(value)}</span>`;
}

function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" class="muted">${text}</td></tr>`;
}

async function api(path, options) {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 55000);
  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(options && options.headers) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((body.error && (body.error.message || body.error.code)) || `HTTP ${response.status}`);
    }
    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Zeitüberschreitung: der Entwurf konnte nicht erzeugt werden.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function downloadPath(path, filename) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body.error && (body.error.message || body.error.code)) || `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadWorkspace() {
  workspace = await api("/workspace");
  try {
    workspace.parties = await api("/parties");
  } catch {
    workspace.parties = { companies: [], customers: [] };
  }
  return workspace;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function allParties() {
  const parties = workspace?.parties || {};
  return [...(parties.companies || []), ...(parties.customers || [])];
}

function partyLabel(id) {
  if (!id) return "—";
  const row = allParties().find((item) => item.id === id || item.name === id || item.erp_name === id);
  return row ? row.name : String(id).replace(/^(company|customer):/, "");
}

function preferredCompany() {
  const companies = workspace?.parties?.companies || [];
  return (companies.find((row) => /movena/i.test(row.name)) || companies[0] || {}).name || "";
}

function partyCity(id) {
  const row = allParties().find((item) => item.id === id || item.name === id || item.erp_name === id);
  if (!row) return "";
  if (row.city) return row.city;
  const territory = String(row.territory || "");
  if (territory && !/^(schweiz|switzerland|all territories)$/i.test(territory)) return territory;
  return "";
}

function partyOptions(selected, { companies = true, customers = true, emptyLabel = "wählen…" } = {}) {
  const companyRows = companies ? workspace?.parties?.companies || [] : [];
  const customerRows = customers ? workspace?.parties?.customers || [] : [];
  const groups = [];
  const option = (row) => {
    const chosen = row.id === selected || row.name === selected || row.erp_name === selected;
    return `<option value="${esc(row.name)}" data-id="${esc(row.id)}" data-city="${esc(row.city || "")}" ${chosen ? "selected" : ""}>${esc(row.name)}</option>`;
  };
  if (companyRows.length) {
    groups.push(`<optgroup label="Gesellschaft aus ERPNext">${companyRows.map(option).join("")}</optgroup>`);
  }
  if (customerRows.length) {
    groups.push(`<optgroup label="Debitor aus ERPNext">${customerRows.map(option).join("")}</optgroup>`);
  }
  if (!groups.length) {
    return `<option value="">Keine Stammdaten — ERPNext nicht erreichbar</option>`;
  }
  return `<option value="">${esc(emptyLabel)}</option>${groups.join("")}`;
}

function stammdatenHint() {
  const parties = workspace?.parties || {};
  const companies = (parties.companies || []).length;
  const customers = (parties.customers || []).length;
  const source = parties.source === "erpnext" ? "ERPNext" : companies || customers ? "lokaler Bestand" : "nicht geladen";
  return `<p class="muted">Stammdaten: ${source} · ${companies} Gesellschaft${companies === 1 ? "" : "en"} · ${customers} Debitor${customers === 1 ? "" : "en"} (Customer / Company). Keine Freitexte.</p>`;
}

function navKey() {
  const hash = (window.location.hash || "#/hub").split("?")[0];
  if (hash.startsWith("#/receivables/")) return "receivables";
  if (hash.startsWith("#/wechsel")) return "wechsel";
  if (hash.startsWith("#/market/")) return "market";
  if (hash.startsWith("#/factors/")) return "market";
  if (hash.startsWith("#/disputes/")) return "disputes";
  if (hash.startsWith("#/settlement/")) return "settlement";
  if (hash.startsWith("#/zession/")) return "zession";
  if (hash.startsWith("#/capital/")) return "capital";
  if (hash.startsWith("#/accounting/")) return "accounting";
  if (hash.startsWith("#/identity/")) return "identity";
  return hash.replace("#/", "").split("/")[0] || "hub";
}

function setNav() {
  const key = navKey();
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("data-nav") === key);
  });
}

async function route() {
  setNav();
  try {
    if (!workspace) {
      main.innerHTML = `<p class="muted" role="status">Wird geladen…</p>`;
      await loadWorkspace();
    }
    const hash = window.location.hash || "#/hub";
    const dossier = hash.match(/^#\/receivables\/([^/?]+)/);
    if (dossier) return renderDossier(decodeURIComponent(dossier[1]));
    const wechsel = hash.match(/^#\/wechsel\/([^/?]+)/);
    if (wechsel) return renderWechselDossier(decodeURIComponent(wechsel[1]));
    const offer = hash.match(/^#\/market\/([^/?]+)/);
    if (offer) return renderOfferDetail(decodeURIComponent(offer[1]));
    const dispute = hash.match(/^#\/disputes\/([^/?]+)/);
    if (dispute) return renderDisputeDossier(decodeURIComponent(dispute[1]));
    if (hash === "#/settlement" || hash.startsWith("#/settlement/")) return renderSettlement();
    const zession = hash.match(/^#\/zession\/([^/?]+)/);
    if (zession) return renderZessionDossier(decodeURIComponent(zession[1]));
    const capitalNeed = hash.match(/^#\/capital\/need\/([^/?]+)/);
    if (capitalNeed) return renderCapitalNeedDossier(decodeURIComponent(capitalNeed[1]));
    const capitalProvider = hash.match(/^#\/capital\/provider\/([^/?]+)/);
    if (capitalProvider) return renderCapitalProviderDossier(decodeURIComponent(capitalProvider[1]));
    const accounting = hash.match(/^#\/accounting\/([^/?]+)/);
    if (accounting) return renderAccountingDossier(decodeURIComponent(accounting[1]));
    const identity = hash.match(/^#\/identity\/([^/?]+)/);
    if (identity) return renderIdentityDossier(decodeURIComponent(identity[1]));
    const factor = hash.match(/^#\/factors\/([^/?]+)/);
    if (factor) return renderFactorDossier(decodeURIComponent(factor[1]));
    const views = {
      hub: renderHub,
      receivables: renderReceivables,
      zession: renderZession,
      wechsel: renderWechsel,
      capital: renderCapital,
      market: renderMarket,
      portfolio: renderPortfolio,
      settlement: renderSettlement,
      disputes: renderDisputes,
      accounting: renderAccounting,
      risk: renderRisk,
      policy: renderPolicy,
      protocol: renderProtocol,
      identity: renderIdentity
    };
    (views[navKey()] || renderHub)();
  } catch (error) {
    main.innerHTML = `<section class="card"><h1>Sponsum</h1><p class="error">${error.message}</p></section>`;
  }
}

function errorLine() {
  return lastError ? `<p class="error" role="alert">${esc(lastError)}</p>` : "";
}

function notFoundCard(title, message, backHref, backLabel) {
  return `<section class="card">
    <p class="muted"><a href="${backHref}">← ${esc(backLabel)}</a></p>
    <h1>${esc(title)}</h1>
    <p class="error">${esc(message)}</p>
  </section>`;
}

function bindClickableRows(root = main) {
  root.querySelectorAll("tr.clickable[data-href]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, input, select, label")) return;
      window.location.hash = row.getAttribute("data-href");
    });
  });
}

function eventTable(events) {
  return `<table>
    <thead><tr><th>Zeit</th><th>Event</th><th>Hash</th></tr></thead>
    <tbody>
      ${
        (events || []).length
          ? events
              .map(
                (event) => `<tr>
            <td>${formatDate(event.created_at)} ${String(event.created_at || "").slice(11, 16)}</td>
            <td>${event.event_type}</td>
            <td class="mono">${(event.event_hash || "").slice(0, 14)}</td>
          </tr>`
              )
              .join("")
          : emptyRow(3, "Keine Ereignisse.")
      }
    </tbody>
  </table>`;
}

function renderVenueCard(venue, bench) {
  if (!venue) {
    return `<section class="card" id="venue-card"><h2>Gerichtsstand und Fristen</h2><p class="muted">Keine Ermittlung.</p></section>`;
  }
  const due = (row) =>
    row.due ? row.due.slice(8, 10) + "." + row.due.slice(5, 7) + "." + row.due.slice(0, 4) : "Startdatum fehlt";
  const startValue = bench?.deadline_start || venue.deadlines?.find((row) => row.start)?.start || "";
  return `<section class="card" id="venue-card">
    <h2>Gerichtsstand, Zuständigkeit, Fristen</h2>
    <p class="muted">Unabhängig vom Formulargenerator. Kein Schreiben nötig. Kein Rechtsrat.</p>
    <p>${esc(venue.family_label)}${venue.inferred ? " · automatisch aus Aktenlage" : ""} · ${esc(venue.canton || "Kanton offen")} (${esc(venue.canton_source || "")})</p>
    ${venue.procedure ? `<p>${esc(venue.procedure)}</p>` : ""}
    <form id="venue-form" class="stack" action="#" method="get">
      <div class="grid-2">
        <label>Rechtsgebiet
          <select name="family" id="venue-family">
            <option value="zpo" ${venue.family === "zpo" ? "selected" : ""}>ZPO Zivil</option>
            <option value="stpo" ${venue.family === "stpo" ? "selected" : ""}>StPO Straf</option>
            <option value="admin" ${venue.family === "admin" ? "selected" : ""}>Verwaltungsrechtspflege</option>
            <option value="schkg" ${venue.family === "schkg" ? "selected" : ""}>SchKG Betreibung</option>
          </select>
        </label>
        <label>Fristbeginn (Zustellung)
          <input type="date" name="from" id="venue-from" value="${esc(startValue)}" />
        </label>
      </div>
      <div class="actions"><button class="btn ghost" id="venue-btn" type="button">Neu ermitteln</button></div>
      <p class="muted" id="venue-status" role="status"></p>
    </form>
    <div class="grid-2">
      <div>
        <h3>Gerichtsstände</h3>
        ${(venue.venues || []).map((row) => `<p><strong>${esc(row.title)}</strong><br><span class="muted">${esc(row.basis)} — ${esc(row.detail)}</span></p>`).join("")}
      </div>
      <div>
        <h3>Behörden / Zuständigkeit</h3>
        ${(venue.authorities || []).map((row) => `<p><strong>${esc(row.title)}</strong><br><span class="muted">${esc(row.basis)} — ${esc(row.detail)}</span></p>`).join("")}
      </div>
    </div>
    <h3>Fristen</h3>
    <table>
      <thead><tr><th>Frist</th><th>Tage</th><th>Grundlage</th><th>Ablauf</th></tr></thead>
      <tbody>
        ${(venue.deadlines || [])
          .map(
            (row) =>
              `<tr><td>${esc(row.title)}</td><td>${row.days}</td><td>${esc(row.basis)}</td><td>${esc(due(row))}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
    <p class="muted">${esc(venue.disclaimer)}</p>
  </section>`;
}

function renderDisputeLifecycleCard(bench, asset) {
  const life = bench.lifecycle || "open";
  if (life === "archived") {
    return `<section class="card">
      <h2>Archiv</h2>
      <p>Geschlossen ${esc(formatDate(bench.closed_at))} · Archiviert ${esc(formatDate(bench.archived_at))}${bench.close_outcome ? ` · ${labelOf(bench.close_outcome)}` : ""}.</p>
      <p class="muted">Nur noch nachschlagen. Justitia/eSchKG bleiben deren Systeme of Record.</p>
      <form id="dispute-reopen-form" class="stack">
        <label>Bestrittener Betrag
          <input name="disputed_amount" type="number" min="0.01" step="0.01" value="${esc(asset.disputed_amount && Number(asset.disputed_amount) > 0 ? asset.disputed_amount : "")}" placeholder="z. B. 10000" />
        </label>
        <div class="actions"><button class="btn" type="submit">Wiedereröffnen</button></div>
      </form>
    </section>`;
  }
  if (life === "closed") {
    return `<section class="card">
      <h2>Geschlossen</h2>
      <p>${badge(bench.close_outcome || "closed")} am ${esc(formatDate(bench.closed_at))}. Forderung steht auf ${badge(asset.status)}.</p>
      <p class="muted">Schliessen beendet nur die Sponsum-Werkbank. Justitia-Sendungen bleiben dort.</p>
      <div class="actions">
        <button class="btn" type="button" id="dispute-archive-btn">Ins Archiv legen</button>
      </div>
      <form id="dispute-reopen-form" class="stack">
        <label>Bestrittener Betrag bei Wiedereröffnung
          <input name="disputed_amount" type="number" min="0.01" step="0.01" value="${esc(asset.disputed_amount && Number(asset.disputed_amount) > 0 ? asset.disputed_amount : "")}" placeholder="z. B. 10000" />
        </label>
        <div class="actions"><button class="btn ghost" type="submit">Wiedereröffnen</button></div>
      </form>
    </section>`;
  }
  return `<section class="card">
    <h2>Fall schliessen</h2>
    <p class="muted">Stufe «Verglichen» allein schliesst den Fall nicht. Abschluss mit Bestätigung. Danach kann archiviert werden.</p>
    <form id="dispute-close-form" class="stack">
      <div class="grid-2">
        <label>Ausgang
          <select name="outcome" required>
            <option value="settled">Einigung / verglichen</option>
            <option value="withdrawn">Zurückgezogen</option>
          </select>
        </label>
        <label>Forderung danach
          <select name="asset_action">
            <option value="restore">Wieder freigeben (ACCEPTED, bestritten = 0)</option>
            <option value="keep">Status belassen (weiter bestritten)</option>
            <option value="close_asset">Forderung schliessen (CLOSED)</option>
          </select>
        </label>
      </div>
      <label class="check"><input type="checkbox" name="confirm" required /> Ich schliesse den Streitfall ausdrücklich.</label>
      <div class="actions"><button class="btn" type="submit">Streitfall schliessen</button></div>
    </form>
  </section>`;
}

function bindDisputeLifecycle(receivableId) {
  const closeForm = document.getElementById("dispute-close-form");
  if (closeForm) {
    closeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(closeForm).entries());
      act(
        () =>
          api(`/disputes/${encodeURIComponent(receivableId)}/close`, {
            method: "POST",
            body: JSON.stringify({
              confirm: data.confirm === "on",
              outcome: data.outcome,
              asset_action: data.asset_action
            })
          }),
        "Streitfall schliessen? Das beendet die Sponsum-Werkbank, nicht automatisch Justitia."
      );
    });
  }
  const archiveBtn = document.getElementById("dispute-archive-btn");
  if (archiveBtn) {
    archiveBtn.addEventListener("click", () => {
      act(
        () =>
          api(`/disputes/${encodeURIComponent(receivableId)}/archive`, {
            method: "POST",
            body: JSON.stringify({ confirm: true })
          }),
        "In das Archiv legen? Der Fall bleibt nachschlagbar."
      );
    });
  }
  const reopenForm = document.getElementById("dispute-reopen-form");
  if (reopenForm) {
    reopenForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(reopenForm).entries());
      act(
        () =>
          api(`/disputes/${encodeURIComponent(receivableId)}/reopen`, {
            method: "POST",
            body: JSON.stringify({ disputed_amount: data.disputed_amount || undefined })
          }),
        "Streitfall wiedereröffnen? Die Forderung gilt erneut als bestritten."
      );
    });
  }
}

function bindVenueCard(receivableId, bench) {
  const host = document.getElementById("venue-card-host");
  if (!host) return;
  const familyEl = document.getElementById("venue-family");
  const fromEl = document.getElementById("venue-from");
  const btn = document.getElementById("venue-btn");
  const form = document.getElementById("venue-form");
  const status = document.getElementById("venue-status");

  async function assess(persist) {
    const family = familyEl?.value || "";
    const from = fromEl?.value || "";
    if (status) status.textContent = persist ? "Speichere und ermittle…" : "Ermittle Gerichtsstand und Fristen…";
    try {
      if (persist) {
        await api(`/disputes/${encodeURIComponent(receivableId)}/track`, {
          method: "POST",
          body: JSON.stringify({ procedure_family: family || null, deadline_start: from || null })
        });
      }
      const query = new URLSearchParams();
      if (family) query.set("family", family);
      if (from) query.set("from", from);
      const venue = await api(`/disputes/${encodeURIComponent(receivableId)}/venue?${query.toString()}`);
      const nextBench = { ...bench, procedure_family: family || null, deadline_start: from || null };
      host.innerHTML = renderVenueCard(venue, nextBench);
      bindVenueCard(receivableId, nextBench);
      const nextStatus = document.getElementById("venue-status");
      if (nextStatus) nextStatus.textContent = persist ? "Gespeichert. Ohne Schreiben ermittelt." : "Aktualisiert. Ohne Schreiben ermittelt.";
    } catch (error) {
      if (status) status.textContent = error.message || "Ermittlung fehlgeschlagen.";
    }
  }

  if (btn) {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      void assess(true);
    });
  }
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void assess(true);
    });
  }
  if (familyEl) {
    familyEl.addEventListener("change", () => {
      void assess(false);
    });
  }
}

function monitionLabel(kind) {
  return {
    none: "Keine Rüge",
    nichterfuellung: "Nichterfüllung",
    schlechterfuellung: "Schlechterfüllung",
    beides: "Nicht- und Schlechterfüllung",
    sonstige: "Sonstige Rüge"
  }[kind] || kind || "—";
}

function renderFulfilmentCard(box) {
  if (!box) {
    return `<section class="card">
      <h2>Fulfillment Box</h2>
      <p class="muted">Keine Fulfillment Box zur Rechnung gefunden. Die Gegenpartei kann Nicht- und Schlechterfüllung dort rügen.</p>
      <p><a class="btn ghost" href="https://suite.movena.ch/growth/#/deals">In Growth öffnen</a></p>
    </section>`;
  }
  const m = box.monition || {};
  const kind = m.kind || "none";
  return `<section class="card">
    <h2>Fulfillment Box</h2>
    <p>Fall ${esc(box.id)} · ${badge(box.status)} · Gate ${esc(box.billing_gate || "—")} · Checkliste ${box.progress?.done || 0}/${box.progress?.required || 0}</p>
    <p><strong>${esc(monitionLabel(kind))}</strong>${
      (m.labels || []).length ? ` · ${esc(m.labels.join(", "))}` : ""
    }</p>
    ${m.comment ? `<p>${esc(m.comment)}</p>` : "<p class='muted'>Die Gegenpartei hat noch keine Nicht- oder Schlechterfüllung moniert.</p>"}
    <p class="muted">${esc(box.customer || "")}${box.sales_order_id ? ` · Auftrag ${esc(box.sales_order_id)}` : ""} · ${esc(box.profile || "")}</p>
    <div class="actions"><a class="btn" href="${esc(box.desk_url)}">Box in Growth öffnen</a></div>
  </section>`;
}

function disputeHref(row) {
  return `#/disputes/${encodeURIComponent(row.dispute_id || row.resolve_case_id || row.receivable_id)}`;
}

function settlementHref(row) {
  const id = row.trade_id || row.trade?.trade_id || row.instruction_id;
  return id ? `#/settlement/${encodeURIComponent(id)}` : "#/settlement";
}

function settlementKey(row) {
  return String(row.trade_id || row.trade?.trade_id || row.instruction_id || "");
}

function settlementPanelHtml(pack) {
  const trade = pack.trade;
  const inst = pack.instruction;
  const pending = inst && (inst.status === "ISSUED" || inst.status === "SEEN");
  return `
    <p class="settle-id"><strong>${esc(trade.trade_id)}</strong> · ${esc(partyLabel(trade.seller_party_id))} → ${esc(partyLabel(trade.buyer_party_id))} · ${badge(trade.status)}</p>
    <div class="grid-2">
      <div>
        <p>Nominal ${formatChf(trade.nominal_amount, trade.currency)} · Kaufpreis ${formatChf(trade.purchase_price, trade.currency)}</p>
        ${
          inst
            ? `<p>Zahlen Sie ${formatChf(inst.amount, inst.currency)} an ${formatIban(inst.payee_iban)}<br>
               Referenz <span class="mono">${esc(inst.payment_reference)}</span> · Anweisung ${badge(inst.status)}<br>
               Zahler ${esc(partyLabel(inst.payer_party_id))} · Empfänger ${esc(partyLabel(inst.payee_party_id))}</p>
               <p class="note">Die Übertragung erfolgt erst nach Bestätigung des Zahlungsproviders.</p>
               ${pending ? `<button type="button" data-confirm="${inst.instruction_id}">Zahlungseingang übernehmen</button>` : ""}`
            : `<p class="muted">Keine Zahlungsanweisung.</p>`
        }
      </div>
      <div>
        <p>Forderung <a href="#/receivables/${trade.receivable_id}">${trade.receivable_id}</a>
        ${pack.asset ? ` · Rechnung ${esc(pack.asset.invoice_id)} ${badge(pack.asset.status)}` : ""}</p>
        ${pack.offer ? `<p>Angebot <a href="#/market/${pack.offer.offer_id}">${pack.offer.offer_id}</a> ${badge(pack.offer.status)}</p>` : ""}
        ${
          pack.assignment
            ? `<p>Zession <a href="#/zession/${pack.assignment.assignment_id}">${pack.assignment.assignment_id}</a> ${badge(pack.assignment.status)}</p>`
            : `<p class="muted">Kein Zessionsvertrag — reiner Forderungskauf / Liquidität.</p>`
        }
        ${
          pack.observation
            ? `<p>Provider ${esc(pack.observation.provider)} · ${formatChf(pack.observation.observed_amount, pack.observation.observed_currency)} · ${formatDate(pack.observation.observed_at)}</p>`
            : `<p class="muted">Noch keine Provider-Meldung.</p>`
        }
        <p><a href="#/receivables/${trade.receivable_id}">Zur Forderung</a></p>
      </div>
    </div>
    <details class="settle-events" open>
      <summary>Protokoll</summary>
      ${eventTable(pack.events)}
    </details>
  `;
}

async function fillSettlementPanel(panel, id) {
  panel.innerHTML = `<p class="muted" role="status">Wird geladen…</p>`;
  try {
    const pack = await api(`/settlements/${encodeURIComponent(id)}`);
    panel.innerHTML = settlementPanelHtml(pack);
    panel.querySelectorAll("[data-confirm]").forEach((button) => {
      button.addEventListener("click", () =>
        act(
          () =>
            api(`/settlements/${button.getAttribute("data-confirm")}/provider-confirm`, {
              method: "POST",
              body: JSON.stringify({ provider: "external-psp" })
            }),
          "Zahlungseingang übernehmen und das Asset übertragen? Dieser Schritt ist nicht umkehrbar."
        )
      );
    });
  } catch (error) {
    panel.innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}

async function toggleSettlementRow(row, forceOpen) {
  const key = row.getAttribute("data-settle");
  const detail = document.getElementById(`settle-panel-${key}`);
  const button = row.querySelector(".settle-toggle");
  const open = forceOpen === true || (forceOpen !== false && detail.hasAttribute("hidden"));
  document.querySelectorAll("tr.settle-row.is-open").forEach((other) => {
    if (other === row) return;
    other.classList.remove("is-open");
    const otherBtn = other.querySelector(".settle-toggle");
    if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
    const otherDetail = document.getElementById(`settle-panel-${other.getAttribute("data-settle")}`);
    if (otherDetail) otherDetail.hidden = true;
  });
  row.classList.toggle("is-open", open);
  if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
  if (!detail) return;
  detail.hidden = !open;
  if (open) {
    const panel = detail.querySelector("[data-settle-panel]");
    if (panel && !panel.getAttribute("data-loaded")) {
      panel.setAttribute("data-loaded", "1");
      await fillSettlementPanel(panel, key);
    }
  }
}

async function act(run, confirmText) {
  if (busy) {
    lastError = "Bitte warten — eine Aktion läuft noch.";
    const alert = document.querySelector("[role='alert'], .error");
    if (alert) alert.textContent = lastError;
    else window.alert(lastError);
    return;
  }
  if (confirmText && !window.confirm(confirmText)) return;
  busy = true;
  lastError = "";
  try {
    await run();
    workspace = await loadWorkspace();
    await route();
  } catch (error) {
    lastError = error.message;
    await route();
  } finally {
    busy = false;
  }
}

function renderHub() {
  const k = workspace.kpis;
  main.innerHTML = `
    <h1>Sponsum</h1>
    <p class="lead">Einstieg ist die <strong>Forderung aus der Rechnung</strong> — nicht der Wechsel. Verifizieren, finanzieren, zedieren. Sponsum hält keine Kundengelder.</p>
    <div class="kpis">
      <div class="kpi"><strong>${k.receivables}</strong><span>Forderungen</span></div>
      <div class="kpi"><strong>${k.live_offers}</strong><span>Offene Angebote</span></div>
      <div class="kpi"><strong>${k.trades}</strong><span>Abschlüsse</span></div>
      <div class="kpi"><strong>${k.disputed}</strong><span>Streitfälle</span></div>
      <div class="kpi"><strong>${k.transferred}</strong><span>Übertragen</span></div>
      <div class="kpi"><strong>${k.holds_customer_funds ? "ja" : "nein"}</strong><span>Kundengelder</span></div>
    </div>
    <div class="grid-2">
      <section class="card">
        <h2>Nächste Schritte</h2>
        <p>Zuerst die Forderung aus der Rechnung. Wechsel nur als Sonderfall.</p>
        <div class="actions">
          <a class="btn" href="#/receivables">Forderung anlegen</a>
          <a class="btn ghost" href="#/zession">Zedieren</a>
          <a class="btn ghost" href="https://suite.movena.ch/growth/#/finance/debtors">← Debitoren 360</a>
          <a class="btn ghost" href="#/settlement">Abrechnung</a>
        </div>
      </section>
      <section class="card">
        <h2>Regulatorische Grenzen</h2>
        <p>Kein Escrow, kein Orderbuch, keine anteiligen Token, kein automatischer Kauf, kein gesetzlicher Wechsel ohne Freigabe.</p>
        <p>${policyBadge(workspace.policies.CH.sponsum_holds_funds)} Kundengelder &nbsp; ${policyBadge(workspace.policies.CH.legal_bill_of_exchange)} Wechsel &nbsp; ${policyBadge(workspace.policies.CH.auto_buy)} Autokauf</p>
      </section>
    </div>
    ${renderAssetTable(workspace.receivables.slice(0, 6), "Aktuelle Forderungen", workspace.receivables.length)}
  `;
}

function renderAssetTable(rows, title, total) {
  const extra = total != null && total > rows.length ? `<p class="muted"><a href="#/receivables">+${total - rows.length} weitere · Alle anzeigen</a></p>` : "";
  return `
    <section class="card">
      <h2>${title}</h2>
      <table>
        <thead><tr><th>Forderung</th><th>Rechnung</th><th class="num">Nominal</th><th>Status</th><th class="num">Prüfung</th><th>Risiko</th><th>Fällig</th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
            <tr>
              <td><a href="#/receivables/${row.receivable_id}">${row.receivable_id}</a></td>
              <td>${row.invoice_id}</td>
              <td class="num">${formatChf(row.nominal_amount, row.currency)}</td>
              <td>${badge(row.status)}</td>
              <td class="num">${row.verification_score}/100</td>
              <td>${row.risk_class}</td>
              <td>${formatDue(row.maturity_date)}</td>
            </tr>`
                  )
                  .join("")
              : emptyRow(7, "Keine Forderungen vorhanden.")
          }
        </tbody>
      </table>
      ${extra}
    </section>`;
}

function hashQuery() {
  const raw = String(location.hash || "");
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

function renderReceivables() {
  const invoicePrefill = hashQuery().get("invoice") || "";
  main.innerHTML = `
    <h1>Forderungen</h1>
    <p class="lead">Die Rechnung ist nicht das Finanzierungsobjekt. Das Asset trägt Vertrag, Nachweis, Sperre und Register.</p>
    ${errorLine()}
    <div class="actions">
      <a class="btn" href="#/zession">Zession abhandeln</a>
      <a class="btn ghost" href="#/wechsel">Wechsel-Entwurf erstellen</a>
    </div>
    <div class="grid-2">
      <div>${renderAssetTable(workspace.receivables, "Buch")}</div>
      <section class="card">
        <h2>Neue Forderung aus Rechnung</h2>
        <form class="stack" id="create-form">
          <label>Rechnungsnummer <input name="invoice_id" required placeholder="z. B. RE-10482" value="${esc(invoicePrefill)}" /></label>
          <label>Nominal <input name="nominal_amount" inputmode="decimal" required placeholder="0.00" /></label>
          <label>Schuldner <select name="debtor_party_id" required>${partyOptions("", { companies: false })}</select></label>
          ${stammdatenHint()}
          <button type="submit">Forderung anlegen</button>
        </form>
      </section>
    </div>
  `;
  document.getElementById("create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (!/^\d+([.']\d{3})*(?:\.\d{1,2})?$|^\d+(?:\.\d{1,2})?$/.test(String(data.nominal_amount).replace(/'/g, ""))) {
      lastError = "Bitte einen gültigen Betrag eingeben.";
      route();
      return;
    }
    data.nominal_amount = String(data.nominal_amount).replace(/'/g, "");
    act(
      () =>
      api("/receivables", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          issue_date: new Date().toISOString().slice(0, 10),
          maturity_date: new Date(Date.now() + 67 * 86400000).toISOString().slice(0, 10),
          creditor_party_id: SELLER,
          evidence: {
            hasInvoice: true,
            unpaid: true,
            hasDispute: false,
            hasContract: true,
            invoiceElectronic: true,
            hasDelivery: true,
            debtorAcknowledged: true,
            creditorKyc: true,
            debtorKyc: true
          }
        })
      }),
      `Forderung ${data.invoice_id} für ${formatChf(data.nominal_amount)} anlegen?`
    );
  });
}

async function renderDossier(id) {
  let dossier;
  try {
    dossier = await api(`/receivables/${id}/dossier`);
  } catch (error) {
    main.innerHTML = notFoundCard("Forderung", error.message, "#/receivables", "Forderungen");
    return;
  }
  const asset = dossier.asset;
  const checks = dossier.verification ? dossier.verification.checks : {};
  const liveOffer = dossier.offers.find((row) => row.status === "LIVE");
  const pending = dossier.instructions.find((row) => row.status === "ISSUED" || row.status === "SEEN");
  main.innerHTML = `
    <p><a href="#/receivables">← Forderungen</a></p>
    <h1>${asset.receivable_id}</h1>
    <p class="lead">Rechnung ${asset.invoice_id} · ${formatChf(asset.nominal_amount, asset.currency)} · Inhaber ${asset.current_holder_party_id}</p>
    ${errorLine()}
    <div class="kpis">
      <div class="kpi"><strong>${badge(asset.status)}</strong><span>Status</span></div>
      <div class="kpi"><strong>${asset.verification_score}/100</strong><span>Prüfung</span></div>
      <div class="kpi"><strong>${asset.risk_class}</strong><span>Risiko</span></div>
      <div class="kpi"><strong>${badge(dossier.lock.state)}</strong><span>Sperre</span></div>
      <div class="kpi"><strong>${labelOf(asset.instrument_type)}</strong><span>Instrument</span></div>
    </div>
    <div class="grid-2">
      <section class="card">
        <h2>Prüfnachweise</h2>
        <div class="checks">
          ${Object.entries(checks)
            .map(([key, ok]) => `<div class="${ok ? "check-ok" : "check-no"}">${ok ? "✓" : "–"} ${key.replaceAll("_", " ")}</div>`)
            .join("")}
        </div>
      </section>
      <section class="card">
        <h2>Beträge</h2>
        <p>Nominal ${formatChf(asset.nominal_amount, asset.currency)}<br>Akzeptiert ${formatChf(asset.accepted_amount, asset.currency)}<br>Bestritten ${formatChf(asset.disputed_amount, asset.currency)}<br>Offen ${formatChf(asset.outstanding_amount, asset.currency)}</p>
        <p>Fällig ${formatDue(asset.maturity_date)}</p>
        <p class="mono">Hash ${asset.content_hash.slice(0, 24)}…</p>
      </section>
    </div>
    <section class="card">
      <h2>Aktionen</h2>
      <div class="actions">
        <button type="button" id="act-liq" ${asset.status === "ACCEPTED" ? "" : "disabled"}>Liquidität beschaffen</button>
        <button type="button" id="act-sell" ${asset.status === "ACCEPTED" ? "" : "disabled"}>Forderung verkaufen</button>
        <a class="btn" href="#/zession">Zession abhandeln</a>
        ${
          asset.resolve_case_id
            ? `<a class="btn ghost" href="${disputeHref(asset)}">Streitfall öffnen</a>`
            : `<button type="button" class="ghost" id="act-dispute">Dispute / Resolve</button>`
        }
      </div>
      <p class="muted">Bestrittene Forderungen können nicht unbelastet verkauft werden. Transfer nur nach PSP-Webhook.</p>
    </section>
    ${
      liveOffer
        ? `<section class="card" data-testid="sponsum-quotes">
            <h2><a href="#/market/${liveOffer.offer_id}">Angebot ${liveOffer.offer_id}</a> · ${liveOffer.factoring_mode} · ${liveOffer.notice_mode}</h2>
            <p>Mindestpreis ${liveOffer.min_price ? formatChf(liveOffer.min_price, asset.currency) : "–"} · Briefkurs ${liveOffer.ask_price ? formatChf(liveOffer.ask_price, asset.currency) : "–"} · ${badge(liveOffer.status)}</p>
            <ul>${dossier.bids.map((bid) => `<li>${bid.buyer_party_id} ${formatChf(bid.amount, asset.currency)} ${badge(bid.status)}</li>`).join("")}</ul>
            ${
              dossier.bids.find((bid) => bid.status === "OPEN")
                ? `<button type="button" id="act-accept">Bestes Gebot annehmen</button>`
                : ""
            }
          </section>`
        : ""
    }
    ${
      pending
        ? `<section class="card" data-testid="sponsum-settlement-status">
            <h2>Settlement-Instruktion</h2>
            <p>Zahlen Sie ${formatChf(pending.amount, pending.currency)} an ${formatIban(pending.payee_iban)}</p>
            <p>Referenz ${pending.payment_reference}</p>
            <p class="note">Die Übertragung erfolgt erst nach Bestätigung des Zahlungsproviders.</p>
            <p><a href="${settlementHref(pending)}">Abrechnung öffnen</a></p>
            <button type="button" id="act-psp">Zahlungseingang vom Provider übernehmen</button>
          </section>`
        : ""
    }
    ${
      (dossier.assignments || [])
        .map(
          (row) => `
      <section class="card">
        <h2><a href="#/zession/${row.assignment_id}">Zession ${row.assignment_id}</a></h2>
        <p>${row.contract_title}<br>${row.transferor_party_id} → ${row.transferee_party_id}<br>
        ${row.factoring_mode} · ${row.notice_mode} · ${badge(row.status)}</p>
        <p class="muted">${row.legal_basis}</p>
        <p>Kaufpreis ${formatChf(row.purchase_price, row.currency)} · Referenz ${row.payment_reference}</p>
      </section>`
        )
        .join("")
    }
    ${
      (dossier.trades || [])
        .map(
          (row) => `
      <section class="card">
        <h2><a href="${settlementHref(row)}">Abschluss ${row.trade_id}</a></h2>
        <p>${formatChf(row.purchase_price, row.currency)} · ${esc(partyLabel(row.seller_party_id))} → ${esc(partyLabel(row.buyer_party_id))} · ${badge(row.status)}</p>
      </section>`
        )
        .join("")
    }
    ${
      (dossier.wechsel_drafts || [])
        .map(
          (row) => `
      <section class="card">
        <h2><a href="#/wechsel/${row.instrument_id}">Wechsel-Entwurf ${row.instrument_id}</a></h2>
        <p>Aussteller ${esc(partyLabel(row.drawer_party_id))} · Bezogener ${esc(partyLabel(row.drawee_party_id))} · Zahlungsempfänger ${esc(partyLabel(row.remittee_party_id))}</p>
        <p>${row.currency} ${row.amount} · Verfall ${row.maturity_date} · ${row.place_of_payment}</p>
        <p>${badge(row.legal_qualification)}</p>
        <p class="muted">${row.disclaimer}</p>
      </section>`
        )
        .join("")
    }
    <section class="card">
      <h2>Register / Regress / Adapter</h2>
      <p>Registerzeilen: ${dossier.registry.map((row) => `${row.status} ${row.transferor_party_id} → ${row.transferee_party_id || "–"}`).join("; ") || "keine"}</p>
      <p>Bitcredit ${dossier.adapters.bitcredit.ok ? dossier.adapters.bitcredit.ref : dossier.adapters.bitcredit.reason}</p>
      <p>Registerwertrecht ${dossier.adapters.register_right.ok ? dossier.adapters.register_right.ref : dossier.adapters.register_right.reason}</p>
      <p>LEGAL_BILL_OF_EXCHANGE ${policyBadge("DENY")} · Aval-als-Wechsel ${policyBadge("DENY")}</p>
    </section>
    <section class="card">
      <h2>Resolve / Enforcement</h2>
      <p>Resolve-Case: ${
        asset.resolve_case_id
          ? `<a href="${disputeHref(asset)}">${asset.resolve_case_id}</a>`
          : "keiner"
      }</p>
      <p>Nach Fälligkeit: Dunning → Movena Resolve → eSchKG / Justitia.Swiss. Gläubiger = aktueller Inhaber ${asset.current_holder_party_id}.</p>
    </section>
    <section class="card">
      <h2>Protokoll</h2>
      <table><tbody>
        ${dossier.events
          .map((event) => `<tr><td>${event.created_at.slice(11, 19)}</td><td>${event.event_type}</td><td class="mono">${event.event_hash.slice(0, 12)}</td></tr>`)
          .join("")}
      </tbody></table>
    </section>
  `;

  const liq = document.getElementById("act-liq");
  if (liq) liq.addEventListener("click", () => act(() => api(`/receivables/${id}/liquidity`, { method: "POST", body: JSON.stringify({ seller_party_id: SELLER }) }), "Liquiditätsanfrage starten? Die Forderung wird gesperrt."));
  const sell = document.getElementById("act-sell");
  if (sell) sell.addEventListener("click", () => act(() => api(`/receivables/${id}/offers`, { method: "POST", body: JSON.stringify({ seller_party_id: SELLER, min_price: String(Number(asset.nominal_amount) * 0.97) }) }), "Forderung am Markt anbieten? Sie kann nicht parallel erneut angeboten werden."));
  const dispute = document.getElementById("act-dispute");
  if (dispute) {
    dispute.addEventListener("click", () => {
      const suggested = Number(asset.disputed_amount) > 0 ? asset.disputed_amount : "";
      const typed = window.prompt("Bestrittener Betrag in CHF", suggested || String(Math.round(Number(asset.nominal_amount) * 0.2) || "10000"));
      if (typed == null || !String(typed).trim()) return;
      act(
        () =>
          api(`/receivables/${id}/disputes`, {
            method: "POST",
            body: JSON.stringify({ disputed_amount: String(typed).trim(), resolve_case_id: `resolve-${asset.invoice_id}` })
          }),
        "Streitfall eröffnen? Ein unbelasteter Verkauf ist danach nicht möglich."
      );
    });
  }
  const accept = document.getElementById("act-accept");
  if (accept) {
    accept.addEventListener("click", () => {
      const open = dossier.bids.filter((bid) => bid.status === "OPEN").sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      if (!open) return;
      act(() => api(`/bids/${open.bid_id}/accept`, { method: "POST", body: JSON.stringify({ seller_party_id: SELLER }) }), `Bestes Gebot ${formatChf(open.amount, asset.currency)} annehmen und Zahlung anweisen?`);
    });
  }
  const psp = document.getElementById("act-psp");
  if (psp && pending) {
    psp.addEventListener("click", () =>
      act(
        () =>
        api(`/settlements/${pending.instruction_id}/provider-confirm`, {
          method: "POST",
          body: JSON.stringify({ provider: "external-psp" })
        }),
        `Zahlungseingang ${formatChf(pending.amount, pending.currency)} übernehmen und das Asset übertragen?`
      )
    );
  }
}

function renderZession() {
  const assignable = workspace.receivables.filter((row) => row.status === "ACCEPTED");
  main.innerHTML = `
    <h1>Zession / Forderungskauf</h1>
    <p class="lead">Bilaterale Abtretung nach OR 164 ff. Sponsum erzeugt Vertrag, Zahlungsinstruktion und Lock. Kein Wechselrecht.</p>
    ${errorLine()}
    <div class="grid-2">
      <section class="card">
        <h2>Neue Zession</h2>
        <form class="stack" id="zes-form">
          <label>Forderung
            <select name="receivable_id" required>
              <option value="">wählen…</option>
              ${assignable
                .map(
                  (row) =>
                    `<option value="${row.receivable_id}">${row.receivable_id} · ${row.invoice_id} · ${formatChf(row.nominal_amount, row.currency)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label>Zessionar / Käufer <select name="buyer_party_id" required>${partyOptions("", { companies: false })}</select></label>
          ${stammdatenHint()}
          <label>Kaufpreis <input name="purchase_price" inputmode="decimal" required placeholder="0.00" /></label>
          <label>Modus
            <select name="factoring_mode">
              <option value="TRUE_SALE">Echter Forderungskauf (True Sale)</option>
              <option value="WITHOUT_RECOURSE">Ohne Regress</option>
              <option value="WITH_RECOURSE">Mit Regress</option>
            </select>
          </label>
          <label>Anzeige
            <select name="notice_mode">
              <option value="OPEN">Offene Zession (Schuldner wird benachrichtigt)</option>
              <option value="SILENT">Stille Zession</option>
            </select>
          </label>
          <label>Zahlungs-IBAN Verkäufer <input name="payee_iban" required placeholder="CH93 0076 2011 6238 5295 7" /></label>
          <button type="submit">Zessionsvertrag erzeugen &amp; Trade locken</button>
        </form>
        ${assignable.length === 0 ? "<p class=\"muted\">Keine ACCEPTED-Forderung frei. Zuerst Asset erzeugen oder Dispute lösen.</p>" : ""}
      </section>
      <section class="card">
        <h2>Laufende Zessionen</h2>
        ${(workspace.assignments || []).length
          ? `<table>
              <thead><tr><th>Zession</th><th>Parteien</th><th class="num">Kaufpreis</th><th>Stand</th></tr></thead>
              <tbody>
                ${(workspace.assignments || [])
                  .map(
                    (row) => `<tr class="clickable" data-href="#/zession/${row.assignment_id}">
                      <td><a href="#/zession/${row.assignment_id}">${row.assignment_id}</a><br><span class="muted">${labelOf(row.factoring_mode)} · ${labelOf(row.notice_mode)}</span></td>
                      <td>${esc(partyLabel(row.transferor_party_id))} → ${esc(partyLabel(row.transferee_party_id))}<br><a href="#/receivables/${row.receivable_id}">${row.receivable_id}</a></td>
                      <td class="num">${formatChf(row.purchase_price, row.currency)}</td>
                      <td>${badge(row.status)}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
          : "<p class=\"muted\">Noch keine Zession.</p>"}
        ${
          (workspace.trades || []).filter((trade) => !(workspace.assignments || []).some((row) => row.trade_id === trade.trade_id)).length
            ? `<h2 style="margin-top:16px">Überträge ohne Zessionsvertrag</h2>
               <table>
                 <thead><tr><th>Abschluss</th><th>Forderung</th><th class="num">Preis</th><th>Stand</th></tr></thead>
                 <tbody>
                   ${(workspace.trades || [])
                     .filter((trade) => !(workspace.assignments || []).some((row) => row.trade_id === trade.trade_id))
                     .map(
                       (trade) => `<tr class="clickable" data-href="${settlementHref(trade)}">
                         <td><a href="${settlementHref(trade)}">${trade.trade_id.slice(0, 12)}</a></td>
                         <td><a href="#/receivables/${trade.receivable_id}">${trade.receivable_id}</a></td>
                         <td class="num">${formatChf(trade.purchase_price, trade.currency)}</td>
                         <td>${badge(trade.status)}</td>
                       </tr>`
                     )
                     .join("")}
                 </tbody>
               </table>`
            : ""
        }
      </section>
    </div>
  `;
  document.getElementById("zes-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    data.payee_iban = String(data.payee_iban || "").replace(/\s+/g, "");
    data.purchase_price = String(data.purchase_price).replace(/'/g, "");
    act(
      () =>
      api("/assignments", {
        method: "POST",
        body: JSON.stringify({ seller_party_id: SELLER, ...data })
      }).then((created) => {
        const id = created && created.assignment && created.assignment.assignment_id;
        window.location.hash = id ? `#/zession/${id}` : "#/settlement";
      }),
      `Zession über ${formatChf(data.purchase_price)} an ${data.buyer_party_id} abschliessen? Die Forderung wird gesperrt.`
    );
  });
  bindClickableRows();
}

function chfWords(value) {
  const ones = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
  const tens = ["", "", "zwanzig", "dreissig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
  function underThousand(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      const o = n % 10;
      const t = Math.floor(n / 10);
      return o ? `${ones[o]}und${tens[t]}` : tens[t];
    }
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${h === 1 ? "ein" : ones[h]}hundert${underThousand(rest)}`;
  }
  const n = Math.floor(Number(value) || 0);
  if (n === 0) return "null Schweizer Franken";
  if (n < 1000) return `${underThousand(n)} Schweizer Franken`;
  if (n < 1000000) {
    const t = Math.floor(n / 1000);
    const rest = n % 1000;
    const tWord = t === 1 ? "ein" : underThousand(t);
    return `${tWord}tausend${rest ? underThousand(rest) : ""} Schweizer Franken`;
  }
  return `${n.toLocaleString("de-CH")} Schweizer Franken`;
}

function wechselArtLine(data) {
  const form = data.wechsel_form === "SOLA" ? "Solawechsel" : "Gezogener Wechsel";
  const purpose = "Handelswechsel";
  const verfall =
    data.verfall_art === "SICHTWECHSEL"
      ? "Sichtwechsel"
      : data.verfall_art === "NACHSICHTWECHSEL"
        ? `Nachsichtwechsel${data.after_sight_days ? ` (${data.after_sight_days} Tage)` : ""}`
        : "Tagwechsel";
  return `${form} · ${purpose} · ${verfall}`;
}

function wechselTitle(data) {
  if (data.wechsel_form === "SOLA") return "SOLAWECHSEL";
  return "GEZOGENER WECHSEL";
}

function findSig(rows, role) {
  return (rows || []).find((row) => row.role === role) || null;
}

function signLine(sig, emptyLabel) {
  if (!sig) return `${emptyLabel} — offen`;
  if (sig.status === "PENDING") {
    return `${emptyLabel} — ${labelOf(sig.quality)} ausstehend${sig.signing_url ? " · Skribble" : ""}`;
  }
  return `${emptyLabel} gezeichnet ${formatDate(sig.signed_at)} · ${labelOf(sig.quality)} · ${esc(partyLabel(sig.signer_label || sig.party_id))}`;
}

function wechselDueClause(data) {
  if (data.verfall_art === "SICHTWECHSEL") return "bei Sicht";
  if (data.verfall_art === "NACHSICHTWECHSEL") {
    return `${Number(data.after_sight_days || 30)} Tage nach Sicht`;
  }
  return `am ${formatDate(data.maturity_date)}`;
}

function wechselHtml(data) {
  const sola = data.wechsel_form === "SOLA";
  const verb = sola ? "zahle ich" : "zahlen Sie";
  return `
    <article class="wechsel-paper">
      <div class="wb-stamp">ENTWURF<br>KEIN WECHSEL NACH OR</div>
      <div class="wb-head">
        <div>
          <h3>${wechselTitle(data)}</h3>
          <small>${esc(wechselArtLine(data))}<br>Elektronischer Handelsbeleg · ${esc(data.place_of_payment || "—")}, ${formatDate(data.issue_date)}</small>
        </div>
        <div class="wb-sum">${formatChf(data.amount)}</div>
      </div>
      <p class="wb-clause">
        Gegen diesen ${sola ? "Solawechsel" : "Wechsel"} ${verb}
        <strong>${wechselDueClause(data)}</strong>
        an <strong>${esc(partyLabel(data.remittee_party_id || data.drawer_party_id))}</strong>
        die Summe von <strong>${formatChf(data.amount)}</strong>
        (in Worten: ${chfWords(data.amount)}).
        Zahlbar in <strong>${esc(data.place_of_payment || "—")}</strong>.
        Nicht an Order — Übertragung nur durch Zession.
      </p>
      <div class="wb-grid">
        <div><span>Art des Wechsels</span>${esc(wechselArtLine(data))}</div>
        <div><span>Aussteller</span>${esc(partyLabel(data.drawer_party_id))}</div>
        <div><span>${sola ? "Aussteller als Bezogener" : "Bezogener"}</span>${esc(partyLabel(data.drawee_party_id))}</div>
        <div><span>Zahlungsempfänger</span>${esc(partyLabel(data.remittee_party_id || data.drawer_party_id))}</div>
        <div><span>Verfall</span>${esc(wechselDueClause(data))}</div>
      </div>
      <div class="wb-sign">
        <div class="wb-line">${signLine(findSig(data.signatures, "DRAWEE"), sola ? "Aussteller als Bezogener" : "Bezogener")}</div>
        <div class="wb-line">${signLine(findSig(data.signatures, "DRAWER"), "Aussteller")}</div>
      </div>
      ${
        (data.guarantees || []).length
          ? `<p class="wb-side">Mithaftung: ${(data.guarantees || [])
              .map((row) => `${esc(partyLabel(row.guarantor_party_id))} (${labelOf(row.kind)}, kein Wechselaval)`)
              .join("; ")}</p>`
          : ""
      }
      <p class="wb-disclaimer">Kein Wechsel im Sinne von Art. 990 ff. OR. Übertragung nur als Zession / Forderungskauf. Kein Indossament, kein Aval nach OR.</p>
    </article>
  `;
}

function readWechselForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function renderWechsel() {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const drawerDefault = preferredCompany();
  const initial = {
    wechsel_form: "GEZOGEN",
    verfall_art: "TAGWECHSEL",
    after_sight_days: "30",
    drawer_party_id: drawerDefault,
    drawee_party_id: "",
    remittee_party_id: "",
    amount: "",
    issue_date: today,
    maturity_date: due,
    place_of_payment: "Zürich"
  };
  main.innerHTML = `
    <h1>Wechsel</h1>
    <p class="lead">Elektronischer Handelsbeleg. <strong>Kein Wechsel nach Art. 990 ff. OR.</strong> Nach dem Speichern liegen Akzept, Sicherheit und Zession auf dem Beleg. Indossament und Protest bleiben gesperrt.</p>
    ${errorLine()}
    <div class="grid-2">
      <section class="card">
        <h2>Neuen Beleg ausstellen</h2>
        <form class="stack" id="wb-form">
          <label>Art des Wechsels
            <select name="wechsel_form" required>
              <option value="GEZOGEN" selected>Gezogener Wechsel (Tratte)</option>
              <option value="SOLA">Solawechsel (eigener Wechsel)</option>
            </select>
          </label>
          <input type="hidden" name="wechsel_purpose" value="HANDELSWECHSEL" />
          <label>Verfallart
            <select name="verfall_art" required>
              <option value="TAGWECHSEL" selected>Tagwechsel (festes Datum)</option>
              <option value="SICHTWECHSEL">Sichtwechsel</option>
              <option value="NACHSICHTWECHSEL">Nachsichtwechsel</option>
            </select>
          </label>
          <label id="wb-sight-days">Tage nach Sicht <input name="after_sight_days" inputmode="numeric" value="30" /></label>
          <label>Aussteller <select name="drawer_party_id" required>${partyOptions(drawerDefault, { customers: false })}</select></label>
          <label id="wb-drawee-label">Bezogener <select name="drawee_party_id" required>${partyOptions("", { companies: false })}</select></label>
          <label>Zahlungsempfänger <select name="remittee_party_id">${partyOptions("", { emptyLabel: "gleich Aussteller" })}</select></label>
          <label>Betrag <input name="amount" inputmode="decimal" required placeholder="0.00" /></label>
          <label>Ausstellung <input name="issue_date" type="date" value="${initial.issue_date}" /></label>
          <label id="wb-maturity-label">Verfall <input name="maturity_date" type="date" value="${initial.maturity_date}" /></label>
          <label>Zahlungsort <input name="place_of_payment" value="Zürich" placeholder="z. B. Zürich" /></label>
          ${stammdatenHint()}
          <button type="submit">Beleg speichern</button>
        </form>
      </section>
      <div>
        <div id="wb-preview">${wechselHtml(initial)}</div>
        <section class="card" style="margin-top:12px">
          <h2>Belege</h2>
          ${(workspace.wechsel_drafts || []).length
            ? `<table>
                <thead><tr><th>Beleg</th><th>Art</th><th class="num">Betrag</th><th>Bezogener</th><th>Stand</th></tr></thead>
                <tbody>
                  ${(workspace.wechsel_drafts || [])
                    .map(
                      (row) => `<tr class="clickable" data-href="#/wechsel/${row.instrument_id}">
                        <td><a href="#/wechsel/${row.instrument_id}">${row.instrument_id}</a></td>
                        <td>${esc(wechselArtLine(row))}</td>
                        <td class="num">${formatChf(row.amount, row.currency)}</td>
                        <td>${esc(partyLabel(row.drawee_party_id))}</td>
                        <td>${badge(row.status || "DRAFT")}</td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
              </table>`
            : "<p class=\"muted\">Noch kein gespeicherter Beleg.</p>"}
        </section>
      </div>
    </div>
  `;
  const form = document.getElementById("wb-form");
  const preview = document.getElementById("wb-preview");
  const place = form.elements.namedItem("place_of_payment");
  const drawee = form.elements.namedItem("drawee_party_id");
  const drawer = form.elements.namedItem("drawer_party_id");
  const applyArt = () => {
    const data = readWechselForm(form);
    const sola = data.wechsel_form === "SOLA";
    const nachsicht = data.verfall_art === "NACHSICHTWECHSEL";
    const sicht = data.verfall_art === "SICHTWECHSEL";
    document.getElementById("wb-sight-days").hidden = !nachsicht;
    document.getElementById("wb-maturity-label").hidden = sicht;
    document.getElementById("wb-drawee-label").hidden = sola;
    if (sola && drawer) {
      drawee.value = drawer.value;
      drawee.required = false;
    } else {
      drawee.required = true;
    }
  };
  const refresh = () => {
    applyArt();
    preview.innerHTML = wechselHtml(readWechselForm(form));
  };
  form.elements.namedItem("drawee_party_id").addEventListener("change", (event) => {
    const city = partyCity(event.target.value);
    if (city && place && (!place.value || place.value === "Zürich")) place.value = city;
    refresh();
  });
  form.elements.namedItem("wechsel_form").addEventListener("change", refresh);
  form.elements.namedItem("verfall_art").addEventListener("change", refresh);
  form.addEventListener("input", refresh);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    act(async () => {
      const created = await api("/wechsel-drafts", { method: "POST", body: JSON.stringify(readWechselForm(form)) });
      window.location.hash = `#/wechsel/${created.draft.instrument_id}`;
    });
  });
  document.querySelectorAll("tr.clickable[data-href]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      window.location.hash = row.getAttribute("data-href");
    });
  });
  refresh();
}

async function renderWechselDossier(id) {
  let pack;
  try {
    pack = await api(`/wechsel-drafts/${id}/dossier`);
  } catch (error) {
    main.innerHTML = `<section class="card"><h1>Wechsel</h1><p class="error">${esc(error.message)}</p><p><a href="#/wechsel">Zurück</a></p></section>`;
    return;
  }
  const draft = pack.draft;
  const fn = pack.functions || {};
  const panel = new URLSearchParams(window.location.hash.split("?")[1] || "").get("do") || "";
  main.innerHTML = `
    <p class="muted"><a href="#/wechsel">← alle Belege</a> · <a href="#/receivables/${draft.receivable_id}">Forderung</a></p>
    <h1>Wechsel ${draft.instrument_id}</h1>
    <p class="lead">${esc(wechselArtLine(draft))}<br>${badge(draft.status)} ${badge(draft.legal_qualification)} · ${formatChf(draft.amount, draft.currency)} · ${esc(wechselDueClause(draft))}</p>
    ${errorLine()}
    <section class="card">
      <h2>Signatur</h2>
      <p class="note">SES in der Suite oder QES über Skribble (ZertES). Beides ist <strong>kein Wechselakzept</strong> und kein Indossament.${
        pack.skribble?.configured ? "" : " QES ist bereit, sobald Skribble auf diesem Node konfiguriert ist."
      }</p>
      <form class="stack" id="wb-sign-form">
        <label>Stufe
          <select name="quality">
            <option value="SES">SES — Suite-Bestätigung</option>
            <option value="QES">QES — Skribble / ZertES</option>
          </select>
        </label>
        <label>E-Mail für QES <input name="signer_email" type="email" placeholder="name@firma.ch" /></label>
        <div class="actions">
          ${
            findSig(draft.signatures, "DRAWER")
              ? badge("ISSUED")
              : `<button type="button" data-sign-role="DRAWER">Als Aussteller zeichnen</button>`
          }
          ${
            findSig(draft.signatures, "DRAWEE")
              ? badge("ACKNOWLEDGED")
              : `<button type="button" class="ghost" data-sign-role="DRAWEE">Als Bezogener zeichnen</button>`
          }
          <button type="button" class="ghost" id="wb-sign-sync">QES-Status prüfen</button>
        </div>
      </form>
      <p class="muted">${(draft.signatures || [])
        .map((row) => {
          const link = row.signing_url && row.status === "PENDING" ? ` · <a href="${esc(row.signing_url)}" target="_blank" rel="noopener">Bei Skribble zeichnen</a>` : "";
          return `${labelOf(row.role)}: ${esc(partyLabel(row.signer_label || row.party_id))} · ${labelOf(row.quality)} · ${labelOf(row.status || "SIGNED")}${link}`;
        })
        .join("<br>") || "Noch keine Unterschrift."}</p>
    </section>
    <section class="card">
      <h2>Nachweis / Kette</h2>
      <p>Die Dokumentation liegt in der <strong>Sponsum-Protokollkette</strong> (Hash, Vorgänger, Signatur des Nodes). Das ist <strong>kein</strong> öffentliches Register, kein Art. 973d-Wertrecht und keine Übertragung durch eine Blockchain.</p>
      ${(draft.anchors || [])
        .map((row) => `<p class="mono">Anker ${row.anchor_id} · ${row.content_hash.slice(0, 16)} · ${row.method}</p>`)
        .join("") || "<p class=\"muted\">Noch nicht verankert.</p>"}
      <button type="button" class="ghost" id="wb-anchor">Im Protokoll verankern</button>
    </section>
    <section class="card">
      <h2>Funktionen auf diesem Beleg</h2>
      <table class="wb-fn">
        <thead><tr><th>Funktion</th><th>Regel</th><th>Was Sponsum tut</th><th></th></tr></thead>
        <tbody>
          <tr>
            <td>Akzept</td>
            <td>${policyBadge("ALLOW")}</td>
            <td>${esc(fn.akzept?.legal || "Kaufmännische Schuldanerkennung des Bezogenen.")}</td>
            <td>${
              draft.acceptance
                ? badge("ACKNOWLEDGED")
                : `<button type="button" id="wb-accept">Bestätigen</button>`
            }</td>
          </tr>
          <tr>
            <td>Aval</td>
            <td>${policyBadge("DENY")}</td>
            <td>${esc(fn.aval?.legal || "Wechselaval nach OR ist gesperrt.")}</td>
            <td><button type="button" class="ghost" id="wb-aval">Trotzdem Aval?</button></td>
          </tr>
          <tr>
            <td>Sicherheit</td>
            <td>${policyBadge("ALLOW")}</td>
            <td>${esc(fn.sicherheit?.legal || "Bürgschaft oder Garantie, kein Wechselaval.")}</td>
            <td><a class="btn ghost" href="#/wechsel/${draft.instrument_id}?do=sicherheit">Beifügen</a></td>
          </tr>
          <tr>
            <td>Indossament</td>
            <td>${policyBadge("DENY")}</td>
            <td>${esc(fn.indossament?.legal || "Gesperrt. Übertragung nur als Zession.")}</td>
            <td><button type="button" class="ghost" id="wb-endorse">Indossieren</button></td>
          </tr>
          <tr>
            <td>Zession</td>
            <td>${policyBadge("ALLOW")}</td>
            <td>${esc(fn.zession?.legal || "Forderungskauf nach OR 164.")}</td>
            <td><a class="btn" href="#/wechsel/${draft.instrument_id}?do=zession">Zedieren</a></td>
          </tr>
          <tr>
            <td>Protest</td>
            <td>${policyBadge("DENY")}</td>
            <td>${esc(fn.protest?.legal || "Kein formeller Wechselprotest.")}</td>
            <td>
              <button type="button" class="ghost" id="wb-protest">Protest</button>
              <button type="button" class="ghost" id="wb-default">Nichtzahlung</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    <div class="grid-2">
      <div>${wechselHtml(draft)}</div>
      <div>
        ${
          panel === "sicherheit"
            ? `<section class="card">
                <h2>Sicherheit beifügen</h2>
                <form class="stack" id="wb-gar-form">
                  <label>Bürge / Garant <select name="guarantor_party_id" required>${partyOptions("", { emptyLabel: "wählen…" })}</select></label>
                  <label>Art
                    <select name="kind">
                      <option value="SURETY">Bürgschaft (OR 492 ff.)</option>
                      <option value="GUARANTEE">Selbständige Garantie</option>
                    </select>
                  </label>
                  <label>Betrag <input name="amount" value="${esc(draft.amount)}" required /></label>
                  <p class="note">Das ist kein Aval nach Art. 1021 OR.</p>
                  <button type="submit">Sicherheit speichern</button>
                </form>
              </section>`
            : ""
        }
        ${
          panel === "zession"
            ? `<section class="card">
                <h2>Zession / Forderungskauf</h2>
                <form class="stack" id="wb-zes-form">
                  <label>Zessionar <select name="buyer_party_id" required>${partyOptions("", { companies: false })}</select></label>
                  <label>Kaufpreis <input name="purchase_price" value="${esc(draft.amount)}" required /></label>
                  <label>Modus
                    <select name="factoring_mode">
                      <option value="TRUE_SALE">Echter Forderungskauf</option>
                      <option value="WITHOUT_RECOURSE">Ohne Regress</option>
                      <option value="WITH_RECOURSE">Mit Regress</option>
                    </select>
                  </label>
                  <label>Anzeige
                    <select name="notice_mode">
                      <option value="OPEN">Offene Zession</option>
                      <option value="SILENT">Stille Zession</option>
                    </select>
                  </label>
                  <label>IBAN Verkäufer <input name="payee_iban" required placeholder="CH93 0076 2011 6238 5295 7" /></label>
                  ${stammdatenHint()}
                  <button type="submit">Zedieren und Trade locken</button>
                </form>
              </section>`
            : ""
        }
        <section class="card">
          <h2>Kette</h2>
          <p>Aussteller ${esc(partyLabel(draft.drawer_party_id))}<br>
          Bezogener ${esc(partyLabel(draft.drawee_party_id))}${draft.acceptance ? ` · bestätigt ${formatDate(draft.acceptance.accepted_at)}` : ""}<br>
          Zahlungsempfänger ${esc(partyLabel(draft.remittee_party_id))}</p>
          ${(draft.guarantees || [])
            .map((row) => `<p>${labelOf(row.kind)} ${esc(partyLabel(row.guarantor_party_id))} ${formatChf(row.amount, draft.currency)} ${badge(row.legal_qualification)}</p>`)
            .join("")}
          ${(pack.assignments || []).length
            ? pack.assignments
                .map((row) => {
                  const zedent = findSig(row.signatures, "TRANSFEROR");
                  const zessionar = findSig(row.signatures, "TRANSFEREE");
                  return `<div class="note">
                    <p>Zession ${row.assignment_id} an ${esc(partyLabel(row.transferee_party_id))} um ${formatChf(row.purchase_price, row.currency)} ${badge(row.status)}</p>
                    <p>${signLine(zedent, "Zedent")}<br>${signLine(zessionar, "Zessionar")}</p>
                    <div class="actions">
                      ${zedent ? "" : `<button type="button" data-zes-sign="${row.assignment_id}" data-role="TRANSFEROR">Zedent zeichnet</button>`}
                      ${zessionar ? "" : `<button type="button" class="ghost" data-zes-sign="${row.assignment_id}" data-role="TRANSFEREE">Zessionar zeichnet</button>`}
                    </div>
                  </div>`;
                })
                .join("")
            : "<p class=\"muted\">Noch nicht zediert.</p>"}
        </section>
      </div>
    </div>
  `;
  const signForm = document.getElementById("wb-sign-form");
  const startSign = (role) => {
    const data = signForm ? Object.fromEntries(new FormData(signForm).entries()) : {};
    const quality = data.quality || "SES";
    const label = role === "DRAWER" ? partyLabel(draft.drawer_party_id) : partyLabel(draft.drawee_party_id);
    act(
      () =>
        api(`/wechsel-drafts/${draft.instrument_id}/sign`, {
          method: "POST",
          body: JSON.stringify({
            role,
            quality,
            signer_label: label,
            signer_email: data.signer_email
          })
        }),
      quality === "QES"
        ? `${label} per QES (Skribble) zeichnen? Kein Wechselakzept nach OR.`
        : `${label} mit SES zeichnen? Kein Wechselakzept nach OR.`
    );
  };
  document.querySelectorAll("[data-sign-role]").forEach((button) => {
    button.addEventListener("click", () => startSign(button.getAttribute("data-sign-role")));
  });
  document.getElementById("wb-sign-sync")?.addEventListener("click", () =>
    act(() => api(`/wechsel-drafts/${draft.instrument_id}/sign/sync`, { method: "POST", body: "{}" }))
  );
  document.getElementById("wb-anchor")?.addEventListener("click", () =>
    act(
      () => api(`/wechsel-drafts/${draft.instrument_id}/anchor`, { method: "POST", body: "{}" }),
      "Beleg im Sponsum-Protokoll verankern? Das erzeugt kein Registerwertrecht."
    )
  );
  const acceptBtn = document.getElementById("wb-accept");
  if (acceptBtn) acceptBtn.addEventListener("click", () => startSign("DRAWEE"));
  document.querySelectorAll("[data-zes-sign]").forEach((button) => {
    button.addEventListener("click", () => {
      const assignmentId = button.getAttribute("data-zes-sign");
      const role = button.getAttribute("data-role");
      act(
        () => api(`/assignments/${assignmentId}/sign`, { method: "POST", body: JSON.stringify({ role }) }),
        role === "TRANSFEROR"
          ? "Zedent zeichnet den Zessionsvertrag mit SES?"
          : "Zessionar zeichnet den Zessionsvertrag mit SES?"
      );
    });
  });
  document.getElementById("wb-aval")?.addEventListener("click", () =>
    act(() =>
      api(`/wechsel-drafts/${draft.instrument_id}/guarantee`, {
        method: "POST",
        body: JSON.stringify({ guarantor_party_id: preferredCompany(), kind: "WECHSELAVAL", amount: draft.amount })
      })
    )
  );
  document.getElementById("wb-endorse")?.addEventListener("click", () =>
    act(() => api(`/wechsel-drafts/${draft.instrument_id}/endorse`, { method: "POST", body: "{}" }))
  );
  document.getElementById("wb-protest")?.addEventListener("click", () =>
    act(() => api(`/wechsel-drafts/${draft.instrument_id}/protest`, { method: "POST", body: "{}" }))
  );
  document.getElementById("wb-default")?.addEventListener("click", () =>
    act(
      () => api(`/wechsel-drafts/${draft.instrument_id}/default`, { method: "POST", body: "{}" }),
      "Nichtzahlung als Dispute erfassen? Kein formeller Protest."
    )
  );
  document.getElementById("wb-gar-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    act(
      () => api(`/wechsel-drafts/${draft.instrument_id}/guarantee`, { method: "POST", body: JSON.stringify(data) }),
      "Bürgschaft oder Garantie beifügen? Kein Wechselaval."
    );
  });
  document.getElementById("wb-zes-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    act(
      () => api(`/wechsel-drafts/${draft.instrument_id}/assign`, { method: "POST", body: JSON.stringify(data) }),
      `Beleg an ${data.buyer_party_id} zedieren?`
    );
  });
}

function capitalKindLabel(kind) {
  return labelOf(kind);
}

function matchProviders(need) {
  const amount = Number(need.amount);
  return (workspace.capital_providers || []).filter((provider) => {
    if (!(provider.offers || []).includes(need.kind)) return false;
    if (!(provider.currencies || []).includes(need.currency || "CHF")) return false;
    if (amount < Number(provider.tickets_min) || amount > Number(provider.tickets_max)) return false;
    if (need.kind !== "EQUITY" && provider.max_tenor_months && need.tenor_months > provider.max_tenor_months) return false;
    return true;
  });
}

function renderCapital() {
  const needs = workspace.capital_needs || [];
  const interests = workspace.capital_interests || [];
  const drawerDefault = preferredCompany() || "seller-ui";
  main.innerHTML = `
    <h1>Kapital suchen</h1>
    <p class="lead">Der Mandant sucht Investoren oder Gläubiger — <strong>losgelöst vom Wechsel</strong>. Sponsum vermittelt nur das Gespräch. Kein öffentliches Angebot, kein Fonds, keine Kundengelder.</p>
    ${errorLine()}
    <div class="grid-2">
      <section class="card">
        <h2>Bedarf erfassen</h2>
        <form class="stack" id="kap-form">
          <label>Mandant <select name="seeker_party_id">${partyOptions(drawerDefault, { customers: false })}</select></label>
          <label>Art
            <select name="kind" id="kap-kind">
              <option value="EQUITY">Eigenkapital / Beteiligung</option>
              <option value="SHORT_DEBT">Kurzfristiges Fremdkapital (≤ 12 Monate)</option>
              <option value="LONG_DEBT">Langfristiges Fremdkapital (&gt; 12 Monate)</option>
            </select>
          </label>
          <label>Betrag <input name="amount" inputmode="decimal" required placeholder="0.00" /></label>
          <label id="kap-tenor">Laufzeit in Monaten <input name="tenor_months" inputmode="numeric" value="6" /></label>
          <label>Zweck <input name="purpose" placeholder="z. B. Wachstum, Lager, Maschinen" /></label>
          ${stammdatenHint()}
          <p class="note">Das ist keine Emission und kein Kreditvertrag. Abschluss bleibt bilateral ausserhalb von Sponsum.</p>
          <button type="submit">Passende Parteien suchen</button>
        </form>
      </section>
      <section class="card">
        <h2>Investoren und Gläubiger</h2>
        <table>
          <thead><tr><th>Partei</th><th>Bietet</th><th class="num">Ticket</th></tr></thead>
          <tbody>
            ${(workspace.capital_providers || [])
              .map(
                (row) => `<tr class="clickable" data-href="#/capital/provider/${row.provider_id}">
                  <td><a href="#/capital/provider/${row.provider_id}">${esc(row.display_name)}</a><br><span class="muted">${labelOf(row.kind)}</span></td>
                  <td>${row.offers.map(capitalKindLabel).join(", ")}</td>
                  <td class="num">${formatChf(row.tickets_min)}–${formatChf(row.tickets_max)}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </section>
    </div>
    ${needs
      .map((need) => {
        const matches = matchProviders(need);
        const asked = interests.filter((row) => row.need_id === need.need_id);
        return `<section class="card">
          <h2><a href="#/capital/need/${need.need_id}">${capitalKindLabel(need.kind)} ${formatChf(need.amount, need.currency)}</a> ${badge(need.status)}</h2>
          <p>${esc(need.purpose)}${need.tenor_months ? ` · ${need.tenor_months} Monate` : ""} · ${esc(partyLabel(need.seeker_party_id))}</p>
          <p class="muted">${esc(need.legal_note)}</p>
          <p><a href="#/capital/need/${need.need_id}">Dossier öffnen</a></p>
          ${
            matches.length
              ? `<table>
                  <thead><tr><th>Treffer</th><th>Profil</th><th></th></tr></thead>
                  <tbody>
                    ${matches
                      .map((row) => {
                        const done = asked.find((item) => item.provider_id === row.provider_id);
                        return `<tr>
                          <td><a href="#/capital/provider/${row.provider_id}">${esc(row.display_name)}</a><br><span class="muted">${labelOf(row.kind)} · ${esc(row.regulatory_status)}</span></td>
                          <td>${esc(row.public_blurb)}</td>
                          <td>${
                            done
                              ? badge(done.status)
                              : `<button type="button" data-intro="${need.need_id}" data-provider="${row.provider_id}">Gespräch anfragen</button>`
                          }</td>
                        </tr>`;
                      })
                      .join("")}
                  </tbody>
                </table>`
              : "<p class=\"muted\">Kein Treffer in diesem Ticket- oder Laufzeitband.</p>"
          }
        </section>`;
      })
      .join("")}
  `;
  const form = document.getElementById("kap-form");
  const tenor = document.getElementById("kap-tenor");
  const kind = document.getElementById("kap-kind");
  const syncTenor = () => {
    tenor.hidden = kind.value === "EQUITY";
    if (kind.value === "SHORT_DEBT") form.elements.namedItem("tenor_months").value = "6";
    if (kind.value === "LONG_DEBT") form.elements.namedItem("tenor_months").value = "36";
  };
  kind.addEventListener("change", syncTenor);
  syncTenor();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.amount = String(data.amount).replace(/'/g, "");
    act(() =>
      api("/capital/needs", { method: "POST", body: JSON.stringify(data) }).then((created) => {
        const id = created && created.need && created.need.need_id;
        if (id) window.location.hash = `#/capital/need/${id}`;
      })
    );
  });
  document.querySelectorAll("[data-intro]").forEach((button) => {
    button.addEventListener("click", () =>
      act(
        () =>
          api(`/capital/needs/${button.getAttribute("data-intro")}/interest`, {
            method: "POST",
            body: JSON.stringify({ provider_id: button.getAttribute("data-provider") })
          }),
        "Bilaterales Gespräch anfragen? Sponsum schliesst keinen Vertrag und nimmt kein Geld entgegen."
      )
    );
  });
  bindClickableRows();
}

function renderMarket() {
  main.innerHTML = `
    <h1>Marktplatz</h1>
    <p class="lead">Kein zentrales Orderbuch. Die öffentliche Liste zeigt nur anonymisierte Angaben. Weitere Daten nach Freigabe.</p>
    ${errorLine()}
    <section class="card">
      <h2>Öffentliche Angebote</h2>
      <table>
        <thead><tr><th>Angebot</th><th class="num">Betrag</th><th>Fällig</th><th>Branche</th><th>Risiko</th><th class="num">Prüfung</th><th class="num">Mindestpreis</th><th>Streit</th></tr></thead>
        <tbody>
          ${
            workspace.discovery.length
              ? workspace.discovery
                  .map(
                    (row) => `<tr class="clickable" data-href="#/market/${row.offer_id}">
                <td class="mono"><a href="#/market/${row.offer_id}">${row.offer_id.slice(0, 12)}</a></td>
                <td class="num">${formatChf(row.nominal_amount, row.currency)}</td>
                <td>${formatDue(row.maturity_date)}</td>
                <td>${row.sector === "industrial" ? "Industrie" : row.sector} ${row.country}</td>
                <td>${row.risk_class}</td>
                <td class="num">${row.verification_score}/100</td>
                <td class="num">${row.min_price ? formatChf(row.min_price, row.currency) : "—"}</td>
                <td>${row.dispute === "none" ? "keiner" : "ja"}</td>
              </tr>`
                  )
                  .join("")
              : emptyRow(8, "Keine offenen Angebote.")
          }
        </tbody>
      </table>
    </section>
    <section class="card">
      <h2>Kapitalsuche <a href="#/capital" class="muted">öffnen</a></h2>
      <p class="muted">Eigenkapital und Fremdkapital, ohne Wechsel.</p>
      <table>
        <thead><tr><th>Art</th><th class="num">Betrag</th><th>Laufzeit</th><th>Branche</th></tr></thead>
        <tbody>
          ${(workspace.capital_public || []).length
            ? (workspace.capital_public || [])
                .map(
                  (row) => `<tr class="clickable" data-href="#/capital/need/${row.need_id}">
                    <td><a href="#/capital/need/${row.need_id}">${labelOf(row.kind)}</a></td>
                    <td class="num">${formatChf(row.amount, row.currency)}</td>
                    <td>${row.tenor_months ? `${row.tenor_months} Monate` : "Beteiligung"}</td>
                    <td>${esc(row.sector)} ${esc(row.country)}</td>
                  </tr>`
                )
                .join("")
            : emptyRow(4, "Keine offene Kapitalsuche.")}
        </tbody>
      </table>
    </section>
    <section class="card">
      <h2>Factor- / Institution Nodes</h2>
      <table>
        <thead><tr><th>Node</th><th>Typ</th><th>Status</th><th>Währung</th><th>Ticket</th><th>Pricing API</th></tr></thead>
        <tbody>
          ${workspace.factors
            .map(
              (row) => `<tr class="clickable" data-href="#/factors/${row.node_id}">
                <td><a href="#/factors/${row.node_id}">${row.node_id}</a></td><td>${row.kind}</td><td>${row.regulatory_status}</td>
                <td>${row.currencies.join(", ")}</td><td class="num">${formatChf(row.min_invoice)}–${formatChf(row.max_invoice)}</td>
                <td>${row.pricing_api ? "ja" : "nein"}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
  bindClickableRows();
}

async function renderOfferDetail(offerId) {
  const view = await api(`/offers/${encodeURIComponent(offerId)}?buyer=buyer-1`);
  const min = view.l0.min_price || view.l0.ask_price || view.l0.nominal_amount;
  main.innerHTML = `
    <p><a href="#/market">← Marktplatz</a></p>
    <h1>Offer ${view.offer.offer_id.slice(0, 12)}</h1>
    <p class="lead">Freigabestufe ${view.level}. Schuldnerdaten erst nach Zustimmung.</p>
    ${errorLine()}
    <section class="card">
      <h2>Stufe 0 — öffentlich</h2>
      <p>${formatChf(view.l0.nominal_amount, view.l0.currency)} · Fällig ${formatDue(view.l0.maturity_date)} · ${view.l0.sector === "industrial" ? "Industrie" : view.l0.sector} ${view.l0.country}</p>
      <p>Risiko ${view.l0.risk_class} · Prüfung ${view.l0.verification_score}/100 · Mindestpreis ${view.l0.min_price ? formatChf(view.l0.min_price, view.l0.currency) : "—"} · Streit ${view.l0.dispute === "none" ? "keiner" : "ja"}</p>
      <p>${labelOf(view.l0.factoring_mode)} · ${labelOf(view.l0.notice_mode)} · ${badge(view.offer.status)}</p>
    </section>
    <section class="card">
      <h2>Stufe 1 — interessierter Käufer</h2>
      ${
        view.l1
          ? `<p>Schuldner <strong>${view.l1.debtor_party_id}</strong><br>Rechnung ${view.l1.invoice_id}<br>Verkäufer ${view.l1.seller_party_id}<br>Offen ${formatChf(view.l1.outstanding_amount)} · akzeptiert ${formatChf(view.l1.accepted_amount)}</p>`
          : `<p class="muted">Noch nicht freigegeben.</p><button type="button" id="req-l1">Stufe 1 anfordern</button>`
      }
    </section>
    <section class="card">
      <h2>Stufe 2 — Prüfung</h2>
      ${
        view.l2
          ? `<p>Asset ${view.l2.receivable_id}<br>Instrument ${view.l2.instrument_type}<br>Lock ${view.l2.lock.state}<br><span class="mono">${view.l2.content_hash}</span></p>
             <p><a href="#/receivables/${view.l2.receivable_id}">Zum Dossier</a></p>`
          : `<p class="muted">Vertrag, Liefernachweis und Kommunikation erst nach Zustimmung des Verkäufers.</p>
             ${view.level >= 1 ? `<button type="button" id="req-l2">Stufe 2 anfordern</button>` : ""}`
      }
    </section>
    <section class="card">
      <h2>Gebot abgeben</h2>
      <form class="stack" id="bid-form">
        <label>Käufer <input name="buyer_party_id" required placeholder="Ihre Partei-ID" /></label>
        <label>Betrag <input name="amount" inputmode="decimal" required placeholder="${formatChf(min)}" /></label>
        <button type="submit">Gebot senden</button>
      </form>
      <ul>${(view.bids || []).map((bid) => `<li>${bid.buyer_party_id} ${bid.amount} ${badge(bid.status)}</li>`).join("")}</ul>
    </section>
  `;
  const req1 = document.getElementById("req-l1");
  if (req1) req1.addEventListener("click", () => act(() => api(`/offers/${offerId}/disclosure-requests`, { method: "POST", body: JSON.stringify({ buyer_party_id: "buyer-1", level: 1 }) })));
  const req2 = document.getElementById("req-l2");
  if (req2) req2.addEventListener("click", () => act(() => api(`/offers/${offerId}/disclosure-requests`, { method: "POST", body: JSON.stringify({ buyer_party_id: "buyer-1", level: 2 }) })));
  const bidForm = document.getElementById("bid-form");
  if (bidForm) {
    bidForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(bidForm).entries());
      data.amount = String(data.amount).replace(/'/g, "");
      act(() => api(`/offers/${offerId}/bids`, { method: "POST", body: JSON.stringify(data) }), `Gebot ${formatChf(data.amount)} senden?`);
    });
  }
}

function renderPortfolio() {
  const book = workspace.portfolio;
  main.innerHTML = `
    <h1>Käufer-Portfolio</h1>
    <div class="kpis">
      <div class="kpi"><strong>${formatChf(book.invested)}</strong><span>Investiert</span></div>
      <div class="kpi"><strong>${formatChf(book.outstanding_nominal)}</strong><span>Nominal offen</span></div>
      <div class="kpi"><strong>${formatChf(book.expected_income)}</strong><span>Erwarteter Ertrag</span></div>
    </div>
    <section class="card" data-testid="sponsum-portfolio">
      <p data-testid="sponsum-portfolio-invested">Investiert ${formatChf(book.invested)}</p>
      <p data-testid="sponsum-portfolio-outstanding">Nominal offen ${formatChf(book.outstanding_nominal)}</p>
      <p data-testid="sponsum-portfolio-income">Erwarteter Ertrag ${formatChf(book.expected_income)}</p>
      <table>
        <thead><tr><th>Forderung</th><th>Schuldner</th><th class="num">Offen</th><th>Status</th><th>Risiko</th></tr></thead>
        <tbody>
          ${
            book.items.length
              ? book.items
                  .map(
                    (item) =>
                      `<tr><td><a href="#/receivables/${item.receivable_id}">${item.receivable_id}</a></td><td>${item.debtor_party_id}</td><td class="num">${formatChf(item.outstanding_amount)}</td><td>${badge(item.status)}</td><td>${item.risk_class}</td></tr>`
                  )
                  .join("")
              : emptyRow(5, "Keine Positionen.")
          }
        </tbody>
      </table>
    </section>
  `;
}

function renderSettlement() {
  const open = workspace.settlements.filter((row) => row.status === "ISSUED" || row.status === "SEEN");
  const hashId = (window.location.hash.match(/^#\/settlement\/([^/?]+)/) || [])[1];
  const expandId = hashId ? decodeURIComponent(hashId) : "";
  main.innerHTML = `
    <h1>Abrechnung</h1>
    <p class="lead">Der Käufer zahlt den Verkäufer direkt (IBAN und Referenz). Zeilen klappen die Zahlungsdetails auf. Sponsum überträgt das Asset erst nach der Provider-Meldung — nicht über einen «bezahlt»-Klick.</p>
    ${errorLine()}
    <section class="card">
      <table>
        <thead><tr><th>Abschluss</th><th>Abschlussstatus</th><th class="num">Betrag</th><th>IBAN</th><th>Referenz</th><th>Anweisung</th><th></th></tr></thead>
        <tbody>
          ${
            workspace.settlements.length
              ? workspace.settlements
                  .map((row) => {
                    const pending = row.status === "ISSUED" || row.status === "SEEN";
                    const key = settlementKey(row);
                    const safeId = esc(key);
                    const opened = expandId && (expandId === key || expandId === row.instruction_id);
                    return `<tr class="settle-row clickable${opened ? " is-open" : ""}" data-settle="${safeId}">
                <td>
                  <button type="button" class="settle-toggle" aria-expanded="${opened ? "true" : "false"}" aria-controls="settle-panel-${safeId}">
                    <span class="chevron" aria-hidden="true"></span>
                    <span class="visually-hidden">Abschluss aufklappen</span>
                  </button>
                  <span class="mono settle-id">${esc((key || "–").slice(0, 18))}</span>
                </td>
                <td>${row.trade ? badge(row.trade.status) : "–"}</td>
                <td class="num">${formatChf(row.amount, row.currency)}</td>
                <td class="mono">${formatIban(row.payee_iban)}</td>
                <td class="mono">${row.payment_reference}</td>
                <td>${badge(row.status)}</td>
                <td>${
                  pending
                    ? `<button type="button" data-confirm="${row.instruction_id}">Zahlungseingang übernehmen</button>`
                    : "—"
                }</td>
              </tr>
              <tr class="settle-detail" id="settle-panel-${safeId}" ${opened ? "" : "hidden"}>
                <td colspan="7"><div class="settle-panel" data-settle-panel="${safeId}"></div></td>
              </tr>`;
                  })
                  .join("")
              : emptyRow(7, "Keine Zahlungsanweisungen.")
          }
        </tbody>
      </table>
      ${
        workspace.settlements.length === 0
          ? `<p class="muted">Zuerst ein Gebot annehmen oder eine Zession abschliessen.</p>`
          : open.length === 0
            ? `<p class="muted">Keine offene Zahlung. Zeile aufklappen für IBAN, Referenz und Protokoll.</p>`
            : ""
      }
    </section>
  `;
  main.querySelectorAll("tr.settle-row").forEach((row) => {
    const toggle = () => toggleSettlementRow(row);
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button[data-confirm], input, select, label")) return;
      toggle();
    });
    row.querySelector(".settle-toggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggle();
    });
    if (row.classList.contains("is-open")) toggleSettlementRow(row, true);
  });
  main.querySelectorAll("[data-confirm]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      act(
        () =>
        api(`/settlements/${button.getAttribute("data-confirm")}/provider-confirm`, {
          method: "POST",
          body: JSON.stringify({ provider: "external-psp" })
        }),
        "Zahlungseingang übernehmen und das Asset übertragen? Dieser Schritt ist nicht umkehrbar."
      );
    });
  });
}

function disputeListView() {
  const query = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const view = query.get("view");
  return view === "closed" || view === "archived" || view === "all" ? view : "open";
}

function renderDisputes() {
  const all = workspace.disputes || [];
  const view = disputeListView();
  const rows = view === "all" ? all : all.filter((row) => (row.lifecycle || "open") === view);
  const open = all.filter((row) => (row.lifecycle || "open") === "open");
  const closed = all.filter((row) => row.lifecycle === "closed");
  const archived = all.filter((row) => row.lifecycle === "archived");
  const court = open.filter((row) => row.court_stage && row.court_stage !== "idle");
  const candidates = workspace.dispute_candidates || [];
  const tab = (id, label, count) =>
    `<a href="#/disputes?view=${id}" class="${view === id ? "is-on" : ""}">${label} (${count})</a>`;
  main.innerHTML = `
    <h1>Dispute</h1>
    <p class="lead">Zwei Spuren, ein Dossier: aussergerichtlich (Verhandlung, Mediation, Resolve) und staatlich (eSchKG, Justitia). Keine parallele Gerichtsakte.</p>
    ${errorLine()}
    <div class="kpis">
      <div class="kpi"><strong>${open.length}</strong><span>Offene Streitfälle</span></div>
      <div class="kpi"><strong>${court.length}</strong><span>Staatlich erfasst</span></div>
      <div class="kpi"><strong>${closed.length}</strong><span>Geschlossen</span></div>
      <div class="kpi"><strong>${archived.length}</strong><span>Archiv</span></div>
    </div>
    <nav class="tabs" aria-label="Dispute-Status">
      ${tab("open", "Offen", open.length)}
      ${tab("closed", "Geschlossen", closed.length)}
      ${tab("archived", "Archiv", archived.length)}
      ${tab("all", "Alle", all.length)}
    </nav>
    <section class="card">
      <h2>Neuen Streitfall eröffnen</h2>
      <p class="muted">Startet am Asset. Danach kein unbelasteter Verkauf, bis der Fall geschlossen und die Forderung wieder freigegeben ist.</p>
      <form id="dispute-open-form" class="stack">
        <label>Forderung
          <select name="receivable_id" required>
            <option value="">Bitte wählen</option>
            ${candidates
              .map(
                (row) =>
                  `<option value="${esc(row.receivable_id)}">${esc(row.invoice_id)} · ${esc(row.receivable_id)} · ${formatChf(row.nominal_amount, row.currency)} · ${labelOf(row.status)}</option>`
              )
              .join("")}
          </select>
        </label>
        <div class="grid-2">
          <label>Bestrittener Betrag (CHF)
            <input name="disputed_amount" type="number" min="0.01" step="0.01" required placeholder="z. B. 10000" />
          </label>
          <label>Resolve-Fall (optional)
            <input name="resolve_case_id" placeholder="resolve-…" />
          </label>
        </div>
        <div class="actions"><button class="btn" type="submit">Streitfall eröffnen</button></div>
      </form>
      ${candidates.length ? "" : `<p class="muted">Keine geeignete offene Forderung. Zuerst unter Forderungen eine akzeptierte Rechnung anlegen.</p>`}
    </section>
    <section class="card">
      <table>
        <thead><tr><th>Fall</th><th>Rechnung</th><th>Asset</th><th>Fallstatus</th><th>Aussergerichtlich</th><th>Staatlich</th><th class="num">Bestritten</th><th>Inhaber</th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((row) => {
                    const href = disputeHref(row);
                    return `<tr class="clickable" data-href="${href}">
                <td><a href="${href}">${esc(row.resolve_case_id || row.dispute_id)}</a></td>
                <td><a href="#/receivables/${row.receivable_id}">${esc(row.invoice_id)}</a></td>
                <td>${badge(row.status)}</td>
                <td>${badge(row.lifecycle || "open")}</td>
                <td>${badge(row.ooc_stage || "negotiation")}</td>
                <td>${badge(row.court_stage || "idle")}</td>
                <td class="num">${formatChf(row.disputed_amount)}</td>
                <td>${esc(partyLabel(row.current_holder_party_id))}</td>
              </tr>`;
                  })
                  .join("")
              : emptyRow(8, view === "open" ? "Keine offenen Streitfälle." : "Keine Einträge in dieser Ansicht.")
          }
        </tbody>
      </table>
    </section>
  `;
  bindClickableRows();
  const openForm = document.getElementById("dispute-open-form");
  if (openForm) {
    openForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(openForm).entries());
      act(async () => {
        const created = await api("/disputes", {
          method: "POST",
          body: JSON.stringify({
            receivable_id: data.receivable_id,
            disputed_amount: data.disputed_amount,
            resolve_case_id: data.resolve_case_id || undefined
          })
        });
        const id = created.dispute?.dispute_id || created.asset?.receivable_id || data.receivable_id;
        window.location.hash = `#/disputes/${encodeURIComponent(id)}`;
      }, "Streitfall eröffnen? Ein unbelasteter Verkauf ist danach nicht möglich.");
    });
  }
}

async function renderDisputeDossier(id) {
  let pack;
  try {
    pack = await api(`/disputes/${encodeURIComponent(id)}`);
  } catch (error) {
    main.innerHTML = notFoundCard("Streitfall", error.message, "#/disputes", "Dispute");
    return;
  }
  const dispute = pack.dispute;
  const asset = pack.asset;
  const bench = pack.workbench || {};
  const justitia = pack.justitia || dispute.justitia || {};
  const templates = pack.templates || [];
  const forms = bench.forms || [];
  const exports = bench.exports || [];
  main.innerHTML = `
    <p class="muted"><a href="#/disputes">← Dispute</a> · <a href="#/receivables/${asset.receivable_id}">Forderung</a></p>
    <h1>${esc(dispute.resolve_case_id || dispute.dispute_id)}</h1>
    <p class="lead">Rechnung ${esc(asset.invoice_id)} · ${formatChf(asset.nominal_amount, asset.currency)} · ${badge(asset.status)} · Fall ${badge(bench.lifecycle || "open")}. Inhaber ${esc(partyLabel(asset.current_holder_party_id))} (Holder gewinnt).</p>
    ${errorLine()}
    <div class="kpis">
      <div class="kpi"><strong>${formatChf(asset.nominal_amount, asset.currency)}</strong><span>Nominal</span></div>
      <div class="kpi"><strong>${formatChf(asset.accepted_amount, asset.currency)}</strong><span>Akzeptiert</span></div>
      <div class="kpi"><strong>${formatChf(asset.disputed_amount, asset.currency)}</strong><span>Bestritten</span></div>
      <div class="kpi"><strong>${badge(bench.ooc_stage)}</strong><span>Aussergerichtlich</span></div>
      <div class="kpi"><strong>${badge(bench.court_stage)}</strong><span>Staatlich</span></div>
    </div>
    <div class="grid-2">
      <section class="card">
        <h2>Aussergerichtlich</h2>
        <p class="muted">Verhandlung, Mediation, Movena Resolve. Sperrt einen unbelasteten Verkauf.</p>
        <form id="ooc-form" class="stack">
          <label>Stufe
            <select name="ooc_stage">
              ${["negotiation", "mediation", "resolve", "settled", "withdrawn"]
                .map((stage) => `<option value="${stage}" ${bench.ooc_stage === stage ? "selected" : ""}>${labelOf(stage)}</option>`)
                .join("")}
            </select>
          </label>
          <div class="actions"><button class="btn" type="submit">Stufe speichern</button></div>
        </form>
      </section>
      <section class="card">
        <h2>Staatlich · Justitia / eSchKG</h2>
        <p class="muted">Justitia bleibt Sendungs-SoR. Die Suite orchestriert nur. Kein Auto-Receive, kein PROD-Submit.</p>
        <form id="court-form" class="stack">
          <label>Stufe
            <select name="court_stage">
              ${["idle", "eschkg", "justitia_inbox", "justitia_filed"]
                .map((stage) => `<option value="${stage}" ${bench.court_stage === stage ? "selected" : ""}>${labelOf(stage)}</option>`)
                .join("")}
            </select>
          </label>
          <label>eSchKG-Fall
            <input name="eschkg_case_id" value="${esc(bench.eschkg_case_id || "")}" placeholder="ESCHK-…" />
          </label>
          <div class="actions">
            <button class="btn" type="submit">Staatlich speichern</button>
            <a class="btn ghost" href="${esc(justitia.inbox_url || "/justitia/")}">Justitia-Postfach</a>
            <a class="btn ghost" href="${esc(justitia.compose_url || "/justitia/")}">Eingabe vorbereiten</a>
          </div>
        </form>
      </section>
    </div>
    ${renderDisputeLifecycleCard(bench, asset)}
    <div id="venue-card-host">${renderVenueCard(pack.venue, bench)}</div>
    ${renderFulfilmentCard(pack.fulfilment)}
    <section class="card">
      <h2>Stammdaten und Verknüpfungen</h2>
      <p class="muted">Diese Sätze fliessen in den Formulargenerator. Inhaber gewinnt gegen Origin-Gläubiger.</p>
      <p><strong>Schuldnerin</strong> ${esc(partyLabel(asset.debtor_party_id))}<br>
      <strong>Inhaberin</strong> ${esc(partyLabel(asset.current_holder_party_id))}<br>
      <strong>Origin-Gläubigerin</strong> ${esc(partyLabel(asset.creditor_party_id))}</p>
      <div class="links">${(bench.links || []).map((link) => `<span class="chip">${esc(link.doctype)}: ${esc(link.label)}</span>`).join("") || "<span class='muted'>Noch keine zusätzlichen Verknüpfungen</span>"}</div>
      <form id="link-form" class="stack" action="#" method="post">
        <label>Datensatz verknüpfen
          <select name="packed" id="link-packed">
            ${(pack.catalog || [])
              .map((item) => `<option value="${esc(item.doctype)}::${esc(item.name)}::${esc(item.label)}">${esc(item.doctype)} · ${esc(item.label)}</option>`)
              .join("")}
          </select>
        </label>
        <div class="actions"><button class="btn ghost" id="link-btn" type="button">Verknüpfen</button></div>
      </form>
    </section>
    <div class="grid-2">
      <section class="card">
        <h2>Formulargenerator</h2>
        <p class="muted">Entwürfe für Rechtsschriften und Repliken. Gerichtsstand und Fristen stehen oben unabhängig vom Schreiben. ${
          pack.form_ai?.enabled
            ? `OpenAI (${esc(pack.form_ai.model)}) aus den Suite-OCR-Settings. Kein Rechtsrat.`
            : "OpenAI ist nicht konfiguriert — es bleibt der Vorlagentext. Kein Rechtsrat."
        }</p>
        <form id="form-gen" class="stack" action="#" method="post">
          <label>Vorlage
            <select name="template_id" id="form-template">
              ${templates
                .map((row) => `<option value="${row.id}">${esc(row.title)} · ${row.track === "court" ? "staatlich" : row.track === "out_of_court" ? "aussergerichtlich" : "beide"}</option>`)
                .join("")}
            </select>
          </label>
          <label>Hinweis an die KI
            <textarea name="instruction" id="form-instruction" rows="3" placeholder="z. B. Frist 10 Tage, nur unbestrittener Teil"></textarea>
          </label>
          <label class="check"><input type="checkbox" name="use_ai" id="form-use-ai" ${pack.form_ai?.enabled ? "checked" : ""} ${pack.form_ai?.enabled ? "" : "disabled"} /> KI-Entwurf über OpenAI</label>
          <div class="actions">
            <button class="btn" id="form-gen-btn" type="button">Entwurf erzeugen</button>
          </div>
          <p class="muted" id="form-gen-status" role="status"></p>
        </form>
        ${
          forms[0]
            ? `<div class="note" id="form-preview"><strong>${esc(forms[0].title)}</strong> · ${forms[0].source === "openai" ? "OpenAI" : "Vorlage"}<pre class="form-draft">${esc((forms[0].lines || []).join("\n"))}</pre></div>`
            : `<p class="muted">Noch keine Entwürfe.</p>`
        }
        ${
          forms.length
            ? `<ul class="plain-list">${forms
                .map(
                  (row) =>
                    `<li>${esc(row.title)} · ${row.source === "openai" ? "OpenAI" : "Vorlage"} <button type="button" class="linkish" data-form-pdf="${row.id}">PDF</button></li>`
                )
                .join("")}</ul>`
            : ""
        }
      </section>
      <section class="card">
        <h2>Dossier an Fachperson</h2>
        <p class="muted">ZIP mit Manifest, Deckblatt und Entwürfen. Keine vollständige Justizakte.</p>
        <form id="export-form" class="stack">
          <label>Zu Handen
            <input name="recipient" required placeholder="Kanzlei / Mediator / Treuhänder" />
          </label>
          <label class="check"><input type="checkbox" name="confirm" /> Ich bestätige den Export ausdrücklich.</label>
          <div class="actions"><button class="btn" type="submit">Briefing exportieren</button></div>
        </form>
        ${
          exports.length
            ? `<ul class="plain-list">${exports
                .map(
                  (row) =>
                    `<li>${esc(row.recipient)} · ${esc((row.created_at || "").slice(0, 10))} <button type="button" class="linkish" data-export="${row.id}">ZIP</button></li>`
                )
                .join("")}</ul>`
            : ""
        }
      </section>
    </div>
    <section class="card">
      <h2>Fallkontext</h2>
      <p>Schuldner ${esc(partyLabel(asset.debtor_party_id))} · Origin-Gläubiger ${esc(partyLabel(asset.creditor_party_id))} · Inhaber ${esc(partyLabel(asset.current_holder_party_id))}</p>
      <p class="muted">${esc(bench.notes || "Resolve bleibt getrennt vom Risk Score.")}</p>
      <div class="actions">
        <a class="btn ghost" href="#/receivables/${asset.receivable_id}">Forderungsdossier</a>
        ${(pack.wechsel_drafts || [])
          .map((row) => `<a class="btn ghost" href="#/wechsel/${row.instrument_id}">Wechsel ${row.instrument_id}</a>`)
          .join("")}
      </div>
    </section>
    ${
      (pack.trades || []).length
        ? `<section class="card"><h2>Abschlüsse</h2>${pack.trades
            .map(
              (row) =>
                `<p><a href="${settlementHref(row)}">${row.trade_id}</a> · ${formatChf(row.purchase_price, row.currency)} · ${badge(row.status)}</p>`
            )
            .join("")}</section>`
        : ""
    }
    <section class="card">
      <h2>Protokoll</h2>
      ${eventTable(pack.events)}
    </section>
  `;

  bindDisputeLifecycle(asset.receivable_id);
  bindVenueCard(asset.receivable_id, bench);
  void (async () => {
    try {
      const query = new URLSearchParams();
      if (bench.procedure_family) query.set("family", bench.procedure_family);
      if (bench.deadline_start) query.set("from", bench.deadline_start);
      const venue = await api(`/disputes/${encodeURIComponent(asset.receivable_id)}/venue?${query.toString()}`);
      const host = document.getElementById("venue-card-host");
      if (!host) return;
      host.innerHTML = renderVenueCard(venue, bench);
      bindVenueCard(asset.receivable_id, bench);
      const status = document.getElementById("venue-status");
      if (status && !status.textContent) status.textContent = "Aus Stammdaten ermittelt. Kein Schreiben nötig.";
    } catch {
      /* Dossier-Karte bleibt als Fallback */
    }
  })();
  const ooc = document.getElementById("ooc-form");
  if (ooc) {
    ooc.addEventListener("submit", (event) => {
      event.preventDefault();
      const stage = new FormData(ooc).get("ooc_stage");
      act(() => api(`/disputes/${encodeURIComponent(asset.receivable_id)}/track`, { method: "POST", body: JSON.stringify({ ooc_stage: stage }) }));
    });
  }
  const court = document.getElementById("court-form");
  if (court) {
    court.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(court).entries());
      act(() => api(`/disputes/${encodeURIComponent(asset.receivable_id)}/track`, { method: "POST", body: JSON.stringify(data) }));
    });
  }
  const linkBtn = document.getElementById("link-btn");
  if (linkBtn) {
    linkBtn.addEventListener("click", (event) => {
      event.preventDefault();
      const packed = String(document.getElementById("link-packed")?.value || "");
      const [doctype, name, label] = packed.split("::");
      if (!doctype || !name) return;
      act(() =>
        api(`/disputes/${encodeURIComponent(asset.receivable_id)}/links`, {
          method: "POST",
          body: JSON.stringify({ links: [{ doctype, name, label: label || name }] })
        })
      );
    });
  }
  const formGen = document.getElementById("form-gen");
  const formBtn = document.getElementById("form-gen-btn");
  const formStatus = document.getElementById("form-gen-status");
  async function createFormDraft() {
    if (busy) {
      if (formStatus) formStatus.textContent = "Bitte warten — ein Entwurf wird bereits erzeugt.";
      return;
    }
    const templateId = document.getElementById("form-template")?.value;
    if (!templateId) {
      lastError = "Bitte eine Vorlage wählen.";
      if (formStatus) formStatus.textContent = lastError;
      return;
    }
    const instruction = document.getElementById("form-instruction")?.value || "";
    const useAi = Boolean(document.getElementById("form-use-ai")?.checked);
    if (formBtn) formBtn.disabled = true;
    if (formStatus) formStatus.textContent = useAi ? "OpenAI schreibt den Entwurf…" : "Vorlage wird erzeugt…";
    await act(async () => {
      const created = await api(`/disputes/${encodeURIComponent(asset.receivable_id)}/forms`, {
        method: "POST",
        body: JSON.stringify({
          template_id: templateId,
          instruction: instruction || undefined,
          use_ai: useAi
        })
      });
      if (created.warning) lastError = created.warning;
    });
    if (formBtn) formBtn.disabled = false;
    if (formStatus && !lastError) formStatus.textContent = "Entwurf gespeichert.";
  }
  if (formGen) {
    formGen.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void createFormDraft();
    });
  }
  if (formBtn) {
    formBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void createFormDraft();
    });
  }
  const exportForm = document.getElementById("export-form");
  if (exportForm) {
    exportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(exportForm);
      try {
        const created = await api(`/disputes/${encodeURIComponent(asset.receivable_id)}/exports`, {
          method: "POST",
          body: JSON.stringify({ recipient: data.get("recipient"), confirm: data.get("confirm") === "on" })
        });
        await downloadPath(created.download.replace("/api/sponsum/v1", ""), created.export.filename);
        workspace = await loadWorkspace();
        await route();
      } catch (error) {
        lastError = error.message;
        await route();
      }
    });
  }
  main.querySelectorAll("[data-form-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      const formId = button.getAttribute("data-form-pdf");
      downloadPath(`/disputes/${encodeURIComponent(asset.receivable_id)}/forms/${formId}/pdf`, `${formId}.pdf`).catch(
        (error) => {
          lastError = error.message;
          route();
        }
      );
    });
  });
  main.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const exportId = button.getAttribute("data-export");
      downloadPath(`/disputes/${encodeURIComponent(asset.receivable_id)}/exports/${exportId}`, `briefing-${exportId}.zip`).catch(
        (error) => {
          lastError = error.message;
          route();
        }
      );
    });
  });
}

async function renderSettlementDossier(id) {
  let pack;
  try {
    pack = await api(`/settlements/${encodeURIComponent(id)}`);
  } catch (error) {
    main.innerHTML = notFoundCard("Abschluss", error.message, "#/settlement", "Abrechnung");
    return;
  }
  const trade = pack.trade;
  const inst = pack.instruction;
  const pending = inst && (inst.status === "ISSUED" || inst.status === "SEEN");
  main.innerHTML = `
    <p class="muted"><a href="#/settlement">← Abrechnung</a> · <a href="#/receivables/${trade.receivable_id}">Forderung</a></p>
    <h1>Abschluss ${trade.trade_id.slice(0, 18)}</h1>
    <p class="lead">${esc(partyLabel(trade.seller_party_id))} → ${esc(partyLabel(trade.buyer_party_id))} · ${formatChf(trade.purchase_price, trade.currency)} · ${badge(trade.status)}</p>
    ${errorLine()}
    <div class="kpis">
      <div class="kpi"><strong>${formatChf(trade.nominal_amount, trade.currency)}</strong><span>Nominal</span></div>
      <div class="kpi"><strong>${formatChf(trade.purchase_price, trade.currency)}</strong><span>Kaufpreis</span></div>
      <div class="kpi"><strong>${inst ? badge(inst.status) : "—"}</strong><span>Anweisung</span></div>
      <div class="kpi"><strong>${pack.observation ? badge("CONFIRMED") : badge("PENDING")}</strong><span>Provider</span></div>
    </div>
    <div class="grid-2">
      <section class="card">
        <h2>Zahlung</h2>
        ${
          inst
            ? `<p>Zahlen Sie ${formatChf(inst.amount, inst.currency)} an ${formatIban(inst.payee_iban)}</p>
               <p>Referenz <span class="mono">${inst.payment_reference}</span></p>
               <p>Zahler ${esc(partyLabel(inst.payer_party_id))} · Empfänger ${esc(partyLabel(inst.payee_party_id))}</p>
               <p class="note">Die Übertragung erfolgt erst nach Bestätigung des Zahlungsproviders.</p>
               ${pending ? `<button type="button" id="act-psp">Zahlungseingang vom Provider übernehmen</button>` : ""}`
            : `<p class="muted">Keine Zahlungsanweisung.</p>`
        }
      </section>
      <section class="card">
        <h2>Verknüpfungen</h2>
        <p>Forderung <a href="#/receivables/${trade.receivable_id}">${trade.receivable_id}</a><br>
        Rechnung ${pack.asset.invoice_id} · ${badge(pack.asset.status)}</p>
        ${pack.offer ? `<p>Angebot <a href="#/market/${pack.offer.offer_id}">${pack.offer.offer_id}</a> · ${badge(pack.offer.status)}</p>` : ""}
        ${pack.bid ? `<p>Gebot ${pack.bid.buyer_party_id} ${formatChf(pack.bid.amount, trade.currency)} ${badge(pack.bid.status)}</p>` : ""}
        ${
          pack.assignment
            ? `<p>Zession <a href="#/zession/${pack.assignment.assignment_id}">${pack.assignment.assignment_id}</a> ${badge(pack.assignment.status)}</p>`
            : `<p class="muted">Kein Zessionsvertrag — reiner Forderungskauf / Liquidität.</p>`
        }
      </section>
    </div>
    ${
      pack.observation
        ? `<section class="card">
            <h2>Provider-Meldung</h2>
            <p>${pack.observation.provider} · ${formatChf(pack.observation.observed_amount, pack.observation.observed_currency)} · ${formatDate(pack.observation.observed_at)}</p>
            <p class="mono">${pack.observation.provider_event_id}</p>
          </section>`
        : ""
    }
    <section class="card">
      <h2>Protokoll</h2>
      ${eventTable(pack.events)}
    </section>
  `;
  const psp = document.getElementById("act-psp");
  if (psp && inst) {
    psp.addEventListener("click", () =>
      act(
        () =>
          api(`/settlements/${inst.instruction_id}/provider-confirm`, {
            method: "POST",
            body: JSON.stringify({ provider: "external-psp" })
          }),
        `Zahlungseingang ${formatChf(inst.amount, inst.currency)} übernehmen und das Asset übertragen?`
      )
    );
  }
}

async function renderZessionDossier(id) {
  let pack;
  try {
    pack = await api(`/assignments/${encodeURIComponent(id)}`);
  } catch (error) {
    main.innerHTML = notFoundCard("Zession", error.message, "#/zession", "Zession");
    return;
  }
  const row = pack.assignment;
  const zedent = findSig(row.signatures, "TRANSFEROR");
  const zessionar = findSig(row.signatures, "TRANSFEREE");
  main.innerHTML = `
    <p class="muted"><a href="#/zession">← Zession</a> · <a href="#/receivables/${row.receivable_id}">Forderung</a></p>
    <h1>Zession ${row.assignment_id}</h1>
    <p class="lead">${esc(row.contract_title)} · ${labelOf(row.factoring_mode)} · ${labelOf(row.notice_mode)} · ${badge(row.status)}</p>
    ${errorLine()}
    <div class="kpis">
      <div class="kpi"><strong>${formatChf(row.purchase_price, row.currency)}</strong><span>Kaufpreis</span></div>
      <div class="kpi"><strong>${formatChf(row.nominal_amount, row.currency)}</strong><span>Nominal</span></div>
      <div class="kpi"><strong>${esc(partyLabel(row.transferor_party_id))}</strong><span>Zedent</span></div>
      <div class="kpi"><strong>${esc(partyLabel(row.transferee_party_id))}</strong><span>Zessionar</span></div>
    </div>
    <div class="grid-2">
      <section class="card">
        <h2>Vertrag</h2>
        <p>${esc(row.legal_basis)}</p>
        <p>Schuldner ${esc(partyLabel(row.debtor_party_id))}<br>
        IBAN ${formatIban(row.payee_iban)}<br>
        Referenz <span class="mono">${row.payment_reference || "—"}</span></p>
        <p>${signLine(zedent, "Zedent")}<br>${signLine(zessionar, "Zessionar")}</p>
        <div class="actions">
          ${zedent ? "" : `<button type="button" data-zes-sign="${row.assignment_id}" data-role="TRANSFEROR">Zedent zeichnet</button>`}
          ${zessionar ? "" : `<button type="button" class="ghost" data-zes-sign="${row.assignment_id}" data-role="TRANSFEREE">Zessionar zeichnet</button>`}
        </div>
      </section>
      <section class="card">
        <h2>Verknüpfungen</h2>
        <p>Forderung <a href="#/receivables/${row.receivable_id}">${row.receivable_id}</a> · ${pack.asset ? badge(pack.asset.status) : ""}</p>
        ${
          pack.trade
            ? `<p>Abschluss <a href="${settlementHref(pack.trade)}">${pack.trade.trade_id}</a> ${badge(pack.trade.status)}</p>`
            : "<p class=\"muted\">Kein Abschluss verknüpft.</p>"
        }
        ${
          pack.instruction
            ? `<p>Anweisung ${badge(pack.instruction.status)} · ${formatChf(pack.instruction.amount, pack.instruction.currency)}</p>`
            : ""
        }
        ${(pack.wechsel_drafts || [])
          .map((draft) => `<p>Wechsel <a href="#/wechsel/${draft.instrument_id}">${draft.instrument_id}</a></p>`)
          .join("")}
      </section>
    </div>
    <section class="card">
      <h2>Protokoll</h2>
      ${eventTable(pack.events)}
    </section>
  `;
  document.querySelectorAll("[data-zes-sign]").forEach((button) => {
    button.addEventListener("click", () => {
      const assignmentId = button.getAttribute("data-zes-sign");
      const role = button.getAttribute("data-role");
      act(
        () => api(`/assignments/${assignmentId}/sign`, { method: "POST", body: JSON.stringify({ role }) }),
        role === "TRANSFEROR"
          ? "Zedent zeichnet den Zessionsvertrag mit SES?"
          : "Zessionar zeichnet den Zessionsvertrag mit SES?"
      );
    });
  });
}

function renderAccounting() {
  main.innerHTML = `
    <h1>Buchungsvorschläge</h1>
    <p class="lead">Keine Buchung ohne Business Event. Vorschläge für Verkauf, Erwerb, Zahlung.</p>
    ${workspace.accounting
      .map(
        (row) => `
      <section class="card">
        <h2><a href="#/accounting/${row.proposal_id}">${row.proposal_id}</a> · ${row.standard} · ${badge(row.status)}</h2>
        <table>
          ${row.lines.map((line) => `<tr><td>${line.account}</td><td class="num">Soll ${formatChf(line.debit)}</td><td class="num">Haben ${formatChf(line.credit)}</td><td>${line.memo}</td></tr>`).join("")}
        </table>
        <p><a href="#/accounting/${row.proposal_id}">Dossier öffnen</a></p>
      </section>`
      )
      .join("") || `<section class="card"><p>Noch keine Vorschläge.</p></section>`}
  `;
}

function renderRisk() {
  main.innerHTML = `
    <h1>Risk Engine</h1>
    <p class="lead">Risk Score und rechtliche Qualifikation bleiben getrennt.</p>
    <section class="card">
      <table>
        <thead><tr><th>Forderung</th><th>Rating</th><th class="num">Prüfung</th><th class="num">Bestritten</th><th>Fällig</th><th>Instrument</th></tr></thead>
        <tbody>
          ${workspace.receivables
            .map(
              (row) => `<tr>
                <td><a href="#/receivables/${row.receivable_id}">${row.receivable_id}</a></td>
                <td>${row.risk_class}</td>
                <td class="num">${row.verification_score}/100</td>
                <td class="num">${formatChf(row.disputed_amount)}</td>
                <td>${formatDue(row.maturity_date)}</td>
                <td>${labelOf(row.instrument_type)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderPolicy() {
  const rows = Object.entries(workspace.policies);
  const features = Object.keys(workspace.policies.CH);
  main.innerHTML = `
    <h1>Jurisdiktionsregeln</h1>
    <p class="lead">Funktionen sind je Land erlaubt, gekennzeichnet oder gesperrt. Wechsel, Aval und Bitcredit gelten nicht automatisch als rechtsgültig.</p>
    <section class="card">
      <table>
        <thead><tr><th>Feature</th>${rows.map(([code]) => `<th>${code}</th>`).join("")}</tr></thead>
        <tbody>
          ${features
            .map((feature) => `<tr><td>${feature}</td>${rows.map(([, policy]) => `<td>${policyBadge(policy[feature])}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderProtocol() {
  main.innerHTML = `
    <h1>Protokoll</h1>
    <p class="lead">Signierte, verkettete Ereignisse. Wiederholungen werden erkannt, Versionen sind nachvollziehbar.</p>
    <section class="card">
      <table>
        <thead><tr><th>Zeit</th><th>Event</th><th>Asset</th><th>Hash</th><th>Prev</th></tr></thead>
        <tbody>
          ${workspace.events
            .map((event) => {
              const asset = event.receivable_id
                ? `<a href="#/receivables/${event.receivable_id}">${event.receivable_id}</a>`
                : "–";
              const extra = event.trade_id
                ? ` · <a href="#/settlement/${event.trade_id}">Abschluss</a>`
                : event.offer_id
                  ? ` · <a href="#/market/${event.offer_id}">Angebot</a>`
                  : "";
              return `<tr>
                <td>${formatDate(event.created_at)} ${String(event.created_at).slice(11, 16)}</td>
                <td>${event.event_type}</td>
                <td>${asset}${extra}</td>
                <td class="mono">${event.event_hash.slice(0, 14)}</td>
                <td class="mono">${(event.prev_event_hash || "genesis").slice(0, 10)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderIdentity() {
  main.innerHTML = `
    <h1>Identität und Käuferprofile</h1>
    <section class="card">
      <h2>KYC</h2>
      <table>
        ${workspace.kyc
          .map(
            (row) => `<tr class="clickable" data-href="#/identity/${encodeURIComponent(row.party_id)}">
          <td><a href="#/identity/${encodeURIComponent(row.party_id)}">${esc(row.party_id)}</a></td>
          <td>${badge(row.status)}</td>
        </tr>`
          )
          .join("")}
      </table>
    </section>
    <section class="card">
      <h2>Investment-Profil</h2>
      ${workspace.buyer_profiles
        .map(
          (row) => `<p><a href="#/identity/${encodeURIComponent(row.party_id)}">${esc(row.party_id)}</a>: ${row.country} ${row.currency}, Rating ≥ ${row.min_debtor_rating}, max. ${row.max_maturity_days} Tage, max. ${formatChf(row.max_single_position, row.currency)}, min. ${row.min_expected_yield}% · ausgeschlossen: ${row.sector_exclusions.join(", ") || "–"}</p>`
        )
        .join("")}
      <p class="muted">Profile dienen der Suche und dem Abgleich. Automatische Käufe bleiben gesperrt.</p>
    </section>
  `;
  bindClickableRows();
}

async function renderCapitalNeedDossier(id) {
  let pack;
  try {
    pack = await api(`/capital/needs/${encodeURIComponent(id)}`);
  } catch (error) {
    main.innerHTML = notFoundCard("Kapitalsuche", error.message, "#/capital", "Kapital");
    return;
  }
  const need = pack.need;
  const asked = pack.interests || [];
  main.innerHTML = `
    <p class="muted"><a href="#/capital">← Kapital</a></p>
    <h1>${capitalKindLabel(need.kind)} ${formatChf(need.amount, need.currency)}</h1>
    <p class="lead">${esc(need.purpose)}${need.tenor_months ? ` · ${need.tenor_months} Monate` : ""} · ${esc(partyLabel(need.seeker_party_id))} · ${badge(need.status)}</p>
    ${errorLine()}
    <section class="card">
      <h2>Bedarf</h2>
      <p>${esc(need.legal_note)}</p>
      <p>Branche ${esc(need.sector)} · ${esc(need.country)} · ${need.need_id}</p>
    </section>
    ${lendingCard(need, pack)}
    <section class="card">
      <h2>Passende Parteien</h2>
      ${(pack.matches || []).length
        ? `<table>
            <thead><tr><th>Partei</th><th>Profil</th><th></th></tr></thead>
            <tbody>
              ${pack.matches
                .map((row) => {
                  const done = asked.find((item) => item.provider_id === row.provider_id);
                  return `<tr>
                    <td><a href="#/capital/provider/${row.provider_id}">${esc(row.display_name)}</a><br><span class="muted">${labelOf(row.kind)}</span></td>
                    <td>${esc(row.public_blurb)}</td>
                    <td>${
                      done
                        ? badge(done.status)
                        : `<button type="button" data-intro="${need.need_id}" data-provider="${row.provider_id}">Gespräch anfragen</button>`
                    }</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>`
        : "<p class=\"muted\">Kein Treffer in diesem Ticket- oder Laufzeitband.</p>"}
    </section>
    <section class="card">
      <h2>Protokoll</h2>
      ${eventTable(pack.events)}
    </section>
  `;
  document.querySelectorAll("[data-intro]").forEach((button) => {
    button.addEventListener("click", () =>
      act(
        () =>
          api(`/capital/needs/${button.getAttribute("data-intro")}/interest`, {
            method: "POST",
            body: JSON.stringify({ provider_id: button.getAttribute("data-provider") })
          }),
        "Bilaterales Gespräch anfragen? Sponsum schliesst keinen Vertrag und nimmt kein Geld entgegen."
      )
    );
  });
  bindLendingCard(need);
}

// Frappe Lending: Lending on erp.movena.ch runs the loan contract (rate, schedule, bookings). Sponsum confirms the
// need, triggers one draft application and shows Lending's status as it is (docs/lending.md).
function lendingCard(need, pack) {
  const note = `<p class="muted">Frappe Lending führt den Kreditvertrag: Zins, Tilgungsplan und Buchung. Sponsum zeigt nur Status und Verweis.</p>`;
  if (need.kind === "EQUITY") {
    return `<section class="card"><h2>Frappe Lending</h2><p class="muted">Eigenkapital läuft nicht über Frappe Lending.</p></section>`;
  }
  if (need.status === "WITHDRAWN") return "";
  if (need.status !== "CONFIRMED") {
    const candidates = pack.lending_candidates || [];
    let body;
    if (!pack.can_confirm) body = `<p class="muted">Bestätigung durch die Mandantenadministration ausstehend.</p>`;
    else if (!candidates.length) body = `<p class="muted">Keine eigene Forderung des Suchenden zum Verknüpfen.</p>`;
    else
      body = `<form id="lending-confirm" class="stack">
          <label>Forderung
            <select name="receivable_id" required>
              ${candidates
                .map(
                  (row) =>
                    `<option value="${esc(row.receivable_id)}">${esc(row.invoice_id)} · ${formatChf(row.outstanding_amount, row.currency)} · ${labelOf(row.status)}</option>`
                )
                .join("")}
            </select>
          </label>
          <button type="submit">Kapitalbedarf bestätigen</button>
        </form>`;
    return `<section class="card"><h2>Frappe Lending</h2>${note}${body}</section>`;
  }
  const receivable = pack.receivable;
  return `<section class="card">
      <h2>Frappe Lending</h2>
      ${note}
      <p>Bestätigt${need.confirmed_at ? ` am ${formatDate(need.confirmed_at)}` : ""} · Forderung
        <a href="#/receivables/${esc(need.receivable_id)}">${esc(receivable ? receivable.invoice_id : need.receivable_id)}</a></p>
      ${pack.can_confirm ? `<p><button type="button" id="lending-request">Kredit in Lending anlegen</button></p>` : ""}
      <div id="lending-status" class="muted">Status aus Frappe Lending wird geladen …</div>
    </section>`;
}

function lendingStatusHtml(data) {
  if (!data.configured) {
    return `<p class="muted">Frappe Lending ist noch nicht eingerichtet: Kreditprodukt und technischer Benutzer fehlen.</p>`;
  }
  const status = data.lending;
  if (!status) return `<p class="muted">Noch kein Kreditantrag in Lending.</p>`;
  const link = `<a href="${esc(status.deep_link)}" target="_blank" rel="noopener">In Lending öffnen</a>`;
  if (status.stage === "APPLICATION") {
    return `<p>Kreditantrag ${esc(status.application.name)} · ${esc(status.application.status)} · ${link}</p>
      <p class="muted">Quelle ${esc(status.source)}</p>`;
  }
  const loan = status.loan;
  const next = status.next_installment;
  return `<table>
      <tbody>
        <tr><th>Kredit</th><td>${esc(loan.name)} · ${esc(loan.status)}</td></tr>
        <tr><th>Kreditbetrag</th><td>${formatChf(loan.loan_amount)}</td></tr>
        <tr><th>Ausbezahlt</th><td>${formatChf(loan.disbursed_amount)}</td></tr>
        <tr><th>Bezahlt</th><td>${formatChf(loan.total_amount_paid)}</td></tr>
        <tr><th>Nächste Rate</th><td>${next ? `${formatDate(next.payment_date)} · ${formatChf(next.total_payment)}` : "—"}</td></tr>
      </tbody>
    </table>
    <p>${link} · <span class="muted">Quelle ${esc(status.source)}</span></p>`;
}

function bindLendingCard(need) {
  const form = document.getElementById("lending-confirm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const receivableId = new FormData(form).get("receivable_id");
      act(
        () =>
          api(`/capital/needs/${encodeURIComponent(need.need_id)}/confirm`, {
            method: "POST",
            body: JSON.stringify({ receivable_id: receivableId, confirm: true })
          }),
        "Kapitalbedarf mit dieser Forderung bestätigen? Danach kann ein Kreditantrag in Frappe Lending ausgelöst werden."
      );
    });
  }
  const request = document.getElementById("lending-request");
  if (request) {
    request.addEventListener("click", () =>
      act(
        () =>
          api(`/capital/needs/${encodeURIComponent(need.need_id)}/lending`, {
            method: "POST",
            body: JSON.stringify({ confirm: true })
          }),
        "Kreditantrag in Frappe Lending anlegen? Lending prüft, genehmigt, zahlt aus und bucht. Sponsum legt nur den Entwurf an."
      )
    );
  }
  const target = document.getElementById("lending-status");
  if (target && need.receivable_id) {
    api(`/receivables/${encodeURIComponent(need.receivable_id)}/lending`)
      .then((data) => {
        target.className = "";
        target.innerHTML = lendingStatusHtml(data);
      })
      .catch((error) => {
        target.textContent = `Status aus Frappe Lending nicht verfügbar: ${error.message}`;
      });
  }
}

async function renderCapitalProviderDossier(id) {
  let pack;
  try {
    pack = await api(`/capital/providers/${encodeURIComponent(id)}`);
  } catch (error) {
    main.innerHTML = notFoundCard("Kapitalgeber", error.message, "#/capital", "Kapital");
    return;
  }
  const row = pack.provider;
  main.innerHTML = `
    <p class="muted"><a href="#/capital">← Kapital</a></p>
    <h1>${esc(row.display_name)}</h1>
    <p class="lead">${labelOf(row.kind)} · ${esc(row.regulatory_status)}</p>
    ${errorLine()}
    <section class="card">
      <h2>Profil</h2>
      <p>${esc(row.public_blurb)}</p>
      <p>Bietet ${row.offers.map(capitalKindLabel).join(", ")}<br>
      Ticket ${formatChf(row.tickets_min)}–${formatChf(row.tickets_max)} · ${row.currencies.join(", ")} · ${row.countries.join(", ")}
      ${row.max_tenor_months ? `<br>max. ${row.max_tenor_months} Monate` : ""}</p>
    </section>
    <section class="card">
      <h2>Passende Gesuche</h2>
      ${(pack.matching_needs || []).length
        ? pack.matching_needs
            .map(
              (need) =>
                `<p><a href="#/capital/need/${need.need_id}">${capitalKindLabel(need.kind)} ${formatChf(need.amount, need.currency)}</a> ${badge(need.status)} · ${esc(need.purpose)}</p>`
            )
            .join("")
        : "<p class=\"muted\">Kein offenes Gesuch in diesem Ticketband.</p>"}
    </section>
  `;
}

async function renderAccountingDossier(id) {
  let pack;
  try {
    pack = await api(`/accounting/${encodeURIComponent(id)}`);
  } catch (error) {
    main.innerHTML = notFoundCard("Buchungsvorschlag", error.message, "#/accounting", "Buchung");
    return;
  }
  const row = pack.proposal;
  main.innerHTML = `
    <p class="muted"><a href="#/accounting">← Buchung</a>${
      pack.asset ? ` · <a href="#/receivables/${pack.asset.receivable_id}">Forderung</a>` : ""
    }</p>
    <h1>${esc(row.proposal_id)}</h1>
    <p class="lead">${esc(row.standard)} · ${badge(row.status)}</p>
    ${errorLine()}
    <section class="card">
      <h2>Buchungssätze</h2>
      <table>
        ${row.lines
          .map(
            (line) =>
              `<tr><td>${esc(line.account)}</td><td class="num">Soll ${formatChf(line.debit)}</td><td class="num">Haben ${formatChf(line.credit)}</td><td>${esc(line.memo)}</td></tr>`
          )
          .join("")}
      </table>
      <p class="muted">Forderung ${row.receivable_id} · Event ${row.event_id}</p>
    </section>
    <section class="card">
      <h2>Protokoll</h2>
      ${eventTable(pack.events)}
    </section>
  `;
}

async function renderIdentityDossier(id) {
  let pack;
  try {
    pack = await api(`/identity/${encodeURIComponent(id)}`);
  } catch (error) {
    main.innerHTML = notFoundCard("Partei", error.message, "#/identity", "Identität");
    return;
  }
  main.innerHTML = `
    <p class="muted"><a href="#/identity">← Identität</a></p>
    <h1>${esc(pack.party_id)}</h1>
    <p class="lead">KYC ${pack.kyc ? badge(pack.kyc.status) : badge("NONE")}</p>
    ${errorLine()}
    <div class="grid-2">
      <section class="card">
        <h2>KYC</h2>
        <p>${pack.kyc ? badge(pack.kyc.status) : "Kein KYC-Datensatz."}</p>
        ${
          pack.profile
            ? `<p>${pack.profile.country} ${pack.profile.currency}, Rating ≥ ${pack.profile.min_debtor_rating}, max. ${pack.profile.max_maturity_days} Tage, max. ${formatChf(pack.profile.max_single_position, pack.profile.currency)}, min. ${pack.profile.min_expected_yield}%</p>
               <p class="muted">Ausgeschlossen: ${(pack.profile.sector_exclusions || []).join(", ") || "–"}</p>`
            : "<p class=\"muted\">Kein Investment-Profil.</p>"
        }
      </section>
      <section class="card">
        <h2>Rollen</h2>
        ${pack.provider ? `<p>Kapitalgeber <a href="#/capital/provider/${pack.provider.provider_id}">${esc(pack.provider.display_name)}</a></p>` : ""}
        ${pack.factor ? `<p>Factor-Node <a href="#/factors/${pack.factor.node_id}">${pack.factor.node_id}</a></p>` : ""}
        ${!pack.provider && !pack.factor ? "<p class=\"muted\">Keine Katalogrolle.</p>" : ""}
      </section>
    </div>
    <section class="card">
      <h2>Forderungen</h2>
      ${(pack.receivables || []).length
        ? pack.receivables
            .map(
              (row) =>
                `<p><a href="#/receivables/${row.receivable_id}">${row.receivable_id}</a> ${badge(row.status)} · ${formatChf(row.nominal_amount, row.currency)}</p>`
            )
            .join("")
        : "<p class=\"muted\">Keine verknüpften Forderungen.</p>"}
    </section>
    ${
      (pack.trades || []).length
        ? `<section class="card"><h2>Abschlüsse</h2>${pack.trades
            .map((row) => `<p><a href="#/settlement/${row.trade_id}">${row.trade_id}</a> ${badge(row.status)}</p>`)
            .join("")}</section>`
        : ""
    }
  `;
}

async function renderFactorDossier(id) {
  let pack;
  try {
    pack = await api(`/factors/${encodeURIComponent(id)}`);
  } catch (error) {
    main.innerHTML = notFoundCard("Factor-Node", error.message, "#/market", "Marktplatz");
    return;
  }
  const node = pack.node;
  main.innerHTML = `
    <p class="muted"><a href="#/market">← Marktplatz</a> · <a href="#/identity/${encodeURIComponent(node.node_id)}">Identität</a></p>
    <h1>${esc(node.node_id)}</h1>
    <p class="lead">${esc(node.kind)} · ${esc(node.regulatory_status)} · ${esc(node.jurisdiction)}</p>
    ${errorLine()}
    <section class="card">
      <h2>Ticket</h2>
      <p>${formatChf(node.min_invoice)}–${formatChf(node.max_invoice)} · ${node.currencies.join(", ")}</p>
      <p>Pricing API: ${node.pricing_api ? "ja" : "nein"} · KYC ${pack.kyc ? badge(pack.kyc.status) : badge("NONE")}</p>
    </section>
    <section class="card">
      <h2>Abschlüsse</h2>
      ${(pack.trades || []).length
        ? pack.trades
            .map(
              (row) =>
                `<p><a href="#/settlement/${row.trade_id}">${row.trade_id}</a> ${badge(row.status)} · ${formatChf(row.purchase_price, row.currency)}</p>`
            )
            .join("")
        : "<p class=\"muted\">Keine Abschlüsse mit diesem Node.</p>"}
    </section>
    <section class="card">
      <h2>Forderungen</h2>
      ${(pack.receivables || []).length
        ? pack.receivables
            .map((row) => `<p><a href="#/receivables/${row.receivable_id}">${row.receivable_id}</a> ${badge(row.status)}</p>`)
            .join("")
        : "<p class=\"muted\">Keine gehaltenen Forderungen.</p>"}
    </section>
  `;
}

window.addEventListener("hashchange", route);
route();
