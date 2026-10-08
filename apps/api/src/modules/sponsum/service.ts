import { principal } from "./access-context.js";
import { existsGlobally, secureStore, setRecordReaders } from "./scoped-store.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import {
  DomainError,
  assertInstrumentAllowed,
  assertNoAutoBuy,
  assertNoFractionalTokens,
  assertNoSponsumFunds,
  assertTransition,
  bitcreditIssue,
  buildVerificationChecks,
  canCreateSecondLiveOffer,
  canOfferClean,
  computeRiskScore,
  getPolicy,
  POLICIES,
  hashPayload,
  makeProtocolEvent,
  signEventHash,
  OFFER_TRANSITIONS,
  proposeAccounting,
  publicClaimHash,
  RECEIVABLE_TRANSITIONS,
  registerRightIssue,
  scoreVerification,
  SETTLEMENT_TRANSITIONS,
  TRADE_TRANSITIONS,
  type ReceivableAsset,
  type ReceivableStatus,
  type SettlementInstruction,
  type SettlementObservation,
  type SponsumInstrumentType,
  type Trade,
  type VerificationEvidence
} from "@sponsum/shared";
import {
  FileSponsumStore,
  MemorySponsumStore,
  parseWechselArt,
  type AssignmentPackage,
  type SponsumState,
  type BuyerProfile,
  type CapitalInterest,
  type CapitalKind,
  type CapitalNeed,
  type CapitalProvider,
  type DocumentAnchor,
  type FactorNode,
  type InstrumentSignature,
  type SignatureRole,
  type WechselDraft
} from "./store.js";
import { lookupFulfilmentBox } from "./fulfilment-bridge.js";
import {
  assertLendable,
  createHttpLendingTransport,
  LendingError,
  assertCustodyReference,
  lendingConfigFromEnv,
  listLendingCustomers,
  listLombardSecurities,
  readLendingStatus,
  readLombardStatus,
  requestLoanApplication,
  requestLombardApplication,
  type LendingDeps
} from "./lending-bridge.js";
import { assessJurisdiction } from "./jurisdiction-deadlines.js";
import { readOpenSalesInvoice, validSalesInvoiceName, type OpenSalesInvoice } from "./erp-invoice.js";
import { buildSimplePdf } from "./pdf.js";
import { buildZip } from "./zip.js";
import {
  buildFormAiInput,
  completeOpenAiFormDraft,
  formLinesFromModelText,
  publicFormAiStatus,
  resolveFormAiSettings
} from "./form-ai.js";
import {
  FORM_TEMPLATES,
  addRecordLinks,
  briefingManifest,
  defaultWorkbench,
  isCourtStage,
  isDisputeAssetAction,
  isDisputeOutcome,
  isFormTemplateId,
  isOocStage,
  justitiaComposeUrl,
  matchParty,
  normalizeWorkbench,
  renderFormLines,
  type DisputeAssetAction,
  type DisputeContext,
  type DisputeFormTemplateId,
  type DisputeLifecycle,
  type DisputeOutcome,
  type DisputeWorkbenchRecord,
  type PartyCard,
  type RecordLink
} from "./dispute-workbench.js";
import {
  assertQualityHonored,
  createSkribbleRequest,
  getSkribbleRequest,
  isSkribbleSigned,
  skribbleConfigured,
  type SkribbleQuality
} from "./skribble.js";

export type CreateReceivableInput = {
  invoice_id: string;
  origin?: string;
  origin_tenant_id?: string;
  origin_instance_id?: string;
  currency?: string;
  nominal_amount: string;
  accepted_amount?: string;
  disputed_amount?: string;
  outstanding_amount?: string;
  issue_date: string;
  maturity_date: string;
  creditor_party_id: string;
  debtor_party_id: string;
  instrument_type?: SponsumInstrumentType;
  jurisdiction?: string;
  evidence?: VerificationEvidence;
  payee_iban?: string;
  /** ERPNext Sales Invoice (docstatus 1, outstanding > 0); only accepted through submitReceivable. */
  sales_invoice?: string;
};

export type SettlementWebhookInput = {
  provider: string;
  provider_event_id: string;
  payment_reference: string;
  observed_amount: string;
  observed_currency: string;
  observed_at?: string;
  signed?: boolean;
};

const EVENT_SECRET = "sponsum-node-event-secret";

/**
 * DK-31: Sales Invoices checked live in ERPNext for the step that is running (key: receivable_id, or
 * `new:<invoice>` while a receivable is created). Steps that sell or finance a receivable refuse to run without it.
 */
const verifiedInvoices = new AsyncLocalStorage<Map<string, OpenSalesInvoice>>();

export class SponsumService {
  constructor(private readonly store = new MemorySponsumStore()) { this.store = secureStore(store); }

  /** Frappe Lending access, read from the environment per call; tests inject the in-memory mock. */
  private lendingDeps: () => LendingDeps = defaultLendingDeps;

  setLendingDeps(factory: () => LendingDeps): void {
    this.lendingDeps = factory;
  }

  shareReadAccess(kind: string, id: string, readers: unknown) { return setRecordReaders(this.store, kind, id, readers); }

  /**
   * Route entry for "Neue Forderung" (DK-31). With `sales_invoice` ERPNext is read first; amount, currency, dates and
   * debtor then come from the open Sales Invoice, never from the request.
   */
  async submitReceivable(input: CreateReceivableInput): Promise<ReceivableAsset> {
    const body = { ...(input ?? {}) } as CreateReceivableInput;
    if (body.sales_invoice === undefined || body.sales_invoice === null || String(body.sales_invoice).trim() === "") {
      delete body.sales_invoice;
      return this.createReceivable(body);
    }
    const invoice = await readOpenSalesInvoice(String(body.sales_invoice), this.lendingDeps());
    return verifiedInvoices.run(new Map([[`new:${invoice.name}`, invoice]]), () =>
      this.createReceivable({ ...body, sales_invoice: invoice.name })
    );
  }

  /**
   * DK-31: runs `step` after a live ERPNext check of the receivable's Sales Invoice. Receivables without a linked
   * invoice run unchanged. Offer, sale, assignment and the capital-need confirmation call checkedInvoice().
   */
  async withCheckedInvoice<T>(receivableId: unknown, step: () => T | Promise<T>): Promise<T> {
    const id = String(receivableId ?? "").trim();
    const asset = this.store.snapshot().assets.find((row) => row.receivable_id === id);
    if (!asset?.sales_invoice) return step();
    const invoice = await readOpenSalesInvoice(asset.sales_invoice, this.lendingDeps());
    const checked = new Map(verifiedInvoices.getStore() ?? []);
    checked.set(asset.receivable_id, invoice);
    return verifiedInvoices.run(checked, step);
  }

  /** Receivable behind a bid, so the route can check its invoice before the sale is accepted. */
  receivableOfBid(bidId: string): string {
    const state = this.store.snapshot();
    const bid = state.bids.find((row) => row.bid_id === bidId);
    const offer = bid ? state.offers.find((row) => row.offer_id === bid.offer_id) : undefined;
    if (!offer) throw new DomainError("bid_not_open", "Bid is not open");
    return offer.receivable_id;
  }

  /**
   * The live-checked invoice of a linked receivable, or null without link. ERPNext leads: the open amount and due date
   * follow the invoice (part payments, changed terms) before anything is sold or financed.
   */
  private checkedInvoice(asset: ReceivableAsset): OpenSalesInvoice | null {
    if (!asset.sales_invoice) return null;
    const invoice = verifiedInvoices.getStore()?.get(asset.receivable_id);
    if (!invoice || invoice.name !== asset.sales_invoice) {
      throw new DomainError(
        "invoice_check_required",
        "Die ERPNext-Rechnung dieser Forderung muss vor diesem Schritt live geprüft werden."
      );
    }
    if (invoice.currency !== asset.currency) {
      throw new DomainError("currency_mismatch", "Die Währung der ERPNext-Rechnung weicht von der Forderung ab.");
    }
    asset.outstanding_amount = invoice.outstanding_amount;
    if (invoice.due_date) asset.maturity_date = invoice.due_date;
    return invoice;
  }

  /**
   * DK-31: a receivable that is reserved for financing (confirmed capital need) or financed cannot be offered or sold.
   * Capital needs are owner-scoped, so the check looks at the whole store; only the boolean leaves it.
   */
  private assertNotFinanced(asset: ReceivableAsset): void {
    const id = asset.receivable_id;
    if (
      asset.status === "FINANCED" ||
      existsGlobally(this.store, "capital_needs", (need) => need.receivable_id === id && need.status === "CONFIRMED")
    ) {
      throw new DomainError(
        "receivable_encumbered",
        "Die Forderung ist für eine Finanzierung reserviert oder finanziert und kann nicht angeboten oder verkauft werden."
      );
    }
  }

  /** DK-31: an offered, sold or assigned receivable, or one already linked to another capital need, cannot be financed. */
  private assertNotForSale(state: SponsumState, asset: ReceivableAsset, needId: string): void {
    const id = asset.receivable_id;
    const lock = state.locks.find((row) => row.receivable_id === id);
    const engaged =
      ["OFFERED", "TRADE_LOCKED", "TRANSFERRED", "FINANCED"].includes(asset.status) ||
      asset.current_holder_party_id !== asset.creditor_party_id ||
      (lock !== undefined && lock.state !== "UNLOCKED") ||
      state.offers.some((row) => row.receivable_id === id && row.status === "LIVE") ||
      state.registry.some((row) => row.receivable_id === id && row.status === "ACTIVE") ||
      state.trades.some((row) => row.receivable_id === id && !["CANCELLED", "SETTLEMENT_FAILED"].includes(row.status)) ||
      existsGlobally(
        this.store,
        "capital_needs",
        (need) => need.receivable_id === id && need.status === "CONFIRMED" && need.need_id !== needId
      );
    if (engaged) {
      throw new DomainError(
        "receivable_encumbered",
        "Die Forderung ist angeboten, verkauft, abgetreten oder bereits für eine andere Finanzierung reserviert."
      );
    }
  }

