import { requireSponsumScope, principal } from "./access-context.js";
import { Router } from "express";
import { DomainError } from "@sponsum/shared";
import { sponsumService } from "./service.js";
import { settlementWebhookSecret, verifySettlementReport } from "./settlement-webhook.js";

export const sponsumRouter = Router();
sponsumRouter.use(requireSponsumScope());
sponsumRouter.get("/session", (_req, res) => res.json({ ...principal(), policy: "owner_or_shared_with_tenant_admin" }));

/**
 * SPO-05: the desk acts for the tenant's own company. A request may name it (or leave it out),
 * never another seller; the person stands in every event (appendEvent).
 */
const OWN_SELLER_PARTIES = new Set(["seller-ui", "seller-1"]);
sponsumRouter.use((req, res, next) => {
  if (req.method !== "POST" || !req.body || typeof req.body !== "object") return next();
  const supplied = (req.body as Record<string, unknown>).seller_party_id;
  if (supplied !== undefined && supplied !== null && supplied !== "" && !OWN_SELLER_PARTIES.has(String(supplied))) {
    return res.status(403).json({ error: { code: "forbidden", message: "Verkäufer ist immer die eigene Gesellschaft dieses Mandanten." } });
  }
  next();
});
sponsumRouter.post("/access/:kind/:id", (req, res) => {
  handle(() => sponsumService.shareReadAccess(req.params.kind, req.params.id, req.body?.readers), res);
});

const DOMAIN_STATUS: Record<string, number> = {
  not_found: 404,
  invoice_not_found: 404,
  forbidden: 403,
  kyc_required: 403,
  policy_denied: 403,
  skribble_quality_downgraded: 403,
  skribble_not_configured: 503,
  skribble_unreachable: 503,
  lending_not_configured: 503,
  lending_unreachable: 503,
  erp_unavailable: 503,
  lending_forbidden: 502,
  settlement_webhook_not_configured: 503,
  unsigned_webhook: 403,
  four_eyes_required: 403,
  bank_reference_required: 400,
  validation_error: 400,
  confirmation_required: 400,
  invalid_amount: 400,
  custody_reference_invalid: 400,
  lombard_without_collateral: 400
};

function sendDomainError(error: unknown, res: import("express").Response): boolean {
  if (!(error instanceof DomainError)) {
    return false;
  }
  const status = Object.hasOwn(DOMAIN_STATUS, error.code) ? DOMAIN_STATUS[error.code] : 409;
  res.status(status).json({ error: { code: error.code, message: error.message } });
  return true;
}

function handleDownload(
  run: () => { filename: string; type: string; buffer: Buffer },
  res: import("express").Response
): void {
  try {
    const file = run();
    res.setHeader("Content-Type", file.type);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  } catch (error) {
    if (!sendDomainError(error, res)) {
      throw error;
    }
  }
}

function handle(run: () => unknown, res: import("express").Response): void {
  try {
    const body = run();
    if (body && typeof (body as Promise<unknown>).then === "function") {
      (body as Promise<unknown>)
        .then((value) => res.json(value))
        .catch((error) => {
          if (!sendDomainError(error, res)) {
            throw error;
          }
        });
      return;
    }
    res.json(body);
  } catch (error) {
    if (!sendDomainError(error, res)) {
      throw error;
    }
  }
}

sponsumRouter.get("/workspace", (_req, res) => {
  handle(() => sponsumService.workspace(), res);
});

sponsumRouter.get("/parties", (_req, res) => {
  handle(() => sponsumService.listParties(), res);
});

sponsumRouter.get("/receivables", (_req, res) => {
  handle(() => sponsumService.listReceivables(), res);
});

sponsumRouter.get("/trades", (_req, res) => {
  handle(() => sponsumService.listTrades(), res);
});

sponsumRouter.get("/settlements", (_req, res) => {
  handle(() => sponsumService.listSettlements(), res);
});

sponsumRouter.get("/disputes", (req, res) => {
  const lifecycle = typeof req.query.lifecycle === "string" ? req.query.lifecycle : "all";
  handle(
    () =>
      sponsumService.listDisputes(
        lifecycle === "open" || lifecycle === "closed" || lifecycle === "archived" || lifecycle === "all"
          ? lifecycle
          : "all"
      ),
    res
  );
});

