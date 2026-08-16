import { Router } from "express";
import { DomainError } from "@sponsum/shared";
import { sponsumService } from "./service.js";

export const sponsumRouter = Router();

function handle(run: () => unknown, res: import("express").Response): void {
  try {
    const body = run();
    if (body && typeof (body as Promise<unknown>).then === "function") {
      (body as Promise<unknown>)
        .then((value) => res.json(value))
        .catch((error) => {
          if (error instanceof DomainError) {
            res.status(409).json({ error: { code: error.code, message: error.message } });
            return;
          }
          throw error;
        });
      return;
    }
    res.json(body);
  } catch (error) {
    if (error instanceof DomainError) {
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "forbidden" || error.code === "kyc_required"
            ? 403
            : error.code === "policy_denied" || error.code === "skribble_quality_downgraded"
              ? 403
              : error.code === "skribble_not_configured" || error.code === "skribble_unreachable"
                ? 503
                : 409;
      res.status(status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
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

sponsumRouter.get("/disputes", (_req, res) => {
  handle(() => sponsumService.listDisputes(), res);
});

sponsumRouter.get("/disputes/:id", (req, res) => {
  handle(() => sponsumService.disputeDossier(req.params.id), res);
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
      sponsumService.createAssignment({
        receivable_id: String(req.body.receivable_id),
        seller_party_id: String(req.body.seller_party_id ?? "seller-ui"),
        buyer_party_id: String(req.body.buyer_party_id),
        purchase_price: String(req.body.purchase_price),
        factoring_mode: req.body.factoring_mode,
        notice_mode: req.body.notice_mode,
        payee_iban: req.body.payee_iban
      }),
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
  handle(() => sponsumService.createReceivable(req.body), res);
});

sponsumRouter.get("/receivables/:id", (req, res) => {
  handle(() => sponsumService.getReceivable(req.params.id), res);
});

sponsumRouter.get("/receivables/:id/dossier", (req, res) => {
  handle(() => sponsumService.dossier(req.params.id), res);
});

sponsumRouter.post("/receivables/:id/verify", (req, res) => {
  handle(() => sponsumService.verify(req.params.id, req.body ?? {}), res);
});

sponsumRouter.post("/receivables/:id/disputes", (req, res) => {
  handle(() => sponsumService.openDispute(req.params.id, String(req.body?.disputed_amount ?? "0"), req.body?.resolve_case_id), res);
});

sponsumRouter.post("/receivables/:id/offers", (req, res) => {
  handle(() => sponsumService.createOffer(req.params.id, req.body), res);
});

sponsumRouter.post("/receivables/:id/liquidity", (req, res) => {
  handle(() => sponsumService.requestLiquidity(req.params.id, req.body.seller_party_id), res);
});

sponsumRouter.post("/receivables/:id/liquidity/accept", (req, res) => {
  handle(
    () =>
      sponsumService.acceptLiquidityQuote(
        req.params.id,
        String(req.body.seller_party_id),
        String(req.body.buyer_party_id),
        String(req.body.amount),
        req.body.payee_iban
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
  handle(() => sponsumService.acceptBid(req.params.id, req.body.seller_party_id, req.body.payee_iban), res);
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
  handle(() => sponsumService.confirmByProvider(req.params.instructionId, String(req.body?.provider ?? "external-psp")), res);
});

sponsumRouter.post("/webhooks/settlement/:provider", (req, res) => {
  handle(
    () =>
      sponsumService.applySettlementWebhook({
        provider: req.params.provider,
        provider_event_id: String(req.body.provider_event_id),
        payment_reference: String(req.body.payment_reference),
        observed_amount: String(req.body.observed_amount),
        observed_currency: String(req.body.observed_currency),
        observed_at: req.body.observed_at,
        signed: req.body.signed !== false
      }),
    res
  );
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