  createReceivable(input: CreateReceivableInput): ReceivableAsset {
    const who = principal();
    if (who) {
      if (input.origin_tenant_id && input.origin_tenant_id !== who.tenantId) throw new DomainError("forbidden", "Fremder Mandant.");
      input = { ...input, origin_tenant_id: who.tenantId };
    }
    let linked: OpenSalesInvoice | null = null;
    if (input.sales_invoice !== undefined && input.sales_invoice !== null && String(input.sales_invoice) !== "") {
      const name = validSalesInvoiceName(input.sales_invoice);
      linked = verifiedInvoices.getStore()?.get(`new:${name}`) ?? null;
      if (!linked) {
        throw new DomainError(
          "invoice_check_required",
          "Eine Forderung aus einer ERPNext-Rechnung wird nur nach der Live-Prüfung in ERPNext angelegt."
        );
      }
      input = fromSalesInvoice(input, linked);
    }
    assertNoSponsumFunds(false);
    assertNoFractionalTokens(false);
    const jurisdiction = input.jurisdiction ?? "CH";
    const instrument = input.instrument_type ?? "ORDINARY_RECEIVABLE";
    assertInstrumentAllowed(jurisdiction, instrument);

    const state = this.store.snapshot();
    const tenant = input.origin_tenant_id ?? "tenant-movena";
    const dup = state.assets.find(
      (asset) =>
        asset.origin_tenant_id === tenant &&
        asset.invoice_id === input.invoice_id &&
        !asset.parent_receivable_id
    );
    // DK-31: the same invoice of the same creditor (or the same ERPNext Sales Invoice) exists at most once across all
    // tenants, otherwise it could be sold or financed twice. Tenant-local placeholder parties stay tenant-scoped.
    const creditorKey = creditorIdentity(input.creditor_party_id, tenant);
    const invoiceKey = normalizedInvoiceNo(input.invoice_id);
    const salesInvoice = normalizedInvoiceNo(input.sales_invoice ?? "");
    const globalDup = existsGlobally(this.store, "assets", (asset) => {
      if (asset.parent_receivable_id) return false;
      const assetSalesInvoice = normalizedInvoiceNo(asset.sales_invoice ?? "");
      if (salesInvoice && (assetSalesInvoice === salesInvoice || normalizedInvoiceNo(asset.invoice_id) === salesInvoice)) {
        return true;
      }
      if (assetSalesInvoice && assetSalesInvoice === invoiceKey) return true;
      return (
        Boolean(invoiceKey) &&
        normalizedInvoiceNo(asset.invoice_id) === invoiceKey &&
        creditorIdentity(asset.creditor_party_id, asset.origin_tenant_id) === creditorKey
      );
    });
    if (dup || globalDup) {
      throw new DomainError(
        "duplicate_invoice",
        "Für diese Rechnung besteht bereits eine Forderung (auch in einem anderen Mandanten möglich). Eine Rechnung kann nur einmal verkauft oder finanziert werden."
      );
    }

    const now = new Date().toISOString();
    const checks = buildVerificationChecks(input.evidence ?? { hasInvoice: true, unpaid: true, hasDispute: false });
    const score = scoreVerification(checks);
    let status: ReceivableStatus = "UNVERIFIED";
    if (score >= 40) status = "VERIFIED";
    if (score >= 50 && checks.no_dispute && checks.unpaid) status = "ACCEPTED";
    if (!checks.no_dispute) status = Number(input.disputed_amount ?? "0") > 0 ? "PARTIALLY_DISPUTED" : "DISPUTED";

    const risk = computeRiskScore({
      verificationScore: score,
      daysToMaturity: daysBetween(input.issue_date, input.maturity_date),
      disputed: !checks.no_dispute,
      debtorKyc: checks.debtor_kyc,
      acceptedRatio: Number(input.accepted_amount ?? input.nominal_amount) / Number(input.nominal_amount)
    });

    const receivable_id = `SPN-CH-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const asset: ReceivableAsset = {
      receivable_id,
      schema_version: "1.0.0",
      origin: input.origin ?? "MOVENA",
      origin_tenant_id: input.origin_tenant_id ?? "tenant-movena",
      origin_instance_id: input.origin_instance_id ?? "local",
      parent_receivable_id: null,
      transfer_type: "ORDINARY_RECEIVABLE",
      instrument_type: instrument,
      status,
      currency: input.currency ?? "CHF",
      nominal_amount: money(input.nominal_amount),
      accepted_amount: money(input.accepted_amount ?? input.nominal_amount),
      disputed_amount: money(input.disputed_amount ?? "0"),
      outstanding_amount: money(input.outstanding_amount ?? input.nominal_amount),
      issue_date: input.issue_date,
      maturity_date: input.maturity_date,
      creditor_party_id: input.creditor_party_id,
      debtor_party_id: input.debtor_party_id,
      current_holder_party_id: input.creditor_party_id,
      invoice_id: input.invoice_id,
      ...(linked ? { sales_invoice: linked.name } : {}),
      content_hash: publicClaimHash({
        invoiceId: input.invoice_id,
        debtorId: input.debtor_party_id,
        amount: money(input.nominal_amount),
        maturity: input.maturity_date,
        issuerNode: input.origin_instance_id ?? "local"
      }),
      verification_score: score,
      risk_class: risk.class,
      resolve_case_id: null,
      created_at: now,
      updated_at: now
    };

    state.assets.push(asset);
    state.locks.push({
      receivable_id,
      state: "UNLOCKED",
      offer_id: null,
      trade_id: null,
      version: 1
    });
    state.verifications.push({
      id: `ver-${randomUUID()}`,
      receivable_id,
      score,
      checks,
      computed_at: now
    });
    this.appendEvent(state, {
      type: "RECEIVABLE_CREATED",
      receivable_id,
      actor: input.creditor_party_id,
      payload: { invoice_id: input.invoice_id, status, score }
    });
    this.appendEvent(state, {
      type: "RECEIVABLE_VERIFIED",
      receivable_id,
      actor: input.creditor_party_id,
      payload: { score, checks }
    });
    this.ensureKyc(state, input.creditor_party_id, "PASSED");
    this.store.replace(state);
    return asset;
  }

  getReceivable(id: string): ReceivableAsset {
    const asset = this.store.snapshot().assets.find((row) => row.receivable_id === id);
    if (!asset) throw new DomainError("not_found", "Receivable not found");
    return asset;
  }

  verify(id: string, evidence: VerificationEvidence): ReceivableAsset {
    const state = this.store.snapshot();
    const asset = mustAsset(state, id);
    const checks = buildVerificationChecks(evidence);
    const score = scoreVerification(checks);
    asset.verification_score = score;
    let next: ReceivableStatus = asset.status;
    if (asset.status === "UNVERIFIED") next = "VERIFIED";
    if (next === "VERIFIED" && checks.no_dispute && checks.unpaid) next = "ACCEPTED";
    if (!checks.no_dispute) next = Number(asset.disputed_amount) > 0 ? "PARTIALLY_DISPUTED" : "DISPUTED";
    if (next !== asset.status) {
      assertTransition(RECEIVABLE_TRANSITIONS, asset.status, next, "receivable");
      asset.status = next;
    }
    asset.updated_at = new Date().toISOString();
    state.verifications.push({
      id: `ver-${randomUUID()}`,
      receivable_id: id,
      score,
      checks,
      computed_at: asset.updated_at
    });
    this.appendEvent(state, {
      type: "RECEIVABLE_VERIFIED",
      receivable_id: id,
      payload: { score, checks }
    });
    this.store.replace(state);
    return asset;
  }

  openDispute(id: string, disputedAmount: string, resolveCaseId?: string): ReceivableAsset {
    const state = this.store.snapshot();
    const asset = mustAsset(state, id);
    asset.disputed_amount = money(disputedAmount);
    const next: ReceivableStatus =
      Number(disputedAmount) > 0 && Number(disputedAmount) < Number(asset.nominal_amount)
        ? "PARTIALLY_DISPUTED"
        : "DISPUTED";
    if (asset.status !== next) {
      assertTransition(RECEIVABLE_TRANSITIONS, asset.status, next, "receivable");
      asset.status = next;
    }
    asset.resolve_case_id = resolveCaseId ?? `resolve-${id}`;
    for (const offer of state.offers.filter((row) => row.receivable_id === id && row.status === "LIVE")) {
      assertTransition(OFFER_TRANSITIONS, offer.status, "WITHDRAWN", "offer");
      offer.status = "WITHDRAWN";
    }
    const lock = mustLock(state, id);
    if (lock.state === "OFFER_LOCK") {
      lock.state = "UNLOCKED";
      lock.offer_id = null;
      lock.version += 1;
    }
    this.appendEvent(state, {
      type: "DISPUTE_OPENED",
      receivable_id: id,
      payload: { disputed_amount: asset.disputed_amount, resolve_case_id: asset.resolve_case_id }
    });
    const bench = this.upsertWorkbench(state, id, asset.resolve_case_id);
    bench.lifecycle = "open";
    bench.close_outcome = null;
    bench.closed_at = null;
    bench.archived_at = null;
    if (!bench.ooc_stage || bench.ooc_stage === "settled" || bench.ooc_stage === "withdrawn") {
      bench.ooc_stage = asset.resolve_case_id ? "resolve" : "negotiation";
    }
    this.store.replace(state);
    return asset;
  }

  createDispute(input: { receivable_id?: string; disputed_amount?: string; resolve_case_id?: string | null }) {
    const receivableId = String(input.receivable_id || "").trim();
    if (!receivableId) throw new DomainError("validation_error", "Forderung wählen.");
    const amount = String(input.disputed_amount ?? "").trim();
    if (!amount || Number(amount) <= 0) {
      throw new DomainError("validation_error", "Bestrittenen Betrag grösser als 0 angeben.");
    }
    const existing = this.readWorkbench(this.store.snapshot(), receivableId);
    const asset = this.getReceivable(receivableId);
    if (existing.lifecycle === "open" && (asset.status === "DISPUTED" || asset.status === "PARTIALLY_DISPUTED")) {
      throw new DomainError("conflict", "Dieser Streitfall ist bereits offen.");
    }
    this.openDispute(receivableId, amount, input.resolve_case_id || `resolve-${asset.invoice_id}`);
    return this.disputeDossier(receivableId);
  }

  closeDispute(
    id: string,
    input: {
      confirm?: unknown;
      outcome?: string;
      asset_action?: string;
      notes?: string;
    }
  ) {
    if (input.confirm !== true) {
      throw new DomainError("validation_error", "Abschluss braucht eine explizite Bestätigung.");
    }
    if (!isDisputeOutcome(String(input.outcome || ""))) {
      throw new DomainError("validation_error", "Ausgang wählen: Einigung oder Rückzug.");
    }
    const action = String(input.asset_action || "restore");
    if (!isDisputeAssetAction(action)) {
      throw new DomainError("validation_error", "Ungültige Forderungsfolge.");
    }
    const dossier = this.disputeDossier(id);
    const state = this.store.snapshot();
    const asset = mustAsset(state, dossier.asset.receivable_id);
    const bench = this.upsertWorkbench(state, asset.receivable_id, asset.resolve_case_id);
    if (bench.lifecycle === "archived") {
      throw new DomainError("conflict", "Archivierter Fall. Zum erneuten Bearbeiten zuerst wiedereröffnen.");
    }
    const outcome = input.outcome as DisputeOutcome;
    bench.ooc_stage = outcome;
    bench.lifecycle = "closed";
    bench.close_outcome = outcome;
    bench.closed_at = new Date().toISOString();
    if (input.notes !== undefined) bench.notes = input.notes;
    this.applyDisputeAssetAction(state, asset, action);
    this.appendEvent(state, {
      type: "DISPUTE_CLOSED",
      receivable_id: asset.receivable_id,
      payload: { outcome, asset_action: action, asset_status: asset.status }
    });
    this.store.replace(state);
    return this.disputeDossier(asset.receivable_id);
  }

  archiveDispute(id: string, input: { confirm?: unknown } = {}) {
    if (input.confirm !== true) {
      throw new DomainError("validation_error", "Archivieren braucht eine explizite Bestätigung.");
    }
    const dossier = this.disputeDossier(id);
    const state = this.store.snapshot();
    const bench = this.upsertWorkbench(state, dossier.asset.receivable_id, dossier.asset.resolve_case_id);
    if (bench.lifecycle !== "closed") {
      throw new DomainError("validation_error", "Nur geschlossene Streitfälle können ins Archiv.");
    }
    bench.lifecycle = "archived";
    bench.archived_at = new Date().toISOString();
    this.appendEvent(state, {
      type: "DISPUTE_ARCHIVED",
      receivable_id: dossier.asset.receivable_id,
      payload: { archived_at: bench.archived_at }
    });
    this.store.replace(state);
    return this.disputeDossier(dossier.asset.receivable_id);
  }

  reopenDispute(id: string, input: { disputed_amount?: string } = {}) {
    const dossier = this.disputeDossier(id);
    const state = this.store.snapshot();
    const asset = mustAsset(state, dossier.asset.receivable_id);
    const bench = this.upsertWorkbench(state, asset.receivable_id, asset.resolve_case_id);
    if (bench.lifecycle === "open") {
      throw new DomainError("conflict", "Der Streitfall ist bereits offen.");
    }
    if (asset.status === "CLOSED" || asset.status === "PAID") {
      throw new DomainError("invalid_transition", "Geschlossene oder bezahlte Forderungen lassen sich nicht wieder bestreiten.");
    }
    const amount = String(input.disputed_amount || asset.disputed_amount || "0");
    this.store.replace(state);
    this.openDispute(asset.receivable_id, amount, asset.resolve_case_id || undefined);
    return this.disputeDossier(asset.receivable_id);
  }

  private applyDisputeAssetAction(_state: SponsumState, asset: ReceivableAsset, action: DisputeAssetAction) {
    if (action === "keep") return;
    if (action === "restore") {
      if (asset.status === "ACCEPTED" || asset.status === "CLOSED" || asset.status === "PAID") {
        asset.disputed_amount = money("0");
        return;
      }
      assertTransition(RECEIVABLE_TRANSITIONS, asset.status, "ACCEPTED", "receivable");
      asset.status = "ACCEPTED";
      asset.disputed_amount = money("0");
      asset.updated_at = new Date().toISOString();
      return;
    }
    if (asset.status === "CLOSED") return;
    assertTransition(RECEIVABLE_TRANSITIONS, asset.status, "CLOSED", "receivable");
    asset.status = "CLOSED";
    asset.updated_at = new Date().toISOString();
  }

  createOffer(
    receivableId: string,
    input: {
      seller_party_id: string;
      kind?: Offer["kind"];
      min_price?: string;
      ask_price?: string;
      factoring_mode?: Offer["factoring_mode"];
      notice_mode?: Offer["notice_mode"];
      expires_at?: string;
      auto_buy?: boolean;
    }
  ): Offer {
    assertNoAutoBuy(Boolean(input.auto_buy));
    const state = this.store.snapshot();
    this.assertKyc(state, input.seller_party_id);
    const asset = mustAsset(state, receivableId);
    if (input.seller_party_id !== asset.current_holder_party_id) {
      throw new DomainError("forbidden", "Only the current holder can offer the receivable");
    }
    this.assertNotFinanced(asset);
    this.checkedInvoice(asset);
    const lock = mustLock(state, receivableId);
    const live = state.offers.filter((row) => row.receivable_id === receivableId && row.status === "LIVE");
    if (!canCreateSecondLiveOffer(live.length, lock.state) || asset.status === "OFFERED" || asset.status === "TRADE_LOCKED") {
      throw new DomainError("asset_locked", "Receivable already offered or assigned");
    }
    if (asset.status === "DISPUTED" || asset.status === "PARTIALLY_DISPUTED" || Number(asset.disputed_amount) > 0) {
      throw new DomainError("dispute_blocks_offer", "Disputed receivable cannot be offered clean");
    }
    if (!canOfferClean(asset.status, asset.disputed_amount)) {
      throw new DomainError("not_accepted", "Only ACCEPTED receivables can be offered");
    }
    if (state.registry.some((row) => row.receivable_id === receivableId && row.status === "ACTIVE")) {
      throw new DomainError("already_assigned", "Receivable is already assigned");
    }
    assertTransition(RECEIVABLE_TRANSITIONS, asset.status, "OFFERED", "receivable");
    asset.status = "OFFERED";
    const offer: Offer = {
      offer_id: `off-${randomUUID()}`,
      receivable_id: receivableId,
      seller_party_id: input.seller_party_id,
      kind: input.kind ?? "LISTING",
      pricing_mode: input.ask_price ? "ASK" : input.kind === "RFQ" ? "RFQ" : "MIN_PRICE",
      min_price: input.min_price ? money(input.min_price) : null,
      ask_price: input.ask_price ? money(input.ask_price) : null,
      factoring_mode: input.factoring_mode ?? "TRUE_SALE",
      notice_mode: input.notice_mode ?? "OPEN",
      expires_at: input.expires_at ?? new Date(Date.now() + 7 * 86400000).toISOString(),
      status: "LIVE"
    };
    lock.state = "OFFER_LOCK";
    lock.offer_id = offer.offer_id;
    lock.version += 1;
    state.offers.push(offer);
    state.registry.push({
      id: `reg-${randomUUID()}`,
      receivable_id: receivableId,
      public_claim_hash: asset.content_hash,
      transferor_party_id: input.seller_party_id,
      transferee_party_id: null,
      status: "RESERVED"
    });
    this.appendEvent(state, {
      type: "OFFER_CREATED",
      receivable_id: receivableId,
      offer_id: offer.offer_id,
      actor: input.seller_party_id,
      payload: { min_price: offer.min_price, ask_price: offer.ask_price }
    });
    this.store.replace(state);
    return offer;
  }

  requestLiquidity(receivableId: string, sellerPartyId: string): { offer: Offer; quotes: Array<{ buyer: string; amount: string }> } {
    const offer = this.createOffer(receivableId, { seller_party_id: sellerPartyId, kind: "RFQ" });
    const asset = this.getReceivable(receivableId);
    const base = Number(asset.outstanding_amount);
    const quotes = [
      { buyer: "factor-a", amount: money(String(base * 0.969)) },
      { buyer: "party-b", amount: money(String(base * 0.9758)) },
      { buyer: "factor-c", amount: money(String(base * 0.9724)) }
    ];
    const state = this.store.snapshot();
    for (const quote of quotes) this.ensureKyc(state, quote.buyer, "PASSED");
    this.store.replace(state);
    return { offer, quotes };
  }

  acceptLiquidityQuote(
    receivableId: string,
    sellerPartyId: string,
    buyerPartyId: string,
    amount: string,
    payeeIban?: string
  ) {
    const state = this.store.snapshot();
    const offer = [...state.offers]
      .reverse()
      .find((row) => row.receivable_id === receivableId && row.status === "LIVE");
    if (!offer) throw new DomainError("offer_not_live", "No live liquidity offer");
    this.ensureKyc(state, buyerPartyId, "PASSED");
    this.store.replace(state);
    const bid = this.createBid(offer.offer_id, buyerPartyId, amount);
    const trade = this.acceptBid(bid.bid_id, sellerPartyId, payeeIban);
    return this.getTrade(trade.trade_id);
  }

  createBid(offerId: string, buyerPartyId: string, amount: string): Bid {
    const state = this.store.snapshot();
    this.assertKyc(state, buyerPartyId);
    const offer = state.offers.find((row) => row.offer_id === offerId);
    if (!offer || offer.status !== "LIVE") throw new DomainError("offer_not_live", "Offer is not live");
    if (offer.min_price && Number(amount) < Number(offer.min_price)) {
      throw new DomainError("bid_too_low", "Bid is below minimum price");
    }
    const bid: Bid = {
      bid_id: `bid-${randomUUID()}`,
      offer_id: offerId,
      buyer_party_id: buyerPartyId,
      amount: money(amount),
      valid_until: new Date(Date.now() + 2 * 86400000).toISOString(),
      status: "OPEN"
    };
    state.bids.push(bid);
    this.appendEvent(state, {
      type: "BID_CREATED",
      offer_id: offerId,
      receivable_id: offer.receivable_id,
      actor: buyerPartyId,
      payload: { amount: bid.amount }
    });
    this.store.replace(state);
    return bid;
  }

  counterOffer(bidId: string, amount: string): Bid {
    const state = this.store.snapshot();
    const bid = state.bids.find((row) => row.bid_id === bidId);
    if (!bid || bid.status !== "OPEN") throw new DomainError("bid_not_open", "Bid is not open");
    bid.amount = money(amount);
    bid.status = "COUNTERED";
    this.appendEvent(state, { type: "COUNTEROFFER", offer_id: bid.offer_id, payload: { amount: bid.amount } });
    this.store.replace(state);
    return bid;
  }

  acceptBid(bidId: string, sellerPartyId: string, payeeIban = "CH9300762011623852957"): Trade {
    const state = this.store.snapshot();
    const bid = state.bids.find((row) => row.bid_id === bidId);
    if (!bid || (bid.status !== "OPEN" && bid.status !== "COUNTERED")) {
      throw new DomainError("bid_not_open", "Bid is not open");
    }
    const offer = state.offers.find((row) => row.offer_id === bid.offer_id);
    if (!offer || offer.status !== "LIVE") throw new DomainError("offer_not_live", "Offer is not live");
    if (offer.seller_party_id !== sellerPartyId) throw new DomainError("forbidden", "Only seller can accept");
    const asset = mustAsset(state, offer.receivable_id);
    this.assertNotFinanced(asset);
    this.checkedInvoice(asset);
    const lock = mustLock(state, asset.receivable_id);
    assertTransition(RECEIVABLE_TRANSITIONS, asset.status, "TRADE_LOCKED", "receivable");
    assertTransition(OFFER_TRANSITIONS, offer.status, "TRADED", "offer");
    asset.status = "TRADE_LOCKED";
    offer.status = "TRADED";
    bid.status = "ACCEPTED";
    for (const other of state.bids.filter((row) => row.offer_id === offer.offer_id && row.bid_id !== bid.bid_id)) {
      if (other.status === "OPEN") other.status = "LAPSED";
    }
    const trade: Trade = {
      trade_id: `trd-${randomUUID()}`,
      offer_id: offer.offer_id,
      bid_id: bid.bid_id,
      receivable_id: asset.receivable_id,
      seller_party_id: sellerPartyId,
      buyer_party_id: bid.buyer_party_id,
      nominal_amount: asset.outstanding_amount,
      purchase_price: bid.amount,
      currency: asset.currency,
      status: "CREATED"
    };
    assertTransition(TRADE_TRANSITIONS, "CREATED", "INSTRUCTION_ISSUED", "trade");
    trade.status = "INSTRUCTION_ISSUED";
    lock.state = "TRADE_LOCK";
    lock.trade_id = trade.trade_id;
    lock.version += 1;
    const instruction: SettlementInstruction = {
      instruction_id: `si-${randomUUID()}`,
      trade_id: trade.trade_id,
      provider: "external-psp",
      payer_party_id: bid.buyer_party_id,
      payee_party_id: sellerPartyId,
      amount: bid.amount,
      currency: asset.currency,
      payee_iban: payeeIban,
      payment_reference: `SPN-${trade.trade_id.slice(-10).toUpperCase()}`,
      expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      status: "ISSUED"
    };
    trade.status = "SETTLEMENT_PENDING";
    state.trades.push(trade);
    state.instructions.push(instruction);
    this.appendEvent(state, {
      type: "BID_ACCEPTED",
      receivable_id: asset.receivable_id,
      offer_id: offer.offer_id,
      trade_id: trade.trade_id,
      actor: sellerPartyId,
      payload: { bid_id: bid.bid_id, purchase_price: bid.amount }
    });
    this.appendEvent(state, {
      type: "TRADE_CREATED",
      receivable_id: asset.receivable_id,
      trade_id: trade.trade_id,
      payload: { seller: sellerPartyId, buyer: bid.buyer_party_id }
    });
    this.appendEvent(state, {
      type: "SETTLEMENT_INITIATED",
      receivable_id: asset.receivable_id,
      trade_id: trade.trade_id,
      payload: {
        instruction_id: instruction.instruction_id,
        payee_iban: instruction.payee_iban,
        payment_reference: instruction.payment_reference,
        amount: instruction.amount,
        holds_customer_funds: false
      }
    });
    this.store.replace(state);
    return trade;
  }

  markPaidFromUi(): never {
    throw new DomainError("settlement_requires_provider", "UI cannot confirm settlement; provider webhook required");
  }

  confirmByProvider(instructionId: string, provider = "external-psp") {
    const state = this.store.snapshot();
    const instruction = state.instructions.find((row) => row.instruction_id === instructionId);
    if (!instruction) throw new DomainError("instruction_not_found", "Unknown settlement instruction");
    if (instruction.status === "CONFIRMED") {
      const observation = state.observations.find((row) => row.instruction_id === instructionId);
      const trade = state.trades.find((row) => row.trade_id === instruction.trade_id);
      return { instruction, observation, transferred: trade?.status === "COMPLETED" };
    }
    const result = this.applySettlementWebhook({
      provider,
      provider_event_id: `psp-${instruction.instruction_id}`,
      payment_reference: instruction.payment_reference,
      observed_amount: instruction.amount,
      observed_currency: instruction.currency,
      signed: true
    });
    if (result.transferred) {
      const next = this.store.snapshot();
      for (const row of next.assignments) {
        if (row.trade_id === instruction.trade_id) row.status = "EFFECTIVE";
      }
      this.store.replace(next);
    }
    return result;
  }

  applySettlementWebhook(input: SettlementWebhookInput): {
    instruction: SettlementInstruction;
    observation: SettlementObservation;
    transferred: boolean;
  } {
    if (input.signed === false) {
      throw new DomainError("unsigned_webhook", "Settlement webhook must be signed");
    }
    const state = this.store.snapshot();
    const replay = state.observations.find(
      (row) => row.provider === input.provider && row.provider_event_id === input.provider_event_id
    );
    if (replay) {
      const instruction = state.instructions.find((row) => row.instruction_id === replay.instruction_id)!;
      const trade = state.trades.find((row) => row.trade_id === instruction.trade_id)!;
      return { instruction, observation: replay, transferred: trade.status === "COMPLETED" };
    }
    const instruction = state.instructions.find((row) => row.payment_reference === input.payment_reference);
    if (!instruction) throw new DomainError("instruction_not_found", "Unknown payment reference");
    const trade = state.trades.find((row) => row.trade_id === instruction.trade_id)!;
    const asset = mustAsset(state, trade.receivable_id);
    const observation: SettlementObservation = {
      observation_id: `obs-${randomUUID()}`,
      instruction_id: instruction.instruction_id,
      provider: input.provider,
      provider_event_id: input.provider_event_id,
      observed_amount: money(input.observed_amount),
      observed_currency: input.observed_currency,
      observed_at: input.observed_at ?? new Date().toISOString()
    };
    state.observations.push(observation);

    if (observation.observed_currency !== instruction.currency) {
      assertTransition(SETTLEMENT_TRANSITIONS, instruction.status, "MISMATCH", "settlement");
      instruction.status = "MISMATCH";
      trade.status = "DISPUTED_SETTLEMENT";
      this.store.replace(state);
      return { instruction, observation, transferred: false };
    }
    if (Number(observation.observed_amount) !== Number(instruction.amount)) {
      assertTransition(SETTLEMENT_TRANSITIONS, instruction.status, "MISMATCH", "settlement");
      instruction.status = "MISMATCH";
      trade.status = "DISPUTED_SETTLEMENT";
      this.store.replace(state);
      return { instruction, observation, transferred: false };
    }

    assertTransition(SETTLEMENT_TRANSITIONS, instruction.status, "CONFIRMED", "settlement");
    instruction.status = "CONFIRMED";
    assertTransition(TRADE_TRANSITIONS, trade.status, "SETTLEMENT_CONFIRMED", "trade");
    trade.status = "SETTLEMENT_CONFIRMED";
    assertTransition(TRADE_TRANSITIONS, trade.status, "ASSIGNMENT_EFFECTIVE", "trade");
    trade.status = "ASSIGNMENT_EFFECTIVE";
    assertTransition(TRADE_TRANSITIONS, trade.status, "COMPLETED", "trade");
    trade.status = "COMPLETED";
    assertTransition(RECEIVABLE_TRANSITIONS, asset.status, "TRANSFERRED", "receivable");
    asset.status = "TRANSFERRED";
    asset.current_holder_party_id = trade.buyer_party_id;
    asset.instrument_type = "ASSIGNED_RECEIVABLE";
    const lock = mustLock(state, asset.receivable_id);
    lock.state = "ASSIGNED";
    lock.version += 1;
    const reserved = state.registry.find((row) => row.receivable_id === asset.receivable_id && row.status === "RESERVED");
    if (reserved) {
      reserved.status = "ACTIVE";
      reserved.transferee_party_id = trade.buyer_party_id;
    }
    const confirmEvent = this.appendEvent(state, {
      type: "SETTLEMENT_CONFIRMED",
      receivable_id: asset.receivable_id,
      trade_id: trade.trade_id,
      payload: { provider: input.provider, provider_event_id: input.provider_event_id }
    });
    const transferEvent = this.appendEvent(state, {
      type: "ASSET_TRANSFERRED",
      receivable_id: asset.receivable_id,
      trade_id: trade.trade_id,
      payload: { buyer: trade.buyer_party_id, purchase_price: trade.purchase_price }
    });
    const proposal = proposeAccounting({
      eventId: transferEvent.event_id,
      receivableId: asset.receivable_id,
      eventType: "ASSET_TRANSFERRED",
      nominal: trade.nominal_amount,
      purchasePrice: trade.purchase_price
    });
    if (proposal) state.accounting.push(proposal);
    void confirmEvent;
    this.store.replace(state);
    return { instruction, observation, transferred: true };
  }

  requestDisclosure(offerId: string, buyerPartyId: string, level: 1 | 2): DisclosureGrant {
    const state = this.store.snapshot();
    const offer = state.offers.find((row) => row.offer_id === offerId);
    if (!offer) throw new DomainError("not_found", "Offer not found");
    this.appendEvent(state, {
      type: "REQUEST_DISCLOSURE",
      offer_id: offerId,
      receivable_id: offer.receivable_id,
      actor: buyerPartyId,
      payload: { level }
    });
    this.store.replace(state);
    return this.grantDisclosure(offerId, buyerPartyId, level, offer.seller_party_id);
  }

  grantDisclosure(offerId: string, buyerPartyId: string, level: 0 | 1 | 2, grantedBy: string): DisclosureGrant {
    const state = this.store.snapshot();
    const offer = state.offers.find((row) => row.offer_id === offerId);
    if (!offer) throw new DomainError("not_found", "Offer not found");
    const grant: DisclosureGrant = {
      grant_id: `dsc-${randomUUID()}`,
      offer_id: offerId,
      buyer_party_id: buyerPartyId,
      level,
      payload_hash: publicClaimHash({
        invoiceId: offer.receivable_id,
        debtorId: buyerPartyId,
        amount: String(level),
        maturity: "disclosure",
        issuerNode: grantedBy
      }),
      granted_by: grantedBy,
      granted_at: new Date().toISOString()
    };
    state.disclosures.push(grant);
    this.appendEvent(state, {
      type: "DISCLOSURE_GRANTED",
      offer_id: offerId,
      receivable_id: offer.receivable_id,
      actor: grantedBy,
      payload: { level, buyer: buyerPartyId, payload_hash: grant.payload_hash }
    });
    this.store.replace(state);
    return grant;
  }

  discoveryLevel0() {
    const state = this.store.snapshot();
    return state.offers
      .filter((offer) => offer.status === "LIVE")
      .map((offer) => {
        const asset = mustAsset(state, offer.receivable_id);
        return {
          offer_id: offer.offer_id,
          currency: asset.currency,
          nominal_amount: asset.nominal_amount,
          maturity_date: asset.maturity_date,
          country: "CH",
          sector: "industrial",
          risk_class: asset.risk_class,
          verification_score: asset.verification_score,
          min_price: offer.min_price,
          dispute: Number(asset.disputed_amount) > 0 ? "yes" : "none"
        };
      });
  }

  offerDetail(offerId: string, buyerPartyId = "buyer-1") {
    const state = this.store.snapshot();
    const offer = state.offers.find((row) => row.offer_id === offerId);
    if (!offer) throw new DomainError("not_found", "Offer not found");
    const asset = mustAsset(state, offer.receivable_id);
    const grants = state.disclosures.filter((row) => row.offer_id === offerId && row.buyer_party_id === buyerPartyId);
    const level = grants.reduce((max, row) => Math.max(max, row.level), 0);
    const verification = [...state.verifications].reverse().find((row) => row.receivable_id === asset.receivable_id) ?? null;
    return {
      offer,
      level,
      grants,
      bids: state.bids.filter((row) => row.offer_id === offerId),
      l0: {
        offer_id: offer.offer_id,
        currency: asset.currency,
        nominal_amount: asset.nominal_amount,
        maturity_date: asset.maturity_date,
        country: "CH",
        sector: "industrial",
        risk_class: asset.risk_class,
        verification_score: asset.verification_score,
        min_price: offer.min_price,
        ask_price: offer.ask_price,
        factoring_mode: offer.factoring_mode,
        notice_mode: offer.notice_mode,
        dispute: Number(asset.disputed_amount) > 0 ? "yes" : "none"
      },
      l1:
        level >= 1
          ? {
              debtor_party_id: asset.debtor_party_id,
              invoice_id: asset.invoice_id,
              outstanding_amount: asset.outstanding_amount,
              accepted_amount: asset.accepted_amount,
              seller_party_id: offer.seller_party_id,
              risk_class: asset.risk_class
            }
          : null,
      l2:
        level >= 2
          ? {
              receivable_id: asset.receivable_id,
              content_hash: asset.content_hash,
              instrument_type: asset.instrument_type,
              verification,
              lock: mustLock(state, asset.receivable_id)
            }
          : null
    };
  }

  portfolio(partyId: string) {
    const state = this.store.snapshot();
    const held = state.assets.filter((asset) => asset.current_holder_party_id === partyId);
    const invested = held.reduce((sum, asset) => {
      const trade = state.trades.find((row) => row.receivable_id === asset.receivable_id && row.status === "COMPLETED");
      return sum + Number(trade?.purchase_price ?? 0);
    }, 0);
    const outstanding = held.reduce((sum, asset) => sum + Number(asset.outstanding_amount), 0);
    return {
      invested: money(String(invested)),
      outstanding_nominal: money(String(outstanding)),
      expected_income: money(String(Math.max(0, outstanding - invested))),
      items: held.map((asset) => ({
        receivable_id: asset.receivable_id,
        debtor_party_id: asset.debtor_party_id,
        outstanding_amount: asset.outstanding_amount,
        maturity_date: asset.maturity_date,
        status: asset.status,
        risk_class: asset.risk_class
      }))
    };
  }

  wrapBitcredit(receivableId: string, enabled = false) {
    const asset = this.getReceivable(receivableId);
    return bitcreditIssue(asset, "CH", enabled);
  }

  wrapRegisterRight(receivableId: string, enabled = false) {
    const asset = this.getReceivable(receivableId);
    return registerRightIssue(asset, "CH", enabled);
  }

  policy(jurisdiction = "CH") {
    return getPolicy(jurisdiction);
  }

  policies() {
    return POLICIES;
  }

  factors(): FactorNode[] {
    return FACTOR_NODES;
  }

  listReceivables() {
    return this.store.snapshot().assets;
  }

  listTrades() {
    const state = this.store.snapshot();
    return state.trades.map((trade) => ({
      ...trade,
      instruction: state.instructions.find((row) => row.trade_id === trade.trade_id) ?? null
    }));
  }

  listSettlements() {
    const state = this.store.snapshot();
    return state.instructions.map((instruction) => ({
      ...instruction,
      observation: state.observations.find((row) => row.instruction_id === instruction.instruction_id) ?? null,
      trade: state.trades.find((row) => row.trade_id === instruction.trade_id) ?? null
    }));
  }

  listDisputes(lifecycle: DisputeLifecycle | "all" = "all") {
    const state = this.store.snapshot();
    const ids = new Set<string>();
    for (const asset of state.assets) {
      if (asset.status === "DISPUTED" || asset.status === "PARTIALLY_DISPUTED" || Number(asset.disputed_amount) > 0 || asset.resolve_case_id) {
        ids.add(asset.receivable_id);
      }
    }
    for (const bench of state.dispute_workbenches) {
      if (bench.receivable_id) ids.add(bench.receivable_id);
    }
    const rows = [...ids]
      .map((receivableId) => {
        const asset = state.assets.find((row) => row.receivable_id === receivableId);
        if (!asset) return null;
        return this.presentDispute(asset, this.readWorkbench(state, asset.receivable_id, asset.resolve_case_id));
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (lifecycle === "all") return rows;
    return rows.filter((row) => row.lifecycle === lifecycle);
  }

  listDisputeCandidates() {
    const state = this.store.snapshot();
    const openIds = new Set(this.listDisputes("open").map((row) => row.receivable_id));
    return state.assets.filter((asset) => {
      if (openIds.has(asset.receivable_id)) return false;
      if (asset.status === "CLOSED" || asset.status === "PAID") return false;
      const next = RECEIVABLE_TRANSITIONS[asset.status] || [];
      return next.includes("DISPUTED") || next.includes("PARTIALLY_DISPUTED");
    });
  }

  disputeDossier(id: string) {
    const key = decodeURIComponent(id);
    const dispute = this.listDisputes("all").find(
      (row) =>
        row.dispute_id === key ||
        row.resolve_case_id === key ||
        row.receivable_id === key ||
        row.invoice_id === key
    );
    if (!dispute) throw new DomainError("not_found", "Streitfall nicht gefunden");
    const pack = this.dossier(dispute.receivable_id);
    const state = this.store.snapshot();
    const workbench = this.ensureAutoLinks(state, pack.asset);
    if (!principal()) this.store.replace(state);
    const fulfilment = this.lookupFulfilment(pack.asset, workbench);
    if (fulfilment) {
      workbench.links = addRecordLinks(workbench.links, [
        { doctype: "Fulfilment Case", name: fulfilment.id, label: `Fulfillment Box ${fulfilment.id}` }
      ]);
      if (!principal()) this.store.replace(state);
    }
    return {
      dispute,
      workbench,
      fulfilment,
      venue: this.assessVenue(pack.asset, workbench, fulfilment, {
        family: workbench.procedure_family || undefined,
        from: workbench.deadline_start || pack.asset.issue_date
      }),
      templates: FORM_TEMPLATES,
      form_ai: publicFormAiStatus(),
      catalog: this.disputeCatalog(pack.asset),
      justitia: this.justitiaLinks(pack.asset),
      ...pack
    };
  }

  async assessDisputeVenue(id: string, options: { family?: string; from?: string | null } = {}) {
    const dossier = this.disputeDossier(id);
    const ctx = await this.enrichDisputeContext(dossier.asset, dossier.workbench);
    ctx.fulfilment = dossier.fulfilment || ctx.fulfilment;
    return assessJurisdiction(ctx, {
      family: options.family || dossier.workbench.procedure_family || undefined,
      from: options.from || dossier.workbench.deadline_start || ctx.issue_date
    });
  }

  listDisputeTemplates() {
    return FORM_TEMPLATES;
  }

  updateDisputeTrack(
    id: string,
    input: {
      ooc_stage?: string;
      court_stage?: string;
      eschkg_case_id?: string | null;
      procedure_family?: string | null;
      deadline_start?: string | null;
      notes?: string;
    }
  ) {
    const dossier = this.disputeDossier(id);
    const state = this.store.snapshot();
    const bench = this.upsertWorkbench(state, dossier.asset.receivable_id, dossier.asset.resolve_case_id);
    if (input.ooc_stage !== undefined) {
      if (!isOocStage(input.ooc_stage)) {
        throw new DomainError("validation_error", "Unbekannte aussergerichtliche Stufe.");
      }
      bench.ooc_stage = input.ooc_stage;
    }
    if (input.court_stage !== undefined) {
      if (!isCourtStage(input.court_stage)) {
        throw new DomainError("validation_error", "Unbekannte staatliche Stufe.");
      }
      bench.court_stage = input.court_stage;
    }
    if (input.eschkg_case_id !== undefined) {
      bench.eschkg_case_id = input.eschkg_case_id?.trim() || null;
    }
    if (input.notes !== undefined) {
      bench.notes = input.notes;
    }
    if (input.procedure_family !== undefined) {
      const family = String(input.procedure_family || "");
      bench.procedure_family =
        family === "zpo" || family === "stpo" || family === "admin" || family === "schkg" ? family : null;
    }
    if (input.deadline_start !== undefined) {
      bench.deadline_start = input.deadline_start?.trim() || null;
    }
    this.appendEvent(state, {
      type: "DISPUTE_TRACK_UPDATED",
      receivable_id: bench.receivable_id,
      payload: { ooc_stage: bench.ooc_stage, court_stage: bench.court_stage, eschkg_case_id: bench.eschkg_case_id }
    });
    this.store.replace(state);
    return this.disputeDossier(bench.receivable_id);
  }

  linkDispute(id: string, incoming: RecordLink[]) {
    const dossier = this.disputeDossier(id);
    const state = this.store.snapshot();
    const bench = this.upsertWorkbench(state, dossier.asset.receivable_id, dossier.asset.resolve_case_id);
    bench.links = addRecordLinks(bench.links, incoming);
    this.appendEvent(state, {
      type: "DISPUTE_TRACK_UPDATED",
      receivable_id: bench.receivable_id,
      payload: { linked: incoming.map((row) => `${row.doctype}:${row.name}`) }
    });
    this.store.replace(state);
    return this.disputeDossier(bench.receivable_id);
  }

  async generateDisputeForm(
    id: string,
    templateId: string,
    input: {
      instruction?: string;
      use_ai?: boolean;
      complete?: typeof completeOpenAiFormDraft;
    } = {}
  ) {
    if (!isFormTemplateId(templateId)) {
      throw new DomainError("validation_error", "Unbekannte Vorlage.");
    }
    const dossier = this.disputeDossier(id);
    const ctx = await this.enrichDisputeContext(dossier.asset, dossier.workbench);
    ctx.venue = assessJurisdiction(ctx, {
      family: dossier.workbench.procedure_family || undefined,
      from: dossier.workbench.deadline_start || ctx.issue_date
    });
    const template = FORM_TEMPLATES.find((row) => row.id === templateId)!;
    const settings = resolveFormAiSettings();
    const wantAi = input.use_ai !== false && settings.enabled;
    let lines = renderFormLines(templateId as DisputeFormTemplateId, ctx);
    let source: "template" | "openai" = "template";
    let warning: string | undefined;
    if (wantAi) {
      try {
        const prompt = buildFormAiInput({
          template,
          ctx,
          instruction: input.instruction
        });
        const complete = input.complete ?? completeOpenAiFormDraft;
        const text = await complete(settings, prompt);
        const drafted = formLinesFromModelText(text);
        if (!drafted.length) {
          throw new Error("openai_empty");
        }
        lines = [
          ...drafted,
          "Dies ist ein Entwurf. Kein Rechtsrat. Kein amtliches Formular."
        ];
        source = "openai";
      } catch {
        warning = "OpenAI nicht erreichbar — Vorlagentext verwendet.";
      }
    } else if (input.use_ai !== false && !settings.enabled) {
      warning = "OpenAI ist nicht konfiguriert — Vorlagentext verwendet.";
    }
    const form = {
      id: `frm-${randomUUID()}`,
      template_id: templateId as DisputeFormTemplateId,
      title: template.title,
      created_at: new Date().toISOString(),
      lines,
      source
    };
    const state = this.store.snapshot();
    const bench = this.upsertWorkbench(state, ctx.receivable_id, ctx.resolve_case_id);
    bench.forms.unshift(form);
    this.appendEvent(state, {
      type: "DISPUTE_FORM_DRAFTED",
      receivable_id: ctx.receivable_id,
      payload: { form_id: form.id, template_id: templateId, justitia: template.justitia, source }
    });
    this.store.replace(state);
    return {
      form,
      source,
      form_ai: publicFormAiStatus(),
      justitia: template.justitia ? this.justitiaLinks(dossier.asset) : null,
      disclaimer: "Entwurf. Kein Rechtsrat. Einreichen nur mit Bestätigung in Justitia.",
      warning
    };
  }

  disputeFormPdf(id: string, formId: string) {
    const dossier = this.disputeDossier(id);
    const form = dossier.workbench.forms.find((row) => row.id === formId);
    if (!form) throw new DomainError("not_found", "Formularentwurf nicht gefunden");
    return {
      filename: `${form.template_id}-${dossier.asset.receivable_id}.pdf`,
      type: "application/pdf",
      buffer: buildSimplePdf(form.title, form.lines)
    };
  }

  createDisputeExport(id: string, input: { recipient?: string; confirm?: unknown }) {
    if (input.confirm !== true) {
      throw new DomainError("validation_error", "Export an eine Fachperson braucht eine explizite Bestätigung.");
    }
    const recipient = String(input.recipient || "").trim();
    if (recipient.length < 2) {
      throw new DomainError("validation_error", "Empfängerin oder Empfänger der Fachperson angeben.");
    }
    const dossier = this.disputeDossier(id);
    const record = {
      id: `exp-${randomUUID()}`,
      recipient,
      created_at: new Date().toISOString(),
      filename: `sponsum-briefing-${dossier.asset.receivable_id}.zip`
    };
    const state = this.store.snapshot();
    const bench = this.upsertWorkbench(state, dossier.asset.receivable_id, dossier.asset.resolve_case_id);
    bench.exports.unshift(record);
    this.appendEvent(state, {
      type: "DISPUTE_BRIEFING_EXPORTED",
      receivable_id: dossier.asset.receivable_id,
      payload: { export_id: record.id, recipient }
    });
    this.store.replace(state);
    return {
      export: record,
      download: `/api/sponsum/v1/disputes/${encodeURIComponent(dossier.asset.receivable_id)}/exports/${record.id}`
    };
  }

  disputeExportZip(id: string, exportId: string) {
    const dossier = this.disputeDossier(id);
    const record = dossier.workbench.exports.find((row) => row.id === exportId);
    if (!record) throw new DomainError("not_found", "Export nicht gefunden");
    const ctx = this.disputeContext(dossier.asset);
    const workbench = dossier.workbench;
    const cover = buildSimplePdf(`Zu Handen ${record.recipient}`, [
      "Sponsum-Streitdossier — kein Ersatz für die Justizakte.",
      `Empfänger ${record.recipient}`,
      `Forderung ${ctx.receivable_id}`,
      `Rechnung ${ctx.invoice_id}`,
      `Inhaber ${ctx.current_holder_party_id} (Holder gewinnt gegen Origin-Glaubiger)`,
      `Resolve ${ctx.resolve_case_id || "—"}`,
      `Aussergerichtlich ${workbench.ooc_stage}`,
      `Staatlich ${workbench.court_stage}`,
      `eSchKG ${workbench.eschkg_case_id || "—"}`,
      "Nicht enthalten: vollständige Gerichtsakte, unbestätigte Justitia-Submit, Rechtsrat."
    ]);
    const files = [
      {
        name: "manifest.json",
        data: Buffer.from(
          JSON.stringify(briefingManifest({ ctx, workbench, exportedAt: record.created_at, recipient: record.recipient }), null, 2),
          "utf8"
        )
      },
      { name: "cover.pdf", data: cover }
    ];
    for (const form of workbench.forms) {
      files.push({
        name: `forms/${form.template_id}-${form.id.slice(0, 8)}.pdf`,
        data: buildSimplePdf(form.title, form.lines)
      });
    }
    return {
      filename: record.filename,
      type: "application/zip",
      buffer: buildZip(files)
    };
  }

  private justitiaSuiteUrl(): string {
    return (process.env.MOVENA_JUSTITIA_SUITE_URL || "https://suite.movena.ch/justitia/").replace(/\/?$/, "/");
  }

  private justitiaLinks(asset: ReceivableAsset) {
    const inbox = this.justitiaSuiteUrl();
    return {
      inbox_url: inbox,
      compose_url: justitiaComposeUrl({
        suiteJustitiaUrl: inbox,
        receivableId: asset.receivable_id,
        holderPartyId: asset.current_holder_party_id,
        originCreditorPartyId: asset.creditor_party_id
      })
    };
  }

  private disputeContext(asset: ReceivableAsset, workbench?: DisputeWorkbenchRecord): DisputeContext {
    return {
      receivable_id: asset.receivable_id,
      invoice_id: asset.invoice_id,
      status: asset.status,
      currency: asset.currency,
      nominal_amount: asset.nominal_amount,
      accepted_amount: asset.accepted_amount,
      disputed_amount: asset.disputed_amount,
      outstanding_amount: asset.outstanding_amount,
      issue_date: asset.issue_date,
      maturity_date: asset.maturity_date,
      debtor_party_id: asset.debtor_party_id,
      origin_creditor_party_id: asset.creditor_party_id,
      current_holder_party_id: asset.current_holder_party_id,
      resolve_case_id: asset.resolve_case_id ?? null,
      links: workbench?.links ?? [],
      ooc_stage: workbench?.ooc_stage,
      court_stage: workbench?.court_stage,
      eschkg_case_id: workbench?.eschkg_case_id ?? null
    };
  }

  private async enrichDisputeContext(asset: ReceivableAsset, workbench: DisputeWorkbenchRecord): Promise<DisputeContext> {
    const ctx = this.disputeContext(asset, workbench);
    const parties = await this.listParties();
    const cards: PartyCard[] = [...(parties.companies || []), ...(parties.customers || [])];
    rememberPartyCards(cards);
    const debtor = matchParty(asset.debtor_party_id, cards);
    return {
      ...ctx,
      debtor,
      holder: matchParty(asset.current_holder_party_id, cards),
      origin_creditor: matchParty(asset.creditor_party_id, cards),
      links: workbench.links,
      fulfilment: this.lookupFulfilment(asset, workbench, debtor.name)
    };
  }

  private lookupFulfilment(asset: ReceivableAsset, workbench: DisputeWorkbenchRecord, customerName?: string) {
    if (principal()) return null;
    const so = workbench.links.find((row) => /sales order|auftrag/i.test(row.doctype + row.label));
    return lookupFulfilmentBox({
      invoiceId: asset.invoice_id,
      debtorId: asset.debtor_party_id,
      customer: customerName,
      salesOrderId: so?.name
    });
  }

  private assessVenue(
    asset: ReceivableAsset,
    workbench: DisputeWorkbenchRecord,
    fulfilment: ReturnType<SponsumService["lookupFulfilment"]>,
    options: { family?: string; from?: string | null } = {}
  ) {
    const cards = partyCardsForVenue(this.store.snapshot());
    return assessJurisdiction(
      {
        receivable_id: asset.receivable_id,
        invoice_id: asset.invoice_id,
        status: asset.status,
        currency: asset.currency,
        nominal_amount: asset.nominal_amount,
        accepted_amount: asset.accepted_amount,
        disputed_amount: asset.disputed_amount,
        outstanding_amount: asset.outstanding_amount,
        issue_date: options.from || asset.issue_date,
        maturity_date: asset.maturity_date,
        debtor_party_id: asset.debtor_party_id,
        origin_creditor_party_id: asset.creditor_party_id,
        current_holder_party_id: asset.current_holder_party_id,
        resolve_case_id: asset.resolve_case_id ?? null,
        debtor: matchParty(asset.debtor_party_id, cards),
        holder: matchParty(asset.current_holder_party_id, cards),
        origin_creditor: matchParty(asset.creditor_party_id, cards),
        links: workbench.links,
        ooc_stage: workbench.ooc_stage,
        court_stage: workbench.court_stage,
        eschkg_case_id: workbench.eschkg_case_id,
        fulfilment
      },
      {
        family: options.family || workbench.procedure_family || undefined,
        from: options.from || workbench.deadline_start || asset.issue_date
      }
    );
  }

  private disputeCatalog(asset: ReceivableAsset) {
    const state = this.store.snapshot();
    const items: RecordLink[] = [
      { doctype: "ReceivableAsset", name: asset.receivable_id, label: `Asset ${asset.receivable_id}` },
      { doctype: "Sales Invoice", name: asset.invoice_id, label: `Rechnung ${asset.invoice_id}` }
    ];
    if (asset.resolve_case_id) {
      items.push({ doctype: "Resolve-Case", name: asset.resolve_case_id, label: asset.resolve_case_id });
    }
    for (const row of state.assignments.filter((item) => item.receivable_id === asset.receivable_id && item.assignment_id)) {
      items.push({ doctype: "Assignment", name: row.assignment_id, label: `Zession ${row.assignment_id}` });
    }
    return items;
  }

  private ensureAutoLinks(state: SponsumState, asset: ReceivableAsset): DisputeWorkbenchRecord {
    const bench = this.upsertWorkbench(state, asset.receivable_id, asset.resolve_case_id);
    const extras: RecordLink[] = this.disputeCatalog(asset);
    if (bench.eschkg_case_id) {
      extras.push({ doctype: "eSchKG Case", name: bench.eschkg_case_id, label: bench.eschkg_case_id });
    }
    bench.links = addRecordLinks(bench.links || [], extras);
    return bench;
  }

  private presentDispute(asset: ReceivableAsset, workbench: DisputeWorkbenchRecord) {
    return {
      dispute_id: asset.resolve_case_id || `dispute-${asset.receivable_id}`,
      receivable_id: asset.receivable_id,
      invoice_id: asset.invoice_id,
      status: asset.status,
      nominal_amount: asset.nominal_amount,
      accepted_amount: asset.accepted_amount,
      disputed_amount: asset.disputed_amount,
      resolve_case_id: asset.resolve_case_id,
      current_holder_party_id: asset.current_holder_party_id,
      debtor_party_id: asset.debtor_party_id,
      ooc_stage: workbench.ooc_stage,
      court_stage: workbench.court_stage,
      eschkg_case_id: workbench.eschkg_case_id,
      lifecycle: workbench.lifecycle,
      close_outcome: workbench.close_outcome,
      closed_at: workbench.closed_at,
      archived_at: workbench.archived_at,
      justitia: this.justitiaLinks(asset)
    };
  }

  private readWorkbench(state: SponsumState, receivableId: string, resolveCaseId?: string | null): DisputeWorkbenchRecord {
    const existing = state.dispute_workbenches.find((row) => row.receivable_id === receivableId);
    return normalizeWorkbench(existing ?? defaultWorkbench(receivableId, resolveCaseId), receivableId);
  }

  private upsertWorkbench(state: SponsumState, receivableId: string, resolveCaseId?: string | null): DisputeWorkbenchRecord {
    const existing = state.dispute_workbenches.find((row) => row.receivable_id === receivableId);
    if (existing) {
      return existing;
    }
    const created = defaultWorkbench(receivableId, resolveCaseId);
    state.dispute_workbenches.push(created);
    return created;
  }

  dossier(receivableId: string) {
    const state = this.store.snapshot();
    const asset = mustAsset(state, receivableId);
    const offers = state.offers.filter((row) => row.receivable_id === receivableId);
    const offerIds = new Set(offers.map((row) => row.offer_id));
    return {
      asset,
      lock: mustLock(state, receivableId),
      verification: [...state.verifications].reverse().find((row) => row.receivable_id === receivableId) ?? null,
      registry: state.registry.filter((row) => row.receivable_id === receivableId),
      offers,
      bids: state.bids.filter((row) => offerIds.has(row.offer_id)),
      trades: state.trades.filter((row) => row.receivable_id === receivableId),
      instructions: state.instructions.filter((row) =>
        state.trades.some((trade) => trade.trade_id === row.trade_id && trade.receivable_id === receivableId)
      ),
      events: state.events.filter((row) => row.receivable_id === receivableId),
      accounting: state.accounting.filter((row) => row.receivable_id === receivableId),
      disclosures: state.disclosures.filter((row) => offerIds.has(row.offer_id)),
      assignments: state.assignments.filter((row) => row.receivable_id === receivableId),
      wechsel_drafts: state.wechsel_drafts.filter((row) => row.receivable_id === receivableId),
      policy: getPolicy("CH"),
      adapters: {
        bitcredit: bitcreditIssue(asset, "CH", false),
        register_right: registerRightIssue(asset, "CH", false)
      },
      instrument_gate: {
        LEGAL_BILL_OF_EXCHANGE: "DENY",
        BITCREDIT_EBILL: "FLAG",
        REGISTER_RIGHT: "FLAG",
        ORDINARY_RECEIVABLE: "ALLOW"
      }
    };
  }

  workspace() {
    if (!principal()) this.seedDemoIfEmpty();
    const state = this.store.snapshot();
    const live = this.discoveryLevel0();
    return {
      kpis: {
        receivables: state.assets.length,
        live_offers: live.length,
        trades: state.trades.length,
        disputed: this.listDisputes("open").length,
        transferred: state.assets.filter((asset) => asset.status === "TRANSFERRED").length,
        holds_customer_funds: false
      },
      receivables: state.assets,
      discovery: live,
      trades: this.listTrades(),
      settlements: this.listSettlements(),
      disputes: this.listDisputes("all"),
      dispute_candidates: this.listDisputeCandidates(),
      events: state.events.slice(-40).reverse(),
      accounting: state.accounting,
      kyc: state.kyc,
      buyer_profiles: state.buyer_profiles,
      factors: FACTOR_NODES,
      policies: POLICIES,
      portfolio: this.portfolio("buyer-1"),
      assignments: state.assignments,
      wechsel_drafts: state.wechsel_drafts,
      capital_needs: state.capital_needs,
      capital_interests: state.capital_interests,
      capital_providers: CAPITAL_PROVIDERS,
      capital_public: this.listPublicCapitalNeeds()
    };
  }

  createAssignment(input: {
    receivable_id: string;
    seller_party_id: string;
    buyer_party_id: string;
    purchase_price: string;
    factoring_mode?: AssignmentPackage["factoring_mode"];
    notice_mode?: AssignmentPackage["notice_mode"];
    payee_iban?: string;
  }): { assignment: AssignmentPackage; trade: Trade; instruction: SettlementInstruction | null } {
    this.setKyc(input.buyer_party_id, "PASSED");
    const asset = this.getReceivable(input.receivable_id);
    const offer = this.createOffer(input.receivable_id, {
      seller_party_id: input.seller_party_id,
      kind: "PRIVATE",
      min_price: input.purchase_price,
      factoring_mode: input.factoring_mode ?? "TRUE_SALE",
      notice_mode: input.notice_mode ?? "OPEN"
    });
    const bid = this.createBid(offer.offer_id, input.buyer_party_id, input.purchase_price);
    const trade = this.acceptBid(bid.bid_id, input.seller_party_id, input.payee_iban);
    const { instruction } = this.getTrade(trade.trade_id);
    const assignment: AssignmentPackage = {
      assignment_id: `zes-${randomUUID().slice(0, 8)}`,
      receivable_id: asset.receivable_id,
      trade_id: trade.trade_id,
      transferor_party_id: input.seller_party_id,
      transferee_party_id: input.buyer_party_id,
      debtor_party_id: asset.debtor_party_id,
      nominal_amount: asset.nominal_amount,
      purchase_price: money(input.purchase_price),
      currency: asset.currency,
      factoring_mode: input.factoring_mode ?? "TRUE_SALE",
      notice_mode: input.notice_mode ?? "OPEN",
      legal_basis: "OR 164 ff. — Zession / Forderungskauf (kein Wechselrecht)",
      contract_title: "Forderungskauf- und Zessionsvertrag",
      payee_iban: instruction?.payee_iban ?? input.payee_iban ?? "",
      payment_reference: instruction?.payment_reference ?? "",
      status: "INSTRUCTION_ISSUED",
      created_at: new Date().toISOString(),
      signatures: []
    };
    const state = this.store.snapshot();
    state.assignments.push(assignment);
    this.appendEvent(state, {
      type: "ASSIGNMENT_CREATED",
      receivable_id: asset.receivable_id,
      trade_id: trade.trade_id,
      actor: input.seller_party_id,
      payload: {
        assignment_id: assignment.assignment_id,
        factoring_mode: assignment.factoring_mode,
        notice_mode: assignment.notice_mode,
        legal_basis: assignment.legal_basis
      }
    });
    this.store.replace(state);
    return { assignment, trade, instruction };
  }

  createWechselDraft(input: {
    drawer_party_id: string;
    drawee_party_id: string;
    remittee_party_id?: string;
    amount: string;
    currency?: string;
    issue_date: string;
    maturity_date: string;
    place_of_payment?: string;
    invoice_id?: string;
    wechsel_form?: string;
    wechsel_purpose?: string;
    verfall_art?: string;
    after_sight_days?: string | number | null;
  }): { draft: WechselDraft; asset: ReceivableAsset } {
    if ((input as { instrument_type?: string }).instrument_type === "LEGAL_BILL_OF_EXCHANGE") {
      throw new DomainError("policy_denied", "LEGAL_BILL_OF_EXCHANGE is DENY in CH");
    }
    if (String(input.wechsel_purpose || "").toUpperCase() === "FINANZWECHSEL") {
      throw new DomainError("policy_denied", "Finanzwechsel ist nicht aktiv. Nur Handelswechsel.");
    }
    const art = parseWechselArt(input);
    const drawer = input.drawer_party_id;
    const drawee = art.wechsel_form === "SOLA" ? drawer : input.drawee_party_id;
    if (!drawee) throw new DomainError("invalid_wechsel", "Bezogener fehlt.");
    const invoiceId = input.invoice_id ?? `WB-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 4).toUpperCase()}`;
    this.setKyc(drawer, "PASSED");
    if (input.remittee_party_id) this.setKyc(input.remittee_party_id, "PASSED");
    const asset = this.createReceivable({
      invoice_id: invoiceId,
      nominal_amount: input.amount,
      currency: input.currency ?? "CHF",
      issue_date: input.issue_date,
      maturity_date: input.maturity_date,
      creditor_party_id: drawer,
      debtor_party_id: drawee,
      instrument_type: "ELECTRONIC_TRADE_INSTRUMENT",
      evidence: {
        hasInvoice: true,
        invoiceElectronic: true,
        hasContract: true,
        unpaid: true,
        hasDispute: false,
        creditorKyc: true,
        debtorKyc: true
      }
    });
    const draft: WechselDraft = {
      instrument_id: `wb-${randomUUID().slice(0, 8)}`,
      receivable_id: asset.receivable_id,
      legal_qualification: "NOT_A_BILL_OF_EXCHANGE",
      instrument_type: "ELECTRONIC_TRADE_INSTRUMENT",
      status: "DRAFT",
      ...art,
      drawer_party_id: drawer,
      drawee_party_id: drawee,
      remittee_party_id: input.remittee_party_id ?? drawer,
      amount: money(input.amount),
      currency: input.currency ?? "CHF",
      issue_date: input.issue_date,
      maturity_date: input.maturity_date,
      place_of_payment: input.place_of_payment ?? "Zürich",
      disclaimer:
        "Kein Wechsel nach Art. 990 ff. OR. Elektronischer Handelsbeleg / Zahlungsversprechen zur Zession. Gesetzliches Wechselrecht ist nicht aktiviert.",
      created_at: new Date().toISOString(),
      acceptance: null,
      guarantees: [],
      assignment_ids: [],
      signatures: [],
      anchors: []
    };
    const state = this.store.snapshot();
    state.wechsel_drafts.push(draft);
    this.store.replace(state);
    return { draft, asset };
  }

  listWechselDrafts() {
    return this.store.snapshot().wechsel_drafts;
  }

  getWechsel(instrumentId: string): WechselDraft {
    return mustWechsel(this.store.snapshot(), instrumentId);
  }

  wechselDossier(instrumentId: string) {
    const state = this.store.snapshot();
    const draft = mustWechsel(state, instrumentId);
    const asset = mustAsset(state, draft.receivable_id);
    const assignments = state.assignments.filter(
      (row) => row.receivable_id === draft.receivable_id || draft.assignment_ids.includes(row.assignment_id)
    );
    const policy = getPolicy("CH");
    return {
      draft,
      asset,
      assignments,
      functions: {
        akzept: { decision: "ALLOW", label: "Akzept", legal: "Kaufmännische Schuldanerkennung. Kein Wechselakzept nach OR." },
        sicherheit: {
          decision: "ALLOW",
          label: "Sicherheit",
          legal: "Bürgschaft oder selbständige Garantie. Kein Aval nach Art. 1021 OR."
        },
        zession: { decision: policy.ordinary_assignment, label: "Zession", legal: "Forderungskauf / Abtretung nach OR 164 ff." },
        aval: { decision: policy.aval_as_wechselaval, label: "Aval", legal: "Wechselaval ist in CH gesperrt." },
        indossament: { decision: policy.endorsement_recourse, label: "Indossament", legal: "Indossament mit Rückgriff ist in CH gesperrt." },
        protest: { decision: "DENY", label: "Protest", legal: "Kein formeller Wechselprotest. Nichtzahlung als Dispute." },
        qes: {
          decision: skribbleConfigured() ? "ALLOW" : "FLAG",
          label: "QES",
          legal: "Qualifizierte Signatur über Skribble / ZertES. Kein Wechselakzept."
        },
        register: {
          decision: policy.register_rights,
          label: "Register / Kette",
          legal: "Protokoll-Hash ist kein Registerwertrecht und keine Blockchain-Übertragung."
        }
      },
      skribble: { configured: skribbleConfigured() }
    };
  }

  acknowledgeWechsel(instrumentId: string) {
    return this.signWechsel(instrumentId, { role: "DRAWEE" }).then((row) => row.draft);
  }

  async signWechsel(
    instrumentId: string,
    input: {
      role: SignatureRole;
      quality?: string;
      signer_label?: string;
      signer_email?: string;
      first_name?: string;
      last_name?: string;
    }
  ): Promise<{ draft: WechselDraft; signature: InstrumentSignature }> {
    const role = input.role;
    if (role !== "DRAWER" && role !== "DRAWEE" && role !== "GUARANTOR") {
      throw new DomainError("invalid_signature", "Diese Rolle gehört nicht auf den Beleg. Zession separat zeichnen.");
    }
    const quality = normalizeRequestedQuality(input.quality);
    const state = this.store.snapshot();
    const draft = mustWechsel(state, instrumentId);
    if (role !== "DRAWER" && !hasSignature(draft.signatures, "DRAWER")) {
      throw new DomainError("unsigned", "Der Aussteller muss den Beleg zuerst zeichnen.");
    }
    if (hasSignature(draft.signatures, role)) {
      throw new DomainError("already_signed", "Diese Partei hat bereits gezeichnet.");
    }
    if (quality === "SES") {
      const signature = this.applyCompletedSignature(state, draft, {
        role,
        party_id: role === "DRAWER" ? draft.drawer_party_id : draft.drawee_party_id,
        signer_label: input.signer_label,
        quality: "SES",
        method: "SUITE_CONFIRM"
      });
      this.store.replace(state);
      return { draft, signature };
    }
    const pending = await this.startSkribbleSignature({
      role,
      party_id: role === "DRAWER" ? draft.drawer_party_id : draft.drawee_party_id,
      signer_label: input.signer_label || (role === "DRAWER" ? draft.drawer_party_id : draft.drawee_party_id),
      signer_email: input.signer_email,
      first_name: input.first_name,
      last_name: input.last_name,
      quality,
      content_hash: wechselContentHash(draft),
      title: `Sponsum ${draft.instrument_id}`,
      message: "Bitte den Handelsbeleg qualifiziert zeichnen. Kein gesetzlicher Wechsel.",
      pdf: wechselPdf(draft)
    });
    draft.signatures.push(pending);
    this.store.replace(state);
    return { draft, signature: pending };
  }

  async signAssignment(
    assignmentId: string,
    input: {
      role: "TRANSFEROR" | "TRANSFEREE";
      quality?: string;
      signer_label?: string;
      signer_email?: string;
    }
  ): Promise<{ assignment: AssignmentPackage; signature: InstrumentSignature }> {
    const quality = normalizeRequestedQuality(input.quality);
    const state = this.store.snapshot();
    const assignment = state.assignments.find((row) => row.assignment_id === assignmentId);
    if (!assignment) throw new DomainError("not_found", "Zession nicht gefunden");
    if (hasSignature(assignment.signatures, input.role)) {
      throw new DomainError("already_signed", "Diese Partei hat die Zession bereits gezeichnet.");
    }
    const partyId = input.role === "TRANSFEROR" ? assignment.transferor_party_id : assignment.transferee_party_id;
    if (quality === "SES") {
      const signature = makeCompletedSignature({
        role: input.role,
        party_id: partyId,
        signer_label: input.signer_label || partyId,
        quality: "SES",
        method: "SUITE_CONFIRM",
        content_hash: assignmentContentHash(assignment),
        legal_note: "SES auf den Zessionsvertrag nach OR 164. Kein Indossament."
      });
      assignment.signatures.push(signature);
      this.appendEvent(state, {
        type: "DOCUMENT_SIGNED",
        receivable_id: assignment.receivable_id,
        trade_id: assignment.trade_id,
        actor: partyId,
        payload: { assignment_id: assignment.assignment_id, role: input.role, quality: "SES", content_hash: signature.content_hash }
      });
      this.store.replace(state);
      return { assignment, signature };
    }
    const pending = await this.startSkribbleSignature({
      role: input.role,
      party_id: partyId,
      signer_label: input.signer_label || partyId,
      signer_email: input.signer_email,
      quality,
      content_hash: assignmentContentHash(assignment),
      title: `Zession ${assignment.assignment_id}`,
      message: "Bitte den Zessionsvertrag qualifiziert zeichnen. Kein Indossament.",
      pdf: assignmentPdf(assignment)
    });
    assignment.signatures.push(pending);
    this.store.replace(state);
    return { assignment, signature: pending };
  }

  async syncSignatures(instrumentId: string): Promise<WechselDraft> {
    const state = this.store.snapshot();
    const draft = mustWechsel(state, instrumentId);
    for (const pending of draft.signatures.filter((row) => row.status === "PENDING" && row.skribble_request_id)) {
      const remote = await getSkribbleRequest(pending.skribble_request_id!);
      if (!isSkribbleSigned(remote.status_overall)) continue;
      const actual = assertQualityHonored(pending.quality === "PENDING" ? "QES" : pending.quality, remote.signed_quality || remote.quality);
      pending.status = "SIGNED";
      pending.quality = actual === "DEMO" ? "DEMO" : actual === "AES" ? "AES" : actual === "SES" ? "SES" : "QES";
      pending.signed_at = new Date().toISOString();
      pending.signature = signEventHash(`${pending.role}:${pending.skribble_request_id}:${pending.content_hash}`, EVENT_SECRET);
      pending.legal_note = `${pending.quality} über Skribble / ZertES. Kein Wechselakzept nach OR.`;
      this.completeWechselEffects(state, draft, pending);
    }
    this.store.replace(state);
    return draft;
  }

  async syncAssignmentSignatures(assignmentId: string): Promise<AssignmentPackage> {
    const state = this.store.snapshot();
    const assignment = state.assignments.find((row) => row.assignment_id === assignmentId);
    if (!assignment) throw new DomainError("not_found", "Zession nicht gefunden");
    for (const pending of assignment.signatures.filter((row) => row.status === "PENDING" && row.skribble_request_id)) {
      const remote = await getSkribbleRequest(pending.skribble_request_id!);
      if (!isSkribbleSigned(remote.status_overall)) continue;
      const actual = assertQualityHonored(pending.quality === "PENDING" ? "QES" : pending.quality, remote.signed_quality || remote.quality);
      pending.status = "SIGNED";
      pending.quality = actual === "DEMO" ? "DEMO" : actual === "AES" ? "AES" : actual === "SES" ? "SES" : "QES";
      pending.signed_at = new Date().toISOString();
      pending.signature = signEventHash(`${pending.role}:${pending.skribble_request_id}:${pending.content_hash}`, EVENT_SECRET);
      this.appendEvent(state, {
        type: "DOCUMENT_SIGNED",
        receivable_id: assignment.receivable_id,
        trade_id: assignment.trade_id,
        actor: pending.party_id,
        payload: { assignment_id: assignment.assignment_id, role: pending.role, quality: pending.quality, content_hash: pending.content_hash }
      });
    }
    this.store.replace(state);
    return assignment;
  }

  anchorWechsel(instrumentId: string): { draft: WechselDraft; anchor: DocumentAnchor } {
    const state = this.store.snapshot();
    const draft = mustWechsel(state, instrumentId);
    const content_hash = wechselContentHash(draft);
    const event = this.appendEvent(state, {
      type: "DOCUMENT_ANCHORED",
      receivable_id: draft.receivable_id,
      actor: draft.drawer_party_id,
      payload: {
        instrument_id: draft.instrument_id,
        content_hash,
        method: "PROTOCOL_CHAIN",
        register_right: false,
        legal: "Kein Registerwertrecht, keine Token, keine Eigentumsübertragung durch die Kette."
      }
    });
    const anchor: DocumentAnchor = {
      anchor_id: `anc-${randomUUID().slice(0, 8)}`,
      content_hash,
      event_hash: event.event_hash,
      method: "PROTOCOL_CHAIN",
      legal_note:
        "Verankert in der Sponsum-Protokollkette. Kein öffentliches Register, kein Art. 973d OR, keine Blockchain-Zession.",
      created_at: new Date().toISOString()
    };
    draft.anchors.push(anchor);
    this.store.replace(state);
    return { draft, anchor };
  }

  private applyCompletedSignature(
    state: ReturnType<MemorySponsumStore["snapshot"]>,
    draft: WechselDraft,
    input: {
      role: SignatureRole;
      party_id: string;
      signer_label?: string;
      quality: InstrumentSignature["quality"];
      method: InstrumentSignature["method"];
    }
  ): InstrumentSignature {
    const signature = makeCompletedSignature({
      role: input.role,
      party_id: input.party_id,
      signer_label: input.signer_label || input.party_id,
      quality: input.quality,
      method: input.method,
      content_hash: wechselContentHash(draft),
      legal_note:
        input.role === "DRAWEE"
          ? `${input.quality}: kaufmännische Schuldanerkennung. Kein Wechselakzept nach OR.`
          : `${input.quality}: Ausstellung des Handelsbelegs. Kein gesetzlicher Wechsel.`
    });
    draft.signatures.push(signature);
    this.completeWechselEffects(state, draft, signature);
    return signature;
  }

  private completeWechselEffects(
    state: ReturnType<MemorySponsumStore["snapshot"]>,
    draft: WechselDraft,
    signature: InstrumentSignature
  ) {
    if (signature.role === "DRAWER" && (draft.status === "DRAFT" || draft.status === "ISSUED")) {
      draft.status = draft.wechsel_form === "SOLA" ? "ACKNOWLEDGED" : "ISSUED";
    }
    if (signature.role === "DRAWEE") {
      draft.acceptance = {
        accepted_at: signature.signed_at,
        drawee_party_id: draft.drawee_party_id,
        legal_qualification: "COMMERCIAL_ACKNOWLEDGEMENT"
      };
      if (draft.status === "DRAFT" || draft.status === "ISSUED") draft.status = "ACKNOWLEDGED";
      this.appendEvent(state, {
        type: "WECHSEL_ACKNOWLEDGED",
        receivable_id: draft.receivable_id,
        actor: draft.drawee_party_id,
        payload: { instrument_id: draft.instrument_id, legal_qualification: "COMMERCIAL_ACKNOWLEDGEMENT" }
      });
    }
    if (signature.role === "DRAWER" && draft.wechsel_form === "SOLA" && !hasSignature(draft.signatures, "DRAWEE")) {
      const own = makeCompletedSignature({
        role: "DRAWEE",
        party_id: draft.drawer_party_id,
        signer_label: signature.signer_label,
        quality: signature.quality,
        method: signature.method,
        content_hash: signature.content_hash,
        legal_note: `${signature.quality}: Solawechsel — Aussteller und Bezogener sind dieselbe Partei.`
      });
      draft.signatures.push(own);
      draft.acceptance = {
        accepted_at: own.signed_at,
        drawee_party_id: draft.drawee_party_id,
        legal_qualification: "COMMERCIAL_ACKNOWLEDGEMENT"
      };
      if (draft.status === "ISSUED" || draft.status === "DRAFT") draft.status = "ACKNOWLEDGED";
    }
    this.appendEvent(state, {
      type: "DOCUMENT_SIGNED",
      receivable_id: draft.receivable_id,
      actor: signature.party_id,
      payload: {
        instrument_id: draft.instrument_id,
        role: signature.role,
        quality: signature.quality,
        content_hash: signature.content_hash
      }
    });
  }

  private async startSkribbleSignature(input: {
    role: SignatureRole;
    party_id: string;
    signer_label: string;
    signer_email?: string;
    first_name?: string;
    last_name?: string;
    quality: SkribbleQuality;
    content_hash: string;
    title: string;
    message: string;
    pdf: Buffer;
  }): Promise<InstrumentSignature> {
    const request = await createSkribbleRequest({
      title: input.title,
      message: input.message,
      content_base64: input.pdf.toString("base64"),
      email: input.signer_email || "",
      first_name: input.first_name,
      last_name: input.last_name,
      quality: input.quality
    });
    return {
      signature_id: `sig-${randomUUID().slice(0, 8)}`,
      role: input.role,
      party_id: input.party_id,
      signer_label: input.signer_label,
      quality: input.quality,
      method: "SKRIBBLE",
      status: "PENDING",
      content_hash: input.content_hash,
      signature: "",
      signed_at: new Date().toISOString(),
      legal_note: `${input.quality} angefordert über Skribble. Noch nicht abgeschlossen.`,
      signer_email: input.signer_email,
      signing_url: request.signing_url || undefined,
      skribble_request_id: request.id
    };
  }

  addWechselGuarantee(
    instrumentId: string,
    input: { guarantor_party_id: string; kind?: string; amount?: string }
  ): WechselDraft {
    const kind = String(input.kind ?? "SURETY").toUpperCase();
    if (kind === "AVAL" || kind === "WECHSELAVAL" || kind === "WECHSEL_AVAL") {
      throw new DomainError(
        "policy_denied",
        "Wechselaval nach Art. 1021 OR ist gesperrt. Verwenden Sie Bürgschaft oder selbständige Garantie."
      );
    }
    if (kind !== "SURETY" && kind !== "GUARANTEE") {
      throw new DomainError(
        "invalid_guarantee",
        "Nur Bürgschaft oder selbständige Garantie. Wechselaval ist gesperrt."
      );
    }
    if (!input.guarantor_party_id) {
      throw new DomainError("invalid_guarantee", "Bürge / Garant fehlt.");
    }
    const state = this.store.snapshot();
    const draft = mustWechsel(state, instrumentId);
    if (!hasSignature(draft.signatures, "DRAWER")) {
      throw new DomainError("unsigned", "Der Aussteller muss den Beleg zuerst zeichnen.");
    }
    draft.guarantees.push({
      guarantee_id: `gar-${randomUUID().slice(0, 8)}`,
      guarantor_party_id: input.guarantor_party_id,
      kind,
      legal_qualification: "NOT_A_WECHSELAVAL",
      amount: money(input.amount ?? draft.amount),
      created_at: new Date().toISOString()
    });
    if (draft.status === "DRAFT" || draft.status === "ACKNOWLEDGED") draft.status = "SECURED";
    this.appendEvent(state, {
      type: "WECHSEL_GUARANTEE_ATTACHED",
      receivable_id: draft.receivable_id,
      actor: input.guarantor_party_id,
      payload: {
        instrument_id: draft.instrument_id,
        kind,
        legal_qualification: "NOT_A_WECHSELAVAL"
      }
    });
    this.store.replace(state);
    return draft;
  }

  endorseWechsel(_instrumentId: string): never {
    throw new DomainError(
      "policy_denied",
      "Indossament mit Rückgriff ist in der Schweiz gesperrt. Übertragung nur als Zession nach OR 164."
    );
  }

  protestWechsel(_instrumentId: string): never {
    throw new DomainError(
      "policy_denied",
      "Formaler Wechselprotest nach OR ist nicht aktiviert. Melden Sie die Nichtzahlung als Dispute."
    );
  }

  assignWechsel(
    instrumentId: string,
    input: {
      buyer_party_id: string;
      purchase_price: string;
      seller_party_id?: string;
      factoring_mode?: AssignmentPackage["factoring_mode"];
      notice_mode?: AssignmentPackage["notice_mode"];
      payee_iban?: string;
    }
  ) {
    const draft = this.getWechsel(instrumentId);
    if (!hasSignature(draft.signatures, "DRAWER")) {
      throw new DomainError("unsigned", "Der Aussteller muss den Beleg zuerst zeichnen, bevor zediert wird.");
    }
    const asset = this.getReceivable(draft.receivable_id);
    const result = this.createAssignment({
      receivable_id: draft.receivable_id,
      seller_party_id: input.seller_party_id ?? asset.current_holder_party_id ?? draft.remittee_party_id,
      buyer_party_id: input.buyer_party_id,
      purchase_price: input.purchase_price,
      factoring_mode: input.factoring_mode,
      notice_mode: input.notice_mode,
      payee_iban: input.payee_iban
    });
    const state = this.store.snapshot();
    const next = mustWechsel(state, instrumentId);
    next.assignment_ids.push(result.assignment.assignment_id);
    next.status = "ASSIGNED";
    this.store.replace(state);
    return { ...result, draft: next };
  }

  defaultWechsel(instrumentId: string, disputedAmount?: string) {
    const draft = this.getWechsel(instrumentId);
    return this.openDispute(draft.receivable_id, disputedAmount ?? draft.amount);
  }

  listAssignments() {
    return this.store.snapshot().assignments;
  }

  async listParties() {
    if (principal()) return { ...localPartiesFromState(this.store.snapshot()), source: "local" };
    const fromErp = await fetchErpNextParties();
    const local = localPartiesFromState(this.store.snapshot());
    const merged = mergeParties(fromErp, local);
    return {
      ...merged,
      source: fromErp.companies.length || fromErp.customers.length ? "erpnext" : "local"
    };
  }

  listCapitalProviders(): CapitalProvider[] {
    return CAPITAL_PROVIDERS;
  }

  listCapitalNeeds() {
    return this.store.snapshot().capital_needs;
  }

  listPublicCapitalNeeds() {
    return this.store.snapshot().capital_needs
      .filter((row) => row.status === "OPEN")
      .map((row) => ({
        need_id: row.need_id,
        kind: row.kind,
        amount: row.amount,
        currency: row.currency,
        tenor_months: row.tenor_months,
        sector: row.sector,
        country: row.country,
        purpose: row.purpose.slice(0, 80)
      }));
  }

  createCapitalNeed(input: {
    seeker_party_id?: string;
    kind: string;
    amount: string;
    currency?: string;
    tenor_months?: string | number | null;
    purpose?: string;
    sector?: string;
    country?: string;
  }): { need: CapitalNeed; matches: CapitalProvider[] } {
    const kind = normalizeCapitalKind(input.kind);
    const amount = money(input.amount);
    if (Number(amount) <= 0) throw new DomainError("invalid_capital", "Betrag muss grösser als 0 sein.");
    const tenor =
      kind === "EQUITY" ? null : Math.max(1, Number(input.tenor_months ?? (kind === "SHORT_DEBT" ? 6 : 36)) || 1);
    if (kind === "SHORT_DEBT" && tenor && tenor > 12) {
      throw new DomainError("invalid_capital", "Kurzfristiges FK ist auf höchstens 12 Monate begrenzt.");
    }
    if (kind === "LONG_DEBT" && tenor && tenor <= 12) {
      throw new DomainError("invalid_capital", "Langfristiges FK beginnt nach 12 Monaten.");
    }
    const seeker = input.seeker_party_id || "seller-ui";
    this.setKyc(seeker, "PASSED");
    const need: CapitalNeed = {
      need_id: `kap-${randomUUID().slice(0, 8)}`,
      seeker_party_id: seeker,
      kind,
      amount,
      currency: input.currency || "CHF",
      tenor_months: tenor,
      purpose: String(input.purpose || "Unternehmensfinanzierung").slice(0, 240),
      sector: input.sector || "KMU",
      country: input.country || "CH",
      status: "OPEN",
      receivable_id: null,
      legal_note:
        "Bilaterale Kapitalsuche. Kein öffentliches Angebot, kein Fonds, kein Wechsel, keine Kundengelder bei Sponsum.",
      created_at: new Date().toISOString()
    };
    const state = this.store.snapshot();
    state.capital_needs.push(need);
    this.appendEvent(state, {
      type: "CAPITAL_NEED_CREATED",
      actor: seeker,
      payload: { need_id: need.need_id, kind: need.kind, amount: need.amount, receivable_id: null }
    });
    this.store.replace(state);
    return { need, matches: this.matchCapitalProviders(need) };
  }

  matchCapitalProviders(need: CapitalNeed): CapitalProvider[] {
    const amount = Number(need.amount);
    return CAPITAL_PROVIDERS.filter((provider) => {
      if (!provider.offers.includes(need.kind)) return false;
      if (!provider.currencies.includes(need.currency)) return false;
      if (!provider.countries.includes(need.country)) return false;
      if (amount < Number(provider.tickets_min) || amount > Number(provider.tickets_max)) return false;
      if (need.kind !== "EQUITY" && provider.max_tenor_months && need.tenor_months && need.tenor_months > provider.max_tenor_months) {
        return false;
      }
      return true;
    });
  }

  requestCapitalIntro(
    needId: string,
    providerId: string,
    note?: string
  ): { need: CapitalNeed; interest: CapitalInterest; provider: CapitalProvider } {
    const state = this.store.snapshot();
    const need = state.capital_needs.find((row) => row.need_id === needId);
    if (!need) throw new DomainError("not_found", "Kapitalsuche nicht gefunden");
    if (need.status === "WITHDRAWN") throw new DomainError("withdrawn", "Diese Suche ist zurückgezogen.");
    const provider = CAPITAL_PROVIDERS.find((row) => row.provider_id === providerId);
    if (!provider) throw new DomainError("not_found", "Investor oder Gläubiger nicht gefunden");
    if (state.capital_interests.some((row) => row.need_id === needId && row.provider_id === providerId)) {
      throw new DomainError("duplicate_interest", "Anfrage an diese Partei besteht bereits.");
    }
    const interest: CapitalInterest = {
      interest_id: `int-${randomUUID().slice(0, 8)}`,
      need_id: needId,
      provider_id: providerId,
      note: String(note || "Bitte um bilaterales Gespräch.").slice(0, 240),
      status: "INTRODUCED",
      created_at: new Date().toISOString()
    };
    state.capital_interests.push(interest);
    need.status = "INTRODUCED";
    this.appendEvent(state, {
      type: "CAPITAL_INTEREST",
      actor: need.seeker_party_id,
      payload: { need_id: need.need_id, provider_id: providerId, interest_id: interest.interest_id }
    });
    this.store.replace(state);
    return { need, interest, provider };
  }

  async withdrawCapitalNeed(needId: string): Promise<CapitalNeed> {
    const before = this.store.snapshot();
    const current = before.capital_needs.find((row) => row.need_id === needId);
    if (!current) throw new DomainError("not_found", "Kapitalsuche nicht gefunden");
    // DK-31: a confirmed need with a Lending application keeps the receivable reserved until Lending has nothing open,
    // otherwise the receivable could be sold while it is being financed.
    const requested = before.events.some(
      (event) => event.event_type === "LENDING_APPLICATION_REQUESTED" && event.payload?.need_id === needId
    );
    if (current.status === "CONFIRMED" && current.receivable_id && requested) {
      let open;
      try {
        open = await readLendingStatus(current.receivable_id, this.lendingDeps());
      } catch (error) {
        throw lendingToDomain(error);
      }
      if (open) {
        throw new DomainError(
          "receivable_encumbered",
          "In Frappe Lending ist für diese Forderung ein Kreditantrag oder Kredit offen. Erst dort ablehnen oder abschliessen."
        );
      }
    }
    const state = this.store.snapshot();
    const need = state.capital_needs.find((row) => row.need_id === needId);
    if (!need) throw new DomainError("not_found", "Kapitalsuche nicht gefunden");
    need.status = "WITHDRAWN";
    this.store.replace(state);
    return need;
  }

  /**
   * O5: a tenant admin confirms a debt need and links it to exactly one receivable of the seeker. Only receivables
   * the Lending handover would accept can be linked (same checks as lending-bridge.assertLendable, minus the
   * ERPNext customer lookup). Idempotent for the same receivable.
   */
  confirmCapitalNeed(needId: string, input: { receivable_id?: string; confirm?: boolean } = {}): CapitalNeed {
    const who = principal();
    if (who && !who.admin) {
      throw new DomainError("forbidden", "Nur die Mandantenadministration kann einen Kapitalbedarf bestätigen.");
    }
    if (input.confirm !== true) {
      throw new DomainError("validation_error", "Bestätigung des Kapitalbedarfs braucht eine explizite Bestätigung.");
    }
    const state = this.store.snapshot();
    const need = state.capital_needs.find((row) => row.need_id === needId);
    if (!need) throw new DomainError("not_found", "Kapitalsuche nicht gefunden");
    if (need.status === "WITHDRAWN") throw new DomainError("withdrawn", "Diese Suche ist zurückgezogen.");
    const receivableId = String(input.receivable_id ?? "").trim();
    if (need.status === "CONFIRMED") {
      if (need.receivable_id === receivableId) return need;
      throw new DomainError("already_confirmed", "Der Kapitalbedarf ist bereits mit einer anderen Forderung bestätigt.");
    }
    const asset = state.assets.find((row) => row.receivable_id === receivableId);
    if (!asset) throw new DomainError("not_found", "Forderung nicht gefunden");
    this.assertNotForSale(state, asset, need.need_id);
    this.checkedInvoice(asset);
    try {
      assertLendable({ ...need, status: "CONFIRMED", receivable_id: asset.receivable_id }, asset);
    } catch (error) {
      throw lendingToDomain(error);
    }
    need.status = "CONFIRMED";
    need.receivable_id = asset.receivable_id;
    need.confirmed_by = who?.email ?? "system";
    need.confirmed_at = new Date().toISOString();
    this.appendEvent(state, {
      type: "CAPITAL_NEED_CONFIRMED",
      actor: who?.userId ?? need.seeker_party_id,
      receivable_id: asset.receivable_id,
      payload: { need_id: need.need_id, receivable_id: asset.receivable_id, invoice_id: asset.invoice_id }
    });
    this.store.replace(state);
    return need;
  }

  /**
   * "Kredit in Lending anlegen": one draft Loan Application in Frappe Lending per receivable (idempotent). Lending
   * runs the contract; Sponsum keeps only the event. Tenant admins only, like the confirmation.
   */
  async requestCapitalNeedLoan(needId: string, input: { confirm?: boolean } = {}) {
    const who = principal();
    if (who && !who.admin) {
      throw new DomainError("forbidden", "Nur die Mandantenadministration kann einen Kreditantrag auslösen.");
    }
    const before = this.store.snapshot();
    const need = before.capital_needs.find((row) => row.need_id === needId);
    if (!need) throw new DomainError("not_found", "Kapitalsuche nicht gefunden");
    const asset = need.receivable_id ? before.assets.find((row) => row.receivable_id === need.receivable_id) : undefined;
    if (!asset) {
      throw new DomainError("capital_need_receivable_mismatch", "Der Kapitalbedarf ist mit keiner Forderung verknüpft.");
    }
    let result;
    try {
      const deps = this.lendingDeps();
      result = await requestLoanApplication(
        {
          need,
          receivable: asset,
          confirm: input.confirm,
          // DK-31: before Lending gets a new application, the linked invoice must still be open in ERPNext; the loan
          // can be at most what ERPNext still shows as outstanding.
          refresh: async (receivable) => {
            if (!asset.sales_invoice) return receivable;
            const invoice = await readOpenSalesInvoice(asset.sales_invoice, deps);
            return { ...receivable, currency: invoice.currency, outstanding_amount: invoice.outstanding_amount };
          }
        },
        deps
      );
    } catch (error) {
      throw lendingToDomain(error);
    }
    if (result.created) {
      // Fresh snapshot after the network call, so concurrent changes are not overwritten.
      const state = this.store.snapshot();
      this.appendEvent(state, {
        type: "LENDING_APPLICATION_REQUESTED",
        actor: who?.userId ?? need.seeker_party_id,
        receivable_id: asset.receivable_id,
        payload: { need_id: need.need_id, receivable_id: asset.receivable_id, loan_application: result.loan_application }
      });
      this.store.replace(state);
    }
    return result;
  }

  /**
   * Option 1 (2026-10-03): Movena finances its customers' receivables. Lists the lending company's ERPNext customers
   * as possible seekers/creditors, live via the technical user. Tenant admins of the lending tenant only
   * (MOVENA_LENDING_TENANT, default the legacy tenant): other tenants never see Movena's customer list.
   */
  async lendingCustomers() {
    const who = principal();
    if (who && !who.admin) {
      throw new DomainError("forbidden", "Nur die Mandantenadministration sieht die Kunden aus ERPNext.");
    }
    const lendingTenant = (process.env.MOVENA_LENDING_TENANT || who?.legacyTenant || "").trim();
    if (who && who.tenantId !== lendingTenant) {
      return { configured: true, customers: [], message: "Frappe Lending ist für diesen Mandanten nicht freigeschaltet." };
    }
    try {
      return { configured: true, customers: await listLendingCustomers(this.lendingDeps()) };
    } catch (error) {
      if (error instanceof LendingError && error.code === "lending_not_configured") {
        return { configured: false, customers: [], message: error.message };
      }
      throw lendingToDomain(error);
    }
  }

  /** Lombard (O12) is offered to tenant admins of the lending tenant only, like the customer list. */
  private lombardGate(action: string): { tenantOk: boolean } {
    const who = principal();
    if (who && !who.admin) throw new DomainError("forbidden", `Nur die Mandantenadministration kann ${action}.`);
    const lendingTenant = (process.env.MOVENA_LENDING_TENANT || who?.legacyTenant || "").trim();
    return { tenantOk: !who || who.tenantId === lendingTenant };
  }

  /** Lombard page: securities with Lending's current prices, haircut and LTV, plus this tenant's Lombard requests. */
  async lombardOverview() {
    const { tenantOk } = this.lombardGate("Lombardkredite sehen");
    const requests = this.store.snapshot().capital_needs.filter((need) => need.kind === "LOMBARD");
    if (!tenantOk) {
      return { configured: false, product: null, securities: [], requests: [], message: "Frappe Lending ist für diesen Mandanten nicht freigeschaltet." };
    }
    const deps = this.lendingDeps();
    if (!deps.config?.lombardProduct) {
      return { configured: false, product: null, securities: [], requests, message: "Lombardkredite sind in Sponsum noch nicht eingerichtet." };
    }
    try {
      return { configured: true, product: deps.config.lombardProduct, securities: await listLombardSecurities(deps), requests };
    } catch (error) {
      if (error instanceof LendingError && error.code === "lending_not_configured") {
        return { configured: false, product: null, securities: [], requests, message: error.message };
      }
      throw lendingToDomain(error);
    }
  }

  /**
   * O12 Lombard request by a tenant admin: one draft secured Loan Application in Lending first; only when Lending
   * accepted it, Sponsum records the request (kind LOMBARD, confirmed, collateral as requested, public custody
   * reference) and the events. A refused request leaves nothing behind in either system.
   */
  async requestLombard(input: { customer_id?: string; amount?: string; pledges?: unknown; custody_ref?: string; confirm?: boolean } = {}) {
    const { tenantOk } = this.lombardGate("einen Lombardkredit beantragen");
    if (!tenantOk) throw new DomainError("forbidden", "Frappe Lending ist für diesen Mandanten nicht freigeschaltet.");
    const who = principal();
    let custodyRef: string;
    try {
      custodyRef = assertCustodyReference(input.custody_ref);
    } catch (error) {
      throw lendingToDomain(error);
    }
    const amount = money(String(input.amount ?? ""));
    const needId = `lom-${randomUUID().slice(0, 8)}`;
    let result;
    try {
      result = await requestLombardApplication(
        { requestId: needId, customerId: String(input.customer_id ?? ""), amount, pledges: input.pledges, confirm: input.confirm },
        this.lendingDeps()
      );
    } catch (error) {
      throw lendingToDomain(error);
    }
    const pledges = (Array.isArray(input.pledges) ? input.pledges : [])
      .map((row) => ({ loan_security: String((row as { loan_security?: unknown }).loan_security ?? ""), qty: Number((row as { qty?: unknown }).qty) }))
      .filter((row) => row.loan_security && row.qty > 0);
    const now = new Date().toISOString();
    const need: CapitalNeed = {
      need_id: needId,
      seeker_party_id: String(input.customer_id),
      kind: "LOMBARD",
      amount,
      currency: "CHF",
      tenor_months: null,
      purpose: "Lombardkredit",
      sector: "KMU",
      country: "CH",
      status: "CONFIRMED",
      receivable_id: null,
      confirmed_by: who?.email ?? "system",
      confirmed_at: now,
      collateral: pledges,
      custody_ref: custodyRef,
      legal_note:
        "Lombardkredit über Frappe Lending. Verwahrung per Multisig-Treuhand; Sponsum hält keine Werte und keine Schlüssel.",
      created_at: now
    };
    const state = this.store.snapshot();
    state.capital_needs.push(need);
    this.appendEvent(state, {
      type: "CAPITAL_NEED_CONFIRMED",
      actor: who?.userId ?? need.seeker_party_id,
      payload: { need_id: needId, kind: "LOMBARD", amount, collateral: pledges.map((row) => row.loan_security) }
    });
    this.appendEvent(state, {
      type: "LENDING_APPLICATION_REQUESTED",
      actor: who?.userId ?? need.seeker_party_id,
      payload: { need_id: needId, loan_application: result.loan_application }
    });
    this.store.replace(state);
    return { need, lending: result };
  }

  /** Read-only Lombard status of one request, live from Lending. */
  async lombardStatus(needId: string) {
    this.lombardGate("Lombardkredite sehen");
    const key = decodeURIComponent(needId);
    const need = this.store.snapshot().capital_needs.find((row) => row.need_id === key && row.kind === "LOMBARD");
    if (!need) throw new DomainError("not_found", "Lombardantrag nicht gefunden");
    try {
      return { need, configured: true, lending: await readLombardStatus(need.need_id, this.lendingDeps()) };
    } catch (error) {
      if (error instanceof LendingError && error.code === "lending_not_configured") {
        return { need, configured: false, lending: null, message: error.message };
      }
      throw lendingToDomain(error);
    }
  }

  /** Read-only Lending status of a receivable, live from Frappe Lending; `configured: false` until O1/O8 are done. */
  async receivableLending(id: string) {
    const asset = this.getReceivable(decodeURIComponent(id));
    try {
      return { configured: true, lending: await readLendingStatus(asset.receivable_id, this.lendingDeps()) };
    } catch (error) {
      if (error instanceof LendingError && error.code === "lending_not_configured") {
        return { configured: false, lending: null, message: error.message };
      }
      throw lendingToDomain(error);
    }
  }

  upsertBuyerProfile(profile: BuyerProfile): BuyerProfile {
    const state = this.store.snapshot();
    const existing = state.buyer_profiles.find((row) => row.party_id === profile.party_id);
    if (existing) Object.assign(existing, profile);
    else state.buyer_profiles.push(profile);
    this.store.replace(state);
    return profile;
  }

  seedDemoIfEmpty(): { seeded: boolean } {
    if (this.store.snapshot().assets.length > 0) return { seeded: false };
    this.setKyc("buyer-1", "PASSED");
    this.setKyc("seller-ui", "PASSED");
    this.upsertBuyerProfile({
      party_id: "buyer-1",
      country: "CH",
      currency: "CHF",
      min_debtor_rating: "BBB",
      max_maturity_days: 90,
      max_single_position: "50000.00",
      min_expected_yield: 5.5,
      sector_exclusions: ["gambling"]
    });

    const ready = this.createReceivable({
      invoice_id: "INV-2026-482",
      nominal_amount: "50000",
      issue_date: "2026-08-01",
      maturity_date: "2026-10-07",
      creditor_party_id: "seller-ui",
      debtor_party_id: "debtor-helvetia",
      evidence: FULL_EVIDENCE
    });

    this.createReceivable({
      invoice_id: "INV-2026-510",
      nominal_amount: "18500",
      issue_date: "2026-08-10",
      maturity_date: "2026-09-20",
      creditor_party_id: "seller-ui",
      debtor_party_id: "debtor-alpine",
      evidence: { hasInvoice: true, unpaid: true, hasDispute: false }
    });

    const disputed = this.createReceivable({
      invoice_id: "INV-2026-533",
      nominal_amount: "50000",
      accepted_amount: "40000",
      disputed_amount: "10000",
      issue_date: "2026-07-15",
      maturity_date: "2026-09-30",
      creditor_party_id: "seller-ui",
      debtor_party_id: "debtor-nord",
      evidence: { ...FULL_EVIDENCE, hasDispute: true }
    });
    this.openDispute(disputed.receivable_id, "10000", "resolve-INV-2026-533");
    this.updateDisputeTrack(disputed.receivable_id, {
      ooc_stage: "resolve",
      court_stage: "eschkg",
      eschkg_case_id: "ESCHK-2026-00007",
      notes: "Demo: aussergerichtlich bei Resolve, parallel Betreibung erfasst."
    });

    const listed = this.createReceivable({
      invoice_id: "INV-2026-540",
      nominal_amount: "32000",
      issue_date: "2026-08-05",
      maturity_date: "2026-09-28",
      creditor_party_id: "seller-ui",
      debtor_party_id: "debtor-industria",
      evidence: FULL_EVIDENCE
    });
    const offer = this.createOffer(listed.receivable_id, {
      seller_party_id: "seller-ui",
      kind: "LISTING",
      min_price: "31100",
      factoring_mode: "TRUE_SALE",
      notice_mode: "OPEN"
    });
    this.createBid(offer.offer_id, "buyer-1", "31480");
    this.requestDisclosure(offer.offer_id, "buyer-1", 1);

    const sold = this.createReceivable({
      invoice_id: "INV-2026-551",
      nominal_amount: "20000",
      issue_date: "2026-07-01",
      maturity_date: "2026-08-30",
      creditor_party_id: "seller-ui",
      debtor_party_id: "debtor-abc",
      evidence: FULL_EVIDENCE
    });
    this.requestLiquidity(sold.receivable_id, "seller-ui");
    const quotes = [
      { buyer: "factor-a", amount: money(String(20000 * 0.969)) },
      { buyer: "party-b", amount: money(String(20000 * 0.9758)) }
    ];
    const best = quotes[1];
    const { instruction } = this.acceptLiquidityQuote(sold.receivable_id, "seller-ui", best.buyer, best.amount);
    if (instruction) {
      this.applySettlementWebhook({
        provider: "external-psp",
        provider_event_id: "demo-pay-551",
        payment_reference: instruction.payment_reference,
        observed_amount: instruction.amount,
        observed_currency: "CHF"
      });
    }

    void ready;
    return { seeded: true };
  }

  getTrade(tradeId: string) {
    return this.settlementDossier(tradeId);
  }

  settlementDossier(id: string) {
    const state = this.store.snapshot();
    const key = decodeURIComponent(id);
    const instruction =
      state.instructions.find((row) => row.instruction_id === key || row.payment_reference === key) ?? null;
    const trade =
      (instruction ? state.trades.find((row) => row.trade_id === instruction.trade_id) : null) ??
      state.trades.find((row) => row.trade_id === key) ??
      null;
    if (!trade) throw new DomainError("not_found", "Abschluss nicht gefunden");
    const inst = instruction ?? state.instructions.find((row) => row.trade_id === trade.trade_id) ?? null;
    const observation = inst
      ? state.observations.find((row) => row.instruction_id === inst.instruction_id) ?? null
      : null;
    const assignment = state.assignments.find((row) => row.trade_id === trade.trade_id) ?? null;
    const offer = state.offers.find((row) => row.offer_id === trade.offer_id) ?? null;
    const bid = state.bids.find((row) => row.bid_id === trade.bid_id) ?? null;
    return {
      trade,
      instruction: inst,
      observation,
      asset: mustAsset(state, trade.receivable_id),
      assignment,
      offer,
      bid,
      events: state.events.filter(
        (event) => event.trade_id === trade.trade_id || event.receivable_id === trade.receivable_id
      ),
      accounting: state.accounting.filter((row) => row.receivable_id === trade.receivable_id)
    };
  }

  assignmentDossier(id: string) {
    const state = this.store.snapshot();
    const assignment = state.assignments.find((row) => row.assignment_id === decodeURIComponent(id));
    if (!assignment) throw new DomainError("not_found", "Zession nicht gefunden");
    const related = assignment.trade_id
      ? state.trades.find((row) => row.trade_id === assignment.trade_id)
      : null;
    const instruction = related
      ? state.instructions.find((row) => row.trade_id === related.trade_id) ?? null
      : null;
    const observation = instruction
      ? state.observations.find((row) => row.instruction_id === instruction.instruction_id) ?? null
      : null;
    return {
      assignment,
      asset: mustAsset(state, assignment.receivable_id),
      trade: related ?? null,
      instruction,
      observation,
      wechsel_drafts: state.wechsel_drafts.filter(
        (row) =>
          row.receivable_id === assignment.receivable_id || row.assignment_ids.includes(assignment.assignment_id)
      ),
      events: state.events.filter(
        (event) =>
          event.trade_id === assignment.trade_id ||
          event.receivable_id === assignment.receivable_id ||
          String(event.payload?.assignment_id ?? "") === assignment.assignment_id
      ),
      registry: state.registry.filter((row) => row.receivable_id === assignment.receivable_id)
    };
  }

  capitalNeedDossier(id: string) {
    const key = decodeURIComponent(id);
    const need = this.listCapitalNeeds().find((row) => row.need_id === key);
    if (!need) throw new DomainError("not_found", "Kapitalsuche nicht gefunden");
    const state = this.store.snapshot();
    const who = principal();
    return {
      need,
      matches: this.matchCapitalProviders(need),
      interests: state.capital_interests.filter((row) => row.need_id === need.need_id),
      events: state.events.filter((event) => String(event.payload?.need_id ?? "") === need.need_id),
      // Frappe Lending (O5): who may confirm, and the seeker's receivables it could be linked to.
      can_confirm: !who || who.admin,
      receivable: need.receivable_id ? state.assets.find((row) => row.receivable_id === need.receivable_id) ?? null : null,
      lending_candidates:
        need.kind === "EQUITY" || need.status === "CONFIRMED" || need.status === "WITHDRAWN"
          ? []
          : state.assets
              .filter(
                (row) =>
                  row.creditor_party_id === need.seeker_party_id && row.current_holder_party_id === row.creditor_party_id
              )
              .map((row) => ({
                receivable_id: row.receivable_id,
                invoice_id: row.invoice_id,
                status: row.status,
                instrument_type: row.instrument_type,
                currency: row.currency,
                outstanding_amount: row.outstanding_amount
              }))
    };
  }

  capitalProviderDossier(id: string) {
    const key = decodeURIComponent(id);
    const provider = CAPITAL_PROVIDERS.find((row) => row.provider_id === key);
    if (!provider) throw new DomainError("not_found", "Investor oder Gläubiger nicht gefunden");
    const state = this.store.snapshot();
    const matching_needs = state.capital_needs.filter((need) =>
      this.matchCapitalProviders(need).some((row) => row.provider_id === provider.provider_id)
    );
    return {
      provider,
      matching_needs,
      interests: state.capital_interests.filter((row) => row.provider_id === provider.provider_id)
    };
  }

  listAccounting() {
    return this.store.snapshot().accounting;
  }

  accountingDossier(id: string) {
    const key = decodeURIComponent(id);
    const state = this.store.snapshot();
    const proposal = state.accounting.find((row) => row.proposal_id === key);
    if (!proposal) throw new DomainError("not_found", "Buchungsvorschlag nicht gefunden");
    const asset = state.assets.find((row) => row.receivable_id === proposal.receivable_id) ?? null;
    return {
      proposal,
      asset,
      events: state.events.filter(
        (event) => event.receivable_id === proposal.receivable_id || event.event_id === proposal.event_id
      )
    };
  }

  identityDossier(id: string) {
    const key = decodeURIComponent(id);
    const state = this.store.snapshot();
    const kyc = state.kyc.find((row) => row.party_id === key) ?? null;
    const profile = state.buyer_profiles.find((row) => row.party_id === key) ?? null;
    const provider = CAPITAL_PROVIDERS.find((row) => row.provider_id === key) ?? null;
    const factor = FACTOR_NODES.find((row) => row.node_id === key) ?? null;
    const receivables = state.assets.filter(
      (asset) =>
        asset.debtor_party_id === key ||
        asset.creditor_party_id === key ||
        asset.current_holder_party_id === key
    );
    const assignments = state.assignments.filter(
      (row) =>
        row.transferor_party_id === key ||
        row.transferee_party_id === key ||
        row.debtor_party_id === key
    );
    const trades = state.trades.filter((row) => row.seller_party_id === key || row.buyer_party_id === key);
    if (!kyc && !profile && !provider && !factor && !receivables.length && !assignments.length && !trades.length) {
      throw new DomainError("not_found", "Partei nicht gefunden");
    }
    return {
      party_id: key,
      kyc,
      profile,
      provider,
      factor,
      receivables,
      assignments,
      trades
    };
  }

  factorDossier(id: string) {
    const key = decodeURIComponent(id);
    const node = FACTOR_NODES.find((row) => row.node_id === key);
    if (!node) throw new DomainError("not_found", "Factor-Node nicht gefunden");
    const state = this.store.snapshot();
    return {
      node,
      kyc: state.kyc.find((row) => row.party_id === key) ?? null,
      trades: state.trades.filter((row) => row.buyer_party_id === key || row.seller_party_id === key),
      receivables: state.assets.filter(
        (asset) => asset.current_holder_party_id === key || asset.creditor_party_id === key
      )
    };
  }

  events(receivableId?: string) {
    const state = this.store.snapshot();
    return receivableId
      ? state.events.filter((event) => event.receivable_id === receivableId)
      : state.events;
  }

  accounting(receivableId: string) {
    return this.store.snapshot().accounting.filter((row) => row.receivable_id === receivableId);
  }

  disclosures(offerId: string) {
    return this.store.snapshot().disclosures.filter((row) => row.offer_id === offerId);
  }

  setKyc(partyId: string, status: PartyKyc["status"]): void {
    const state = this.store.snapshot();
    this.ensureKyc(state, partyId, status);
    this.store.replace(state);
  }

  private assertKyc(state: ReturnType<MemorySponsumStore["snapshot"]>, partyId: string): void {
    const row = state.kyc.find((item) => item.party_id === partyId);
    if (!row || row.status !== "PASSED") {
      throw new DomainError("kyc_required", "KYC must be PASSED to offer or bid");
    }
  }

  private ensureKyc(
    state: ReturnType<MemorySponsumStore["snapshot"]>,
    partyId: string,
    status: PartyKyc["status"]
  ): void {
    if (principal() && !principal()!.admin) return;
    const existing = state.kyc.find((item) => item.party_id === partyId);
    if (existing) existing.status = status;
    else state.kyc.push({ party_id: partyId, status });
  }

  private appendEvent(
    state: ReturnType<MemorySponsumStore["snapshot"]>,
    input: {
      type: Parameters<typeof makeProtocolEvent>[0]["event_type"];
      payload: Record<string, unknown>;
      receivable_id?: string | null;
      offer_id?: string | null;
      trade_id?: string | null;
      actor?: string | null;
    }
  ) {
    const prev = state.events.length ? state.events[state.events.length - 1].event_hash : null;
    const event = makeProtocolEvent({
      event_id: `evt-${randomUUID()}`,
      event_type: input.type,
      payload: input.payload,
      prev_event_hash: prev,
      receivable_id: input.receivable_id,
      offer_id: input.offer_id,
      trade_id: input.trade_id,
      actor_party_id: input.actor,
      secret: EVENT_SECRET
    });
    state.events.push(event);
    return event;
  }
}

function defaultLendingDeps(): LendingDeps {
  const config = lendingConfigFromEnv();
  return { config, transport: config ? createHttpLendingTransport(config) : null };
}

/** LendingError -> DomainError with the same stable code, so route.ts maps it like every other domain error. */
function lendingToDomain(error: unknown): unknown {
  return error instanceof LendingError ? new DomainError(error.code, error.message) : error;
}

const storePath = process.env.SPONSUM_STORE_PATH;
export const sponsumService = new SponsumService(secureStore(storePath ? new FileSponsumStore(storePath) : new MemorySponsumStore(), true));

type PartyRow = {
  id: string;
  name: string;
  kind: string;
  erp_name?: string;
  disabled?: boolean;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  iban?: string | null;
  tax_id?: string | null;
  currency?: string;
  territory?: string | null;
};

let cachedErpBase: string | null = null;

function erpSiteHost(): string {
  return process.env.MOVENA_ERPNEXT_SITE || "erp.movena.ch";
}

function candidateErpBases(): string[] {
  const configured = (process.env.MOVENA_ERPNEXT_URL || "").replace(/\/$/, "");
  const bases = [configured, "http://127.0.0.1:8090"].filter(Boolean);
  try {
    const ip = execFileSync(
      "docker",
      ["inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", "frappe_docker-backend-1"],
      { encoding: "utf8", timeout: 2000 }
    ).trim();
    if (ip) bases.push(`http://${ip}:8000`);
  } catch {
    /* host without the ERP container — 8090 or MOVENA_ERPNEXT_URL remain */
  }
  return [...new Set(bases)];
}