sponsumRouter.post("/disputes", (req, res) => {
  handle(() => sponsumService.createDispute(req.body ?? {}), res);
});

sponsumRouter.get("/disputes/templates", (_req, res) => {
  handle(() => sponsumService.listDisputeTemplates(), res);
});

sponsumRouter.get("/disputes/:id", (req, res) => {
  handle(() => sponsumService.disputeDossier(req.params.id), res);
});

sponsumRouter.get("/disputes/:id/venue", (req, res) => {
  const family = typeof req.query.family === "string" ? req.query.family : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  handle(() => sponsumService.assessDisputeVenue(req.params.id, { family, from }), res);
});

sponsumRouter.post("/disputes/:id/track", (req, res) => {
  handle(() => sponsumService.updateDisputeTrack(req.params.id, req.body ?? {}), res);
});

sponsumRouter.post("/disputes/:id/close", (req, res) => {
  handle(() => sponsumService.closeDispute(req.params.id, req.body ?? {}), res);
});

sponsumRouter.post("/disputes/:id/archive", (req, res) => {
  handle(() => sponsumService.archiveDispute(req.params.id, req.body ?? {}), res);
});

sponsumRouter.post("/disputes/:id/reopen", (req, res) => {
  handle(() => sponsumService.reopenDispute(req.params.id, req.body ?? {}), res);
});

sponsumRouter.post("/disputes/:id/links", (req, res) => {
  const incoming = Array.isArray(req.body?.links) ? req.body.links : [];
  handle(() => sponsumService.linkDispute(req.params.id, incoming), res);
});

sponsumRouter.post("/disputes/:id/forms", (req, res) => {
  handle(
    () =>
      sponsumService.generateDisputeForm(req.params.id, String(req.body?.template_id || ""), {
        instruction: req.body?.instruction ? String(req.body.instruction) : undefined,
        use_ai: req.body?.use_ai !== false
      }),
    res
  );
});

sponsumRouter.get("/disputes/:id/forms/:formId/pdf", (req, res) => {
  handleDownload(() => sponsumService.disputeFormPdf(req.params.id, req.params.formId), res);
});

sponsumRouter.post("/disputes/:id/exports", (req, res) => {
  handle(() => sponsumService.createDisputeExport(req.params.id, req.body ?? {}), res);
});

sponsumRouter.get("/disputes/:id/exports/:exportId", (req, res) => {
  handleDownload(() => sponsumService.disputeExportZip(req.params.id, req.params.exportId), res);
});

sponsumRouter.get("/events", (_req, res) => {
  handle(() => sponsumService.events(), res);
});

sponsumRouter.get("/factors", (_req, res) => {
  handle(() => sponsumService.factors(), res);
});

sponsumRouter.get("/factors/:id", (req, res) => {
  handle(() => sponsumService.factorDossier(req.params.id), res);
});

sponsumRouter.get("/policies", (_req, res) => {
  handle(() => sponsumService.policies(), res);
});

sponsumRouter.post("/buyer-profiles", (req, res) => {
  handle(() => sponsumService.upsertBuyerProfile(req.body), res);
});

sponsumRouter.get("/assignments", (_req, res) => {
  handle(() => sponsumService.listAssignments(), res);
});

sponsumRouter.get("/assignments/:id", (req, res) => {
  handle(() => sponsumService.assignmentDossier(req.params.id), res);
});

sponsumRouter.post("/assignments", (req, res) => {
  handle(
    () =>
      sponsumService.withCheckedInvoice(req.body.receivable_id, () =>
        sponsumService.createAssignment({
          receivable_id: String(req.body.receivable_id),
          seller_party_id: String(req.body.seller_party_id ?? "seller-ui"),
          buyer_party_id: String(req.body.buyer_party_id),
          purchase_price: String(req.body.purchase_price),
          factoring_mode: req.body.factoring_mode,
          notice_mode: req.body.notice_mode,
          payee_iban: req.body.payee_iban
        })
      ),
    res
  );
});

sponsumRouter.get("/wechsel-drafts", (_req, res) => {
  handle(() => sponsumService.listWechselDrafts(), res);
});

