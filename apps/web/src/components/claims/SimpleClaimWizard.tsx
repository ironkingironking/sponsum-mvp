"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClaimStatus, InstrumentType, SettlementModel } from "@sponsum/shared";
import { getApiBaseUrl, getStoredSession, subscribeToAuthChanges } from "@/lib/auth";

type ClaimTypeOption = "invoice" | "bill_of_exchange" | "tax_refund" | "future_payment" | "other";

const claimTypeToInstrument: Record<ClaimTypeOption, InstrumentType> = {
  invoice: InstrumentType.INVOICE_SALE,
  bill_of_exchange: InstrumentType.BILL_OF_EXCHANGE,
  tax_refund: InstrumentType.ASSIGNABLE_RECEIVABLE,
  future_payment: InstrumentType.PROMISSORY_NOTE,
  other: InstrumentType.CUSTOM_PRIVATE_LAW
};

type SimpleClaimWizardProps = {
  onCreated?: (claimId: string) => void;
};

export function SimpleClaimWizard({ onCreated }: SimpleClaimWizardProps) {
  // UX decision: one decision group per step keeps cognitive load low for first-time users.
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [title, setTitle] = useState("Invoice claim");
  const [description, setDescription] = useState("Payment claim for delivered services.");
  const [amount, setAmount] = useState(12000);
  const [currency, setCurrency] = useState("CHF");

  const [debtor, setDebtor] = useState("Debtor Ltd");
  const [dueDate, setDueDate] = useState("2026-09-30");
  const [claimType, setClaimType] = useState<ClaimTypeOption>("invoice");

  const [collateral, setCollateral] = useState("None");
  const [guarantor, setGuarantor] = useState("");
  const [smartContract, setSmartContract] = useState(false);

  useEffect(() => {
    const refreshAuth = () => setIsAuthenticated(Boolean(getStoredSession()?.token));
    refreshAuth();
    return subscribeToAuthChanges(refreshAuth);
  }, []);

  const summary = useMemo(() => {
    const securityText = collateral === "None" && !guarantor ? "unsecured" : "partially secured";
    const smartContractText = smartContract ? "Smart contract: enabled." : "Smart contract: not enabled.";

    return `${description} Debtor: ${debtor}. Amount: ${amount} ${currency.toUpperCase()} due on ${dueDate}. Security: ${securityText}. ${smartContractText}`;
  }, [description, debtor, amount, currency, dueDate, collateral, guarantor, smartContract]);

  function nextStep() {
    if (step === 1 && (!title.trim() || amount <= 0 || currency.trim().length !== 3)) {
      setStatusMessage("Please complete title, amount and a 3-letter currency.");
      return;
    }
    if (step === 2 && (!debtor.trim() || !dueDate)) {
      setStatusMessage("Please complete debtor and due date.");
      return;
    }

    setStatusMessage(null);
    setStep((current) => Math.min(4, current + 1));
  }

  function previousStep() {
    setStatusMessage(null);
    setStep((current) => Math.max(1, current - 1));
  }

  async function submitClaim() {
    const session = getStoredSession();

    if (!session?.token) {
      setStatusMessage("Please login first. Creating a claim requires authentication.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage(null);

      const response = await fetch(`${getApiBaseUrl()}/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          title,
          instrumentType: claimTypeToInstrument[claimType],
          amount,
          currency: currency.toUpperCase(),
          issueDate: new Date().toISOString(),
          maturityDate: new Date(dueDate).toISOString(),
          status: ClaimStatus.DRAFT,
          settlementModel: SettlementModel.SINGLE_MATURITY,
          governingLaw: "Swiss OR",
          jurisdiction: "Zurich",
          transferability: "Transfer allowed with platform checks",
          humanSummary: summary,
          parties: [
            { role: "issuer", displayName: session.user.fullName },
            { role: "debtor", displayName: debtor },
            { role: "creditor", displayName: session.user.fullName }
          ]
        })
      });

      if (!response.ok) {
        throw new Error("Create claim request failed");
      }

      const created = (await response.json()) as { id: string };
      setStatusMessage(`Claim created successfully: ${created.id}`);
      onCreated?.(created.id);
    } catch {
      setStatusMessage("Could not create claim. Please verify API and login state.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-widget-card">
      <div className="wizard-steps wizard-steps-4">
        <div className={step === 1 ? "wizard-step active" : "wizard-step"}>1. Basic Info</div>
        <div className={step === 2 ? "wizard-step active" : "wizard-step"}>2. Claim Details</div>
        <div className={step === 3 ? "wizard-step active" : "wizard-step"}>3. Security</div>
        <div className={step === 4 ? "wizard-step active" : "wizard-step"}>4. Review</div>
      </div>

      {!isAuthenticated ? (
        <div className="dashboard-empty-state">
          <h3>Login required</h3>
          <p>You need an account session before publishing a claim.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/auth/login">
              <button type="button">Login</button>
            </Link>
            <Link href="/auth/register">
              <button type="button" className="ghost">
                Register
              </button>
            </Link>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid">
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Invoice claim – IT services" />
          </label>
          <label>
            Description
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="grid grid-2">
            <label>
              Amount
              <input type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            </label>
            <label>
              Currency
              <input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </label>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid">
          <label>
            Debtor
            <input value={debtor} onChange={(event) => setDebtor(event.target.value)} />
          </label>
          <div className="grid grid-2">
            <label>
              Due date
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label>
              Type
              <select value={claimType} onChange={(event) => setClaimType(event.target.value as ClaimTypeOption)}>
                <option value="invoice">Invoice</option>
                <option value="bill_of_exchange">Bill of exchange</option>
                <option value="tax_refund">Tax refund</option>
                <option value="future_payment">Future payment</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid">
          <label>
            Collateral
            <input value={collateral} onChange={(event) => setCollateral(event.target.value)} placeholder="None / Asset pledge / Inventory lien" />
          </label>
          <label>
            Guarantor
            <input value={guarantor} onChange={(event) => setGuarantor(event.target.value)} placeholder="Optional guarantor name" />
          </label>
          <label className="inline-control">
            <input type="checkbox" checked={smartContract} onChange={(event) => setSmartContract(event.target.checked)} />
            Enable optional smart contract tracking
          </label>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid">
          <div className="claim-link-card">
            <strong>Preview</strong>
            <p>{summary}</p>
          </div>
          <div className="claim-expected-actual">
            <div>
              <strong>Claim</strong>
              <pre>{JSON.stringify({ title, amount, currency, dueDate, claimType }, null, 2)}</pre>
            </div>
            <div>
              <strong>Security</strong>
              <pre>{JSON.stringify({ collateral, guarantor, smartContract }, null, 2)}</pre>
            </div>
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <p style={{ margin: 0, color: statusMessage.toLowerCase().includes("success") ? "#166534" : "#b91c1c" }}>{statusMessage}</p>
      ) : null}

      <div className="instrument-actions">
        <button type="button" onClick={previousStep} disabled={step === 1 || isSubmitting}>
          Back
        </button>
        {step < 4 ? (
          <button type="button" onClick={nextStep} disabled={isSubmitting}>
            Next step
          </button>
        ) : (
          <button type="button" onClick={submitClaim} disabled={!isAuthenticated || isSubmitting}>
            {isSubmitting ? "Creating..." : "Create claim"}
          </button>
        )}
      </div>
    </div>
  );
}