function getJsonWithSiteHost(base: string, path: string, site: string): Promise<{ status: number; body: unknown }> {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Accept: "application/json",
          Host: site,
          "X-Frappe-Site-Name": site
        },
        timeout: 4000
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk as Buffer));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: response.statusCode ?? 0, body: raw ? JSON.parse(raw) : {} });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy();
      reject(new Error("erp_timeout"));
    });
    request.end();
  });
}

async function fetchErpNextParties(): Promise<{ companies: PartyRow[]; customers: PartyRow[] }> {
  const site = erpSiteHost();
  const ordered = cachedErpBase
    ? [cachedErpBase, ...candidateErpBases().filter((base) => base !== cachedErpBase)]
    : candidateErpBases();
  for (const base of ordered) {
    try {
      const { status, body } = await getJsonWithSiteHost(
        base,
        "/api/method/movena_debtors.api.sponsum.list_parties",
        site
      );
      if (status < 200 || status >= 300) continue;
      const payload = body as {
        message?: { companies?: PartyRow[]; customers?: PartyRow[] };
        exc_type?: string;
      };
      if (payload.exc_type) continue;
      cachedErpBase = base;
      return {
        companies: payload.message?.companies ?? [],
        customers: payload.message?.customers ?? []
      };
    } catch {
      continue;
    }
  }
  return { companies: [], customers: [] };
}