sponsumRouter.post("/wechsel-drafts", (req, res) => {
  handle(() => sponsumService.createWechselDraft(req.body), res);
});

sponsumRouter.get("/wechsel-drafts/:id", (req, res) => {
  handle(() => sponsumService.getWechsel(req.params.id), res);
});

sponsumRouter.get("/wechsel-drafts/:id/dossier", (req, res) => {
  handle(() => sponsumService.wechselDossier(req.params.id), res);
});

sponsumRouter.post("/wechsel-drafts/:id/accept", (req, res) => {
  handle(() => sponsumService.acknowledgeWechsel(req.params.id), res);
});

sponsumRouter.post("/wechsel-drafts/:id/sign", (req, res) => {
  handle(
    () =>
      sponsumService.signWechsel(req.params.id, {
        role: req.body.role,
        quality: req.body.quality,
        signer_label: req.body.signer_label,
        signer_email: req.body.signer_email,
        first_name: req.body.first_name,
        last_name: req.body.last_name
      }),
    res
  );
});

sponsumRouter.post("/wechsel-drafts/:id/sign/sync", (req, res) => {
  handle(() => sponsumService.syncSignatures(req.params.id), res);
});

sponsumRouter.post("/wechsel-drafts/:id/anchor", (req, res) => {
  handle(() => sponsumService.anchorWechsel(req.params.id), res);
});

sponsumRouter.post("/assignments/:id/sign", (req, res) => {
  handle(
    () =>
      sponsumService.signAssignment(req.params.id, {
        role: req.body.role,
        quality: req.body.quality,
        signer_label: req.body.signer_label,
        signer_email: req.body.signer_email
      }),
    res
  );
});

sponsumRouter.post("/assignments/:id/sign/sync", (req, res) => {
  handle(() => sponsumService.syncAssignmentSignatures(req.params.id), res);
});

sponsumRouter.post("/wechsel-drafts/:id/guarantee", (req, res) => {
  handle(
    () =>
      sponsumService.addWechselGuarantee(req.params.id, {
        guarantor_party_id: String(req.body.guarantor_party_id ?? ""),
        kind: req.body.kind,
        amount: req.body.amount
      }),
    res
  );
});

sponsumRouter.post("/wechsel-drafts/:id/endorse", (req, res) => {
  handle(() => sponsumService.endorseWechsel(req.params.id), res);
});

sponsumRouter.post("/wechsel-drafts/:id/protest", (req, res) => {
  handle(() => sponsumService.protestWechsel(req.params.id), res);
});

sponsumRouter.post("/wechsel-drafts/:id/assign", (req, res) => {
  handle(
    () =>
      sponsumService.assignWechsel(req.params.id, {
        buyer_party_id: String(req.body.buyer_party_id),
        purchase_price: String(req.body.purchase_price),
        seller_party_id: req.body.seller_party_id,
        factoring_mode: req.body.factoring_mode,
        notice_mode: req.body.notice_mode,
        payee_iban: req.body.payee_iban
      }),
    res
  );
});

sponsumRouter.post("/wechsel-drafts/:id/default", (req, res) => {
  handle(() => sponsumService.defaultWechsel(req.params.id, req.body?.disputed_amount), res);
});

sponsumRouter.post("/receivables", (req, res) => {
  handle(() => sponsumService.submitReceivable(req.body), res);
});

sponsumRouter.get("/receivables/:id", (req, res) => {
  handle(() => sponsumService.getReceivable(req.params.id), res);
});

sponsumRouter.get("/receivables/:id/dossier", (req, res) => {
  handle(() => sponsumService.dossier(req.params.id), res);
});

sponsumRouter.post("/receivables/:id/verify", (req, res) => {
  // Prüfnachweise bestätigen gibt die Forderung für Angebot und Finanzierung frei: nur Mandantenadministration.
  if (!principal()?.admin) {
    return res.status(403).json({ error: { code: "forbidden", message: "Prüfnachweise bestätigen darf nur die Mandantenadministration." } });
  }
  handle(() => sponsumService.verify(req.params.id, req.body ?? {}), res);
});

