"use client";

import { useMemo, useState } from "react";
import { apiPost } from "../../lib/api";

type Receivable = {
  receivable_id: string;
  status: string;
  verification_score: number;
  nominal_amount: string;
  currency: string;
  maturity_date: string;
};

type Liquidity = {
  offer: { offer_id: string };
  quotes: Array<{ buyer: string; amount: string }>;
};

type TradeBundle = {
  trade: { trade_id: string; status: string; purchase_price: string; nominal_amount: string };
  instruction: {
    payee_iban: string;
    payment_reference: string;
    amount: string;
    currency: string;
    status: string;
  } | null;
};

const SELLER = "seller-ui";

export function InvoiceSponsumPanel({ invoiceId }: { invoiceId: string }) {
  const [asset, setAsset] = useState<Receivable | null>(null);
  const [quotes, setQuotes] = useState<Liquidity["quotes"]>([]);
  const [settlement, setSettlement] = useState<TradeBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const best = useMemo(() => {
    if (quotes.length === 0) return null;
    return quotes.reduce((lead, quote) => (Number(quote.amount) > Number(lead.amount) ? quote : lead));
  }, [quotes]);

  async function createFromInvoice() {
    setError(null);
    setBusy(true);
    try {
      const created = await apiPost<Receivable>("/api/sponsum/v1/receivables", {
        invoice_id: invoiceId,
        nominal_amount: "50000",
        issue_date: new Date().toISOString().slice(0, 10),
        maturity_date: new Date(Date.now() + 67 * 86400000).toISOString().slice(0, 10),
        creditor_party_id: SELLER,
        debtor_party_id: "debtor-ui",
        evidence: { hasInvoice: true, unpaid: true, hasDispute: false, hasContract: true }
      });
      setAsset(created);
      setQuotes([]);
      setSettlement(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  async function getLiquidity() {
    if (!asset) return;
    setError(null);
    setBusy(true);
    try {
      const result = await apiPost<Liquidity>(`/api/sponsum/v1/receivables/${asset.receivable_id}/liquidity`, {
        seller_party_id: SELLER
      });
      setQuotes(result.quotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "liquidity failed");
    } finally {
      setBusy(false);
    }
  }

  async function acceptBest() {
    if (!asset || !best) return;
    setError(null);
    setBusy(true);
    try {
      const result = await apiPost<TradeBundle>(`/api/sponsum/v1/receivables/${asset.receivable_id}/liquidity/accept`, {
        seller_party_id: SELLER,
        buyer_party_id: best.buyer,
        amount: best.amount
      });
      setSettlement(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "accept failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sponsum-invoice-panel" data-testid="sponsum-invoice-actions">
      <header>
        <h3>Invoice {invoiceId}</h3>
        {asset ? (
          <p data-testid="sponsum-asset-status">
            Status: {asset.status} · Verification: {asset.verification_score}/100 · {asset.currency}{" "}
            {asset.nominal_amount} · Due {asset.maturity_date}
          </p>
        ) : (
          <p data-testid="sponsum-empty">Noch kein ReceivableAsset.</p>
        )}
      </header>
      <div className="sponsum-actions">
        <button type="button" data-testid="sponsum-wait" onClick={createFromInvoice} disabled={busy}>
          Wait for payment
        </button>
        <button type="button" data-testid="sponsum-liquidity" onClick={getLiquidity} disabled={!asset || busy}>
          Get liquidity
        </button>
        <button type="button" data-testid="sponsum-sell" onClick={getLiquidity} disabled={!asset || busy}>
          Sell receivable
        </button>
        <a href="/sponsum/portfolio" data-testid="sponsum-open">
          Open Sponsum
        </a>
      </div>
      <p className="muted" data-testid="sponsum-settlement-readonly">
        Zahlung nur über externen PSP — kein «bezahlt»-Klick.
      </p>
      {quotes.length > 0 && (
        <div className="sponsum-quotes" data-testid="sponsum-quotes">
          <h4>Available offers</h4>
          <ul>
            {quotes.map((quote) => (
              <li key={quote.buyer} data-testid={`sponsum-quote-${quote.buyer}`}>
                {quote.buyer} {quote.amount}
              </li>
            ))}
          </ul>
          {best && (
            <p data-testid="sponsum-best-offer">
              Best offer: {best.buyer} CHF {best.amount}
            </p>
          )}
          <button type="button" data-testid="sponsum-accept-best" onClick={acceptBest} disabled={!best || busy || Boolean(settlement)}>
            Accept
          </button>
        </div>
      )}
      {settlement?.instruction && (
        <div className="sponsum-settlement" data-testid="sponsum-settlement-status">
          <p>Trade {settlement.trade.status}</p>
          <p>
            Zahle {settlement.instruction.currency} {settlement.instruction.amount} an {settlement.instruction.payee_iban}
          </p>
          <p>Referenz {settlement.instruction.payment_reference}</p>
          <p>Instruction {settlement.instruction.status}</p>
        </div>
      )}
      {error && (
        <p className="error" data-testid="sponsum-error">
          {error}
        </p>
      )}
    </section>
  );
}