let partyCardCache: { at: number; cards: PartyCard[] } | null = null;

function rememberPartyCards(cards: PartyCard[]) {
  partyCardCache = { at: Date.now(), cards };
}

function partyCardsForVenue(state: ReturnType<MemorySponsumStore["snapshot"]>): PartyCard[] {
  if (!principal() && partyCardCache && Date.now() - partyCardCache.at < 120_000) {
    return partyCardCache.cards;
  }
  const local = localPartiesFromState(state);
  return [...local.companies, ...local.customers];
}

const DEMO_PARTY_GEO: Record<string, Pick<PartyRow, "name" | "city" | "country" | "kind">> = {
  "debtor-nord": { name: "Nordholz AG", city: "Winterthur", country: "Schweiz", kind: "customer" },
  "debtor-helvetia": { name: "Helvetia Industrie AG", city: "Zürich", country: "Schweiz", kind: "customer" },
  "debtor-alpine": { name: "Alpine Components AG", city: "Chur", country: "Schweiz", kind: "customer" },
  "debtor-industria": { name: "Industria AG", city: "Baden", country: "Schweiz", kind: "customer" },
  "debtor-abc": { name: "ABC Werkstoffe AG", city: "Aarau", country: "Schweiz", kind: "customer" },
  "seller-ui": { name: "Movena GmbH", city: "Zürich", country: "Schweiz", kind: "company" },
  "seller-1": { name: "Movena GmbH", city: "Zürich", country: "Schweiz", kind: "company" }
};