sponsumRouter.post("/receivables/:id/disputes", (req, res) => {
  handle(() => sponsumService.openDispute(req.params.id, String(req.body?.disputed_amount ?? "0"), req.body?.resolve_case_id), res);
});

sponsumRouter.post("/receivables/:id/offers", (req, res) => {
  handle(() => sponsumService.withCheckedInvoice(req.params.id, () => sponsumService.createOffer(req.params.id, req.body)), res);
});

sponsumRouter.post("/receivables/:id/liquidity", (req, res) => {
  handle(
    () => sponsumService.withCheckedInvoice(req.params.id, () => sponsumService.requestLiquidity(req.params.id, req.body.seller_party_id)),
    res
  );
});

sponsumRouter.post("/receivables/:id/liquidity/accept", (req, res) => {
  handle(
    () =>
      sponsumService.withCheckedInvoice(req.params.id, () =>
        sponsumService.acceptLiquidityQuote(
          req.params.id,
          String(req.body.seller_party_id),
          String(req.body.buyer_party_id),
          String(req.body.amount),
          req.body.payee_iban
        )
      ),
    res
  );
});

sponsumRouter.get("/capital/providers", (_req, res) => {
  handle(() => sponsumService.listCapitalProviders(), res);
});

sponsumRouter.get("/capital/providers/:id", (req, res) => {
  handle(() => sponsumService.capitalProviderDossier(req.params.id), res);
});

sponsumRouter.get("/capital/needs", (_req, res) => {
  handle(() => sponsumService.listCapitalNeeds(), res);
});

sponsumRouter.get("/capital/needs/:id", (req, res) => {
  handle(() => sponsumService.capitalNeedDossier(req.params.id), res);
});

sponsumRouter.get("/accounting", (_req, res) => {
  handle(() => sponsumService.listAccounting(), res);
});

sponsumRouter.get("/accounting/:id", (req, res) => {
  handle(() => sponsumService.accountingDossier(req.params.id), res);
});

sponsumRouter.get("/identity/:id", (req, res) => {
  handle(() => sponsumService.identityDossier(req.params.id), res);
});

sponsumRouter.post("/capital/needs", (req, res) => {
  handle(() => sponsumService.createCapitalNeed(req.body), res);
});

sponsumRouter.post("/capital/needs/:id/interest", (req, res) => {
  handle(() => sponsumService.requestCapitalIntro(req.params.id, String(req.body.provider_id), req.body.note), res);
});

sponsumRouter.post("/capital/needs/:id/withdraw", (req, res) => {
  handle(() => sponsumService.withdrawCapitalNeed(req.params.id), res);
});

// Frappe Lending (movena-suite docs/architecture/frappe-lending.md, docs/lending.md)
sponsumRouter.post("/capital/needs/:id/confirm", (req, res) => {
  handle(
    () =>
      sponsumService.withCheckedInvoice(req.body?.receivable_id, () =>
        sponsumService.confirmCapitalNeed(req.params.id, {
          receivable_id: req.body?.receivable_id,
          confirm: req.body?.confirm === true
        })
      ),
    res
  );
});

sponsumRouter.post("/capital/needs/:id/lending", (req, res) => {
  handle(() => sponsumService.requestCapitalNeedLoan(req.params.id, { confirm: req.body?.confirm === true }), res);
});

// Lombard credit (O12, movena-suite docs/architecture/frappe-lending-lombard.md)
sponsumRouter.get("/lombard", (_req, res) => {
  handle(() => sponsumService.lombardOverview(), res);
});

sponsumRouter.post("/lombard", (req, res) => {
  handle(
    () =>
      sponsumService.requestLombard({
        customer_id: req.body?.customer_id,
        amount: req.body?.amount,
        pledges: req.body?.pledges,
        custody_ref: req.body?.custody_ref,
        confirm: req.body?.confirm === true
      }),
    res
  );
});

sponsumRouter.get("/lombard/:id", (req, res) => {
  handle(() => sponsumService.lombardStatus(req.params.id), res);
});

sponsumRouter.get("/lending/customers", (_req, res) => {
  handle(() => sponsumService.lendingCustomers(), res);
});

sponsumRouter.get("/receivables/:id/lending", (req, res) => {
  handle(() => sponsumService.receivableLending(req.params.id), res);
});