function localPartiesFromState(state: ReturnType<MemorySponsumStore["snapshot"]>): {
  companies: PartyRow[];
  customers: PartyRow[];
} {
  const customers = new Map<string, PartyRow>();
  const companies = new Map<string, PartyRow>();
  const apply = (id: string, fallbackKind: "customer" | "company", bucket: Map<string, PartyRow>) => {
    if (!id || bucket.has(id)) return;
    const demo = DEMO_PARTY_GEO[id];
    bucket.set(id, {
      id,
      name: demo?.name || id.replace(/^(customer:|company:)/, ""),
      kind: demo?.kind || fallbackKind,
      city: demo?.city ?? null,
      country: demo?.country ?? null
    });
  };
  for (const asset of state.assets) {
    apply(asset.debtor_party_id, "customer", customers);
    apply(asset.current_holder_party_id, "company", companies);
    apply(asset.creditor_party_id, "company", companies);
  }
  return { companies: [...companies.values()], customers: [...customers.values()] };
}

function mergeParties(
  erp: { companies: PartyRow[]; customers: PartyRow[] },
  local: { companies: PartyRow[]; customers: PartyRow[] }
) {
  const byId = (rows: PartyRow[]) => {
    const map = new Map<string, PartyRow>();
    for (const row of rows) map.set(row.id, row);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  };
  return {
    companies: byId([...erp.companies, ...local.companies]),
    customers: byId([...erp.customers, ...local.customers])
  };
}

const FULL_EVIDENCE: VerificationEvidence = {
  hasInvoice: true,
  invoiceElectronic: true,
  hasContract: true,
  hasPurchaseOrder: true,
  hasDelivery: true,
  hasPerformance: true,
  hasAcceptance: true,
  debtorAcknowledged: true,
  unpaid: true,
  hasDispute: false,
  creditorKyc: true,
  debtorKyc: true,
  hasCreditInfo: true,
  hasHistoricalPayments: true,
  documentIntegrity: true
};

const CAPITAL_PROVIDERS: CapitalProvider[] = [
  {
    provider_id: "inv-helvetia",
    display_name: "Helvetia Industrieminderheit",
    kind: "INVESTOR",
    countries: ["CH"],
    currencies: ["CHF"],
    tickets_min: "50000.00",
    tickets_max: "1500000.00",
    offers: ["EQUITY"],
    max_tenor_months: null,
    regulatory_status: "Privatinvestor / keine öffentliche Platzierung",
    public_blurb: "Minderheitsbeteiligungen an Schweizer KMU, operativ mit im Geschäft."
  },
  {
    provider_id: "fo-alpin",
    display_name: "Alpin Family Office",
    kind: "FAMILY_OFFICE",
    countries: ["CH"],
    currencies: ["CHF", "EUR"],
    tickets_min: "100000.00",
    tickets_max: "5000000.00",
    offers: ["EQUITY", "LONG_DEBT"],
    max_tenor_months: 84,
    regulatory_status: "Family Office",
    public_blurb: "Eigenkapital und langfristiges Darlehen, ohne Fondsvehikel über Sponsum."
  },
  {
    provider_id: "lend-short",
    display_name: "Rheinbrücke Betriebsmittel",
    kind: "LENDER",
    countries: ["CH"],
    currencies: ["CHF"],
    tickets_min: "20000.00",
    tickets_max: "400000.00",
    offers: ["SHORT_DEBT"],
    max_tenor_months: 12,
    regulatory_status: "nicht-bankliche Betriebsmittelfinanzierung",
    public_blurb: "Kurzfristiges FK für Saison und Lager. Kein Factoring, kein Wechsel."
  },
  {
    provider_id: "bank-ch",
    display_name: "Kantonalpartner FK",
    kind: "BANK",
    countries: ["CH"],
    currencies: ["CHF"],
    tickets_min: "50000.00",
    tickets_max: "3000000.00",
    offers: ["SHORT_DEBT", "LONG_DEBT"],
    max_tenor_months: 120,
    regulatory_status: "Bank",
    public_blurb: "Klassisches Bank-FK, kurz und lang. Abschluss ausserhalb von Sponsum."
  }
];