sponsumRouter.get("/discovery", (_req, res) => {
  handle(() => sponsumService.discoveryLevel0(), res);
});

sponsumRouter.get("/offers/:id", (req, res) => {
  handle(() => sponsumService.offerDetail(req.params.id, String(req.query.buyer ?? "buyer-1")), res);
});

sponsumRouter.post("/offers/:id/bids", (req, res) => {
  handle(() => sponsumService.createBid(req.params.id, req.body.buyer_party_id, String(req.body.amount)), res);
});

sponsumRouter.post("/bids/:id/counter", (req, res) => {
  handle(() => sponsumService.counterOffer(req.params.id, String(req.body.amount)), res);
});

sponsumRouter.post("/bids/:id/accept", (req, res) => {
  handle(
    () =>
      sponsumService.withCheckedInvoice(sponsumService.receivableOfBid(req.params.id), () =>
        sponsumService.acceptBid(req.params.id, req.body.seller_party_id, req.body.payee_iban)
      ),
    res
  );
});

sponsumRouter.get("/trades/:id", (req, res) => {
  handle(() => sponsumService.settlementDossier(req.params.id), res);
});

sponsumRouter.get("/settlements/:id", (req, res) => {
  handle(() => sponsumService.settlementDossier(req.params.id), res);
});

sponsumRouter.post("/settlement/mark-paid", (_req, res) => {
  handle(() => sponsumService.markPaidFromUi(), res);
});

sponsumRouter.post("/settlements/:instructionId/provider-confirm", (req, res) => {
  handle(
    () =>
      sponsumService.confirmByProvider(req.params.instructionId, {
        confirm: req.body?.confirm === true,
        bank_reference: req.body?.bank_reference
      }),
    res
  );
});

// DK-31: "signed" is decided by the HMAC check against the configured provider secret, never by the request body.
sponsumRouter.post("/webhooks/settlement/:provider", (req, res) => {
  handle(() => {
    const report = {
      provider_event_id: String(req.body?.provider_event_id ?? ""),
      payment_reference: String(req.body?.payment_reference ?? ""),
      observed_amount: String(req.body?.observed_amount ?? ""),
      observed_currency: String(req.body?.observed_currency ?? ""),
      ...(typeof req.body?.observed_at === "string" ? { observed_at: req.body.observed_at } : {})
    };
    verifySettlementReport({ headers: req.headers, provider: req.params.provider, report, secret: settlementWebhookSecret() });
    return sponsumService.applySettlementWebhook({ provider: req.params.provider, ...report, signed: true });
  }, res);
});

sponsumRouter.post("/offers/:id/disclosure-requests", (req, res) => {
  handle(() => sponsumService.requestDisclosure(req.params.id, req.body.buyer_party_id, req.body.level ?? 1), res);
});

sponsumRouter.get("/offers/:id/disclosures", (req, res) => {
  handle(() => sponsumService.disclosures(req.params.id), res);
});

sponsumRouter.get("/portfolio/:partyId", (req, res) => {
  handle(() => sponsumService.portfolio(req.params.partyId), res);
});

sponsumRouter.get("/policies/:jurisdiction", (req, res) => {
  handle(() => sponsumService.policy(req.params.jurisdiction), res);
});

sponsumRouter.get("/receivables/:id/events", (req, res) => {
  handle(() => sponsumService.events(req.params.id), res);
});

sponsumRouter.get("/receivables/:id/accounting", (req, res) => {
  handle(() => sponsumService.accounting(req.params.id), res);
});

sponsumRouter.post("/receivables/:id/bitcredit", (req, res) => {
  handle(() => sponsumService.wrapBitcredit(req.params.id, Boolean(req.body?.enabled)), res);
});

sponsumRouter.post("/receivables/:id/register-right", (req, res) => {
  handle(() => sponsumService.wrapRegisterRight(req.params.id, Boolean(req.body?.enabled)), res);
});

sponsumRouter.post("/kyc/:partyId", (req, res) => {
  handle(() => {
    sponsumService.setKyc(req.params.partyId, req.body.status ?? "PASSED");
    return { ok: true, party_id: req.params.partyId, status: req.body.status ?? "PASSED" };
  }, res);
});