const FACTOR_NODES: FactorNode[] = [
  {
    node_id: "factor-a",
    kind: "FACTOR",
    jurisdiction: "CH",
    currencies: ["CHF", "EUR"],
    min_invoice: "5000.00",
    max_invoice: "250000.00",
    regulatory_status: "SRO / Factor",
    pricing_api: true
  },
  {
    node_id: "party-b",
    kind: "SME",
    jurisdiction: "CH",
    currencies: ["CHF"],
    min_invoice: "2000.00",
    max_invoice: "80000.00",
    regulatory_status: "KMU-Käufer",
    pricing_api: false
  },
  {
    node_id: "factor-c",
    kind: "BANK",
    jurisdiction: "CH",
    currencies: ["CHF", "EUR"],
    min_invoice: "10000.00",
    max_invoice: "1000000.00",
    regulatory_status: "Bank",
    pricing_api: true
  }
];

function mustAsset(state: ReturnType<MemorySponsumStore["snapshot"]>, id: string): ReceivableAsset {
  const asset = state.assets.find((row) => row.receivable_id === id);
  if (!asset) throw new DomainError("not_found", "Receivable not found");
  return asset;
}

function mustWechsel(state: ReturnType<MemorySponsumStore["snapshot"]>, id: string): WechselDraft {
  const draft = state.wechsel_drafts.find((row) => row.instrument_id === id);
  if (!draft) throw new DomainError("not_found", "Wechsel-Entwurf nicht gefunden");
  return draft;
}

function hasSignature(rows: InstrumentSignature[] | undefined, role: SignatureRole): boolean {
  return Boolean(rows?.some((row) => row.role === role && row.status === "SIGNED"));
}

function wechselContentHash(draft: WechselDraft): string {
  return hashPayload({
    instrument_id: draft.instrument_id,
    form: draft.wechsel_form,
    purpose: draft.wechsel_purpose,
    verfall: draft.verfall_art,
    drawer: draft.drawer_party_id,
    drawee: draft.drawee_party_id,
    remittee: draft.remittee_party_id,
    amount: draft.amount,
    currency: draft.currency,
    issue_date: draft.issue_date,
    maturity_date: draft.maturity_date,
    place: draft.place_of_payment
  });
}

function assignmentContentHash(assignment: AssignmentPackage): string {
  return hashPayload({
    assignment_id: assignment.assignment_id,
    receivable_id: assignment.receivable_id,
    transferor: assignment.transferor_party_id,
    transferee: assignment.transferee_party_id,
    price: assignment.purchase_price,
    mode: assignment.factoring_mode,
    notice: assignment.notice_mode
  });
}

function makeCompletedSignature(input: {
  role: SignatureRole;
  party_id: string;
  signer_label: string;
  quality: InstrumentSignature["quality"];
  method: InstrumentSignature["method"];
  content_hash: string;
  legal_note: string;
}): InstrumentSignature {
  const signed_at = new Date().toISOString();
  return {
    signature_id: `sig-${randomUUID().slice(0, 8)}`,
    role: input.role,
    party_id: input.party_id,
    signer_label: input.signer_label,
    quality: input.quality,
    method: input.method,
    status: "SIGNED",
    content_hash: input.content_hash,
    signature: signEventHash(`${input.role}:${input.party_id}:${input.content_hash}:${signed_at}`, EVENT_SECRET),
    signed_at,
    legal_note: input.legal_note
  };
}

function normalizeRequestedQuality(value?: string): "SES" | SkribbleQuality {
  const q = String(value || "SES").toUpperCase();
  if (q === "QES" || q === "AES") return q;
  if (q === "SES" || q === "") return "SES";
  throw new DomainError("invalid_signature", "Nur SES, AES oder QES.");
}

function wechselPdf(draft: WechselDraft): Buffer {
  return buildSimplePdf("Sponsum Handelsbeleg", [
    `Beleg ${draft.instrument_id}`,
    `Art ${draft.wechsel_form} / ${draft.verfall_art}`,
    `Aussteller ${draft.drawer_party_id}`,
    `Bezogener ${draft.drawee_party_id}`,
    `Zahlungsempfaenger ${draft.remittee_party_id}`,
    `Betrag ${draft.currency} ${draft.amount}`,
    `Ausstellung ${draft.issue_date}  Verfall ${draft.maturity_date}`,
    `Zahlungsort ${draft.place_of_payment}`,
    "",
    "Kein Wechsel nach Art. 990 ff. OR.",
    "Uebertragung nur als Zession. Kein Indossament, kein Aval.",
    `Hash ${wechselContentHash(draft)}`
  ]);
}

function assignmentPdf(assignment: AssignmentPackage): Buffer {
  return buildSimplePdf("Zessionsvertrag", [
    assignment.contract_title,
    assignment.legal_basis,
    `Zession ${assignment.assignment_id}`,
    `Zedent ${assignment.transferor_party_id}`,
    `Zessionar ${assignment.transferee_party_id}`,
    `Schuldner ${assignment.debtor_party_id}`,
    `Kaufpreis ${assignment.currency} ${assignment.purchase_price}`,
    `Modus ${assignment.factoring_mode} / ${assignment.notice_mode}`,
    "",
    "Kein Indossament. Kein gesetzlicher Wechsel.",
    `Hash ${assignmentContentHash(assignment)}`
  ]);
}

function mustLock(state: ReturnType<MemorySponsumStore["snapshot"]>, id: string) {
  const lock = state.locks.find((row) => row.receivable_id === id);
  if (!lock) throw new DomainError("not_found", "Lock not found");
  return lock;
}

function money(value: string): string {
  return Number(String(value).replace(/'/g, "")).toFixed(2);
}

function normalizeCapitalKind(value: string): CapitalKind {
  const raw = String(value || "").toUpperCase();
  if (raw === "EQUITY" || raw === "EK" || raw === "EIGENKAPITAL") return "EQUITY";
  if (raw === "SHORT_DEBT" || raw === "KURZ" || raw === "SHORT") return "SHORT_DEBT";
  if (raw === "LONG_DEBT" || raw === "LANG" || raw === "LONG") return "LONG_DEBT";
  throw new DomainError("invalid_capital", "Nur Eigenkapital, kurzfristiges oder langfristiges Fremdkapital.");
}

/**
 * DK-31: a receivable from an ERPNext Sales Invoice takes number, amount, currency, dates and debtor from ERPNext.
 * A debtor or creditor that contradicts the invoice is refused instead of silently replaced.
 */
function fromSalesInvoice(input: CreateReceivableInput, invoice: OpenSalesInvoice): CreateReceivableInput {
  const debtor = `customer:${invoice.customer}`;
  const requestedDebtor = String(input.debtor_party_id ?? "").trim();
  if (!invoice.customer || (/^customer:/i.test(requestedDebtor) && requestedDebtor.toLowerCase() !== debtor.toLowerCase())) {
    throw new DomainError("invoice_party_mismatch", `Die ERPNext-Rechnung ${invoice.name} lautet auf einen anderen Kunden.`);
  }
  const creditor = String(input.creditor_party_id ?? "").trim();
  if (
    creditor.toLowerCase() === debtor.toLowerCase() ||
    (/^company:/i.test(creditor) && invoice.company && creditor.toLowerCase() !== `company:${invoice.company}`.toLowerCase())
  ) {
    throw new DomainError("invoice_party_mismatch", `Die ERPNext-Rechnung ${invoice.name} gehört nicht diesem Gläubiger.`);
  }
  const evidence = input.evidence ?? { hasInvoice: true, unpaid: true, hasDispute: false };
  return {
    ...input,
    invoice_id: invoice.name,
    sales_invoice: invoice.name,
    debtor_party_id: debtor,
    currency: invoice.currency,
    nominal_amount: invoice.grand_total,
    accepted_amount:
      input.accepted_amount !== undefined && Number(input.accepted_amount) <= Number(invoice.grand_total)
        ? input.accepted_amount
        : invoice.grand_total,
    outstanding_amount: invoice.outstanding_amount,
    issue_date: invoice.posting_date || input.issue_date,
    maturity_date: invoice.due_date || input.maturity_date,
    evidence: { ...evidence, hasInvoice: true, unpaid: true }
  };
}

/** Invoice numbers compare without case and surrounding/inner whitespace. */
function normalizedInvoiceNo(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Creditor identity for the global duplicate check: ERPNext parties (`customer:`/`company:`) and Swiss UIDs are global;
 * other ids (desk placeholders such as `seller-ui`) only mean something inside their tenant.
 */
function creditorIdentity(partyId: string, tenantId: string): string {
  const id = String(partyId ?? "").trim();
  const uid = id.toUpperCase().replace(/[^A-Z0-9]/g, "").match(/CHE(\d{9})/);
  if (uid) return `uid:CHE${uid[1]}`;
  if (/^(customer|company):/i.test(id)) return id.toLowerCase();
  return `${tenantId}\u0000${id.toLowerCase()}`;
}

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000));
}

type Offer = import("@sponsum/shared").Offer;
type Bid = import("@sponsum/shared").Bid;
type Trade = import("@sponsum/shared").Trade;
type SettlementInstruction = import("@sponsum/shared").SettlementInstruction;
type DisclosureGrant = import("@sponsum/shared").DisclosureGrant;
type PartyKyc = import("@sponsum/shared").PartyKyc;
