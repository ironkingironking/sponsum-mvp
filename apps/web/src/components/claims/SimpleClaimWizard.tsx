"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClaimStatus, InstrumentType, SettlementModel } from "@sponsum/shared";
import { getApiBaseUrl, getStoredSession, subscribeToAuthChanges } from "@/lib/auth";

type InstrumentKey =
  | "invoice_receivable"
  | "bill_of_exchange"
  | "promissory_note"
  | "tax_refund_claim"
  | "future_payment_claim"
  | "land_backed_debt"
  | "profit_participation"
  | "trade_finance_participation"
  | "other_claim";

type InstrumentFieldType = "text" | "textarea" | "date" | "number" | "upload" | "select";

type InstrumentField = {
  id: string;
  label: string;
  type: InstrumentFieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
};

type InstrumentConfig = {
  key: InstrumentKey;
  label: string;
  description: string;
  instrumentType: InstrumentType;
  settlementModel: SettlementModel;
  debtorFieldId: string;
  dueDateFieldId: string;
  issueDateFieldId?: string;
  fields: InstrumentField[];
};

const INSTRUMENT_CONFIGS: InstrumentConfig[] = [
  {
    key: "invoice_receivable",
    label: "Invoice / Accounts Receivable",
    description: "Sell a claim from an issued invoice.",
    instrumentType: InstrumentType.INVOICE_SALE,
    settlementModel: SettlementModel.SINGLE_MATURITY,
    debtorFieldId: "invoice_debtor",
    dueDateFieldId: "invoice_due_date",
    issueDateFieldId: "invoice_date",
    fields: [
      { id: "invoice_debtor", label: "Debtor", type: "text", required: true, placeholder: "Debtor company name" },
      { id: "invoice_date", label: "Invoice date", type: "date", required: true },
      { id: "invoice_due_date", label: "Due date", type: "date", required: true },
      {
        id: "invoice_supporting_document",
        label: "Supporting document upload",
        type: "upload",
        required: true,
        helpText: "Upload reference only in MVP. The file name is added to your claim summary."
      }
    ]
  },
  {
    key: "bill_of_exchange",
    label: "Bill of Exchange",
    description: "Structured trade claim with drawer, drawee and payee.",
    instrumentType: InstrumentType.BILL_OF_EXCHANGE,
    settlementModel: SettlementModel.SINGLE_MATURITY,
    debtorFieldId: "bill_drawee",
    dueDateFieldId: "bill_maturity_date",
    issueDateFieldId: "bill_issue_date",
    fields: [
      { id: "bill_drawer", label: "Drawer", type: "text", required: true, placeholder: "Who issues the bill" },
      { id: "bill_drawee", label: "Drawee", type: "text", required: true, placeholder: "Who must pay" },
      { id: "bill_payee", label: "Payee", type: "text", required: true, placeholder: "Who receives payment" },
      { id: "bill_issue_date", label: "Issue date", type: "date", required: true },
      { id: "bill_maturity_date", label: "Maturity date", type: "date", required: true }
    ]
  },
  {
    key: "promissory_note",
    label: "Promissory Note",
    description: "Direct payment promise with maturity and interest.",
    instrumentType: InstrumentType.PROMISSORY_NOTE,
    settlementModel: SettlementModel.SINGLE_MATURITY,
    debtorFieldId: "note_issuer",
    dueDateFieldId: "note_due_date",
    fields: [
      { id: "note_issuer", label: "Issuer", type: "text", required: true, placeholder: "Who promises to pay" },
      { id: "note_beneficiary", label: "Beneficiary", type: "text", required: true, placeholder: "Who receives payment" },
      { id: "note_due_date", label: "Due date", type: "date", required: true },
      { id: "note_interest_rate", label: "Interest rate (%)", type: "number", placeholder: "4.5", required: true }
    ]
  },
  {
    key: "tax_refund_claim",
    label: "Tax Refund Claim",
    description: "Expected claim against a tax authority.",
    instrumentType: InstrumentType.ASSIGNABLE_RECEIVABLE,
    settlementModel: SettlementModel.SINGLE_MATURITY,
    debtorFieldId: "tax_authority",
    dueDateFieldId: "tax_expected_payment_date",
    fields: [
      { id: "tax_authority", label: "Tax authority", type: "text", required: true, placeholder: "Tax office name" },
      { id: "tax_year", label: "Tax year", type: "number", required: true, placeholder: "2025" },
      { id: "tax_expected_refund_amount", label: "Expected refund amount", type: "number", required: true, placeholder: "8500" },
      { id: "tax_expected_payment_date", label: "Expected payment date", type: "date", required: true }
    ]
  },
  {
    key: "future_payment_claim",
    label: "Future Payment Claim",
    description: "Trade future contractual receivables.",
    instrumentType: InstrumentType.ASSIGNABLE_RECEIVABLE,
    settlementModel: SettlementModel.SINGLE_MATURITY,
    debtorFieldId: "future_payment_source",
    dueDateFieldId: "future_expected_date",
    fields: [
      { id: "future_payment_source", label: "Payment source", type: "text", required: true, placeholder: "Client contract or payer" },
      { id: "future_expected_date", label: "Expected date", type: "date", required: true },
      {
        id: "future_supporting_documentation",
        label: "Supporting documentation",
        type: "upload",
        required: true,
        helpText: "Use agreements or delivery proofs as evidence."
      }
    ]
  },
  {
    key: "land_backed_debt",
    label: "Land-backed Debt (Gült)",
    description: "Secured claim linked to real-estate collateral.",
    instrumentType: InstrumentType.ANNUITY_GUELT,
    settlementModel: SettlementModel.ANNUITY,
    debtorFieldId: "guelt_land_owner",
    dueDateFieldId: "guelt_next_payment_date",
    fields: [
      { id: "guelt_land_owner", label: "Land owner (debtor)", type: "text", required: true, placeholder: "Owner / payer" },
      { id: "guelt_property_description", label: "Property description", type: "textarea", required: true, placeholder: "Property and location details" },
      { id: "guelt_land_registry_reference", label: "Land registry reference", type: "text", required: true, placeholder: "Registry ID" },
      { id: "guelt_collateral_value", label: "Collateral value", type: "number", required: true, placeholder: "150000" },
      {
        id: "guelt_priority_rank",
        label: "Priority rank",
        type: "select",
        required: true,
        options: ["1st priority", "2nd priority", "3rd priority"]
      },
      { id: "guelt_next_payment_date", label: "Next payment date", type: "date", required: true }
    ]
  },
  {
    key: "profit_participation",
    label: "Profit Participation (Kommenda)",
    description: "Investment with expected profit share.",
    instrumentType: InstrumentType.VENTURE_FINANCING,
    settlementModel: SettlementModel.PROFIT_SHARE,
    debtorFieldId: "kommenda_operating_partner",
    dueDateFieldId: "kommenda_settlement_date",
    fields: [
      { id: "kommenda_operating_partner", label: "Operating partner", type: "text", required: true, placeholder: "Venture operator" },
      { id: "kommenda_venture_description", label: "Venture description", type: "textarea", required: true, placeholder: "Business and market focus" },
      { id: "kommenda_expected_profit_share", label: "Expected profit share (%)", type: "number", required: true, placeholder: "18" },
      { id: "kommenda_investment_duration", label: "Investment duration (months)", type: "number", required: true, placeholder: "12" },
      {
        id: "kommenda_risk_disclosure",
        label: "Risk disclosure",
        type: "textarea",
        required: true,
        placeholder: "Explain key risk factors in plain language"
      },
      { id: "kommenda_settlement_date", label: "Expected settlement date", type: "date", required: true }
    ]
  },
  {
    key: "trade_finance_participation",
    label: "Trade Finance Participation",
    description: "Participate in cross-border trade receivable deals.",
    instrumentType: InstrumentType.COLLATERALIZED_BORROWING,
    settlementModel: SettlementModel.SINGLE_MATURITY,
    debtorFieldId: "trade_finance_importer_debtor",
    dueDateFieldId: "trade_finance_expected_payment_date",
    fields: [
      { id: "trade_finance_importer_debtor", label: "Importer / debtor", type: "text", required: true, placeholder: "Importer company" },
      {
        id: "trade_finance_underlying_transaction",
        label: "Underlying trade transaction",
        type: "textarea",
        required: true,
        placeholder: "Contract reference and shipment summary"
      },
      { id: "trade_finance_goods_description", label: "Goods description", type: "text", required: true, placeholder: "Goods / service category" },
      { id: "trade_finance_expected_payment_date", label: "Expected payment date", type: "date", required: true }
    ]
  },
  {
    key: "other_claim",
    label: "Other Claim",
    description: "Custom claim structure for special agreements.",
    instrumentType: InstrumentType.CUSTOM_PRIVATE_LAW,
    settlementModel: SettlementModel.CONDITIONAL,
    debtorFieldId: "other_debtor",
    dueDateFieldId: "other_due_date",
    fields: [
      { id: "other_debtor", label: "Debtor", type: "text", required: true, placeholder: "Who is expected to pay" },
      { id: "other_due_date", label: "Expected due date", type: "date", required: true },
      { id: "other_custom_notes", label: "Claim details", type: "textarea", required: true, placeholder: "Explain the claim in plain language" }
    ]
  }
];

function buildInitialInstrumentValues(): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const config of INSTRUMENT_CONFIGS) {
    for (const field of config.fields) {
      initial[field.id] = "";
    }
  }
  return initial;
}

function parseAmount(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function deriveSecurityLevel(collateral: string, guarantor: string, pledge: string): "secured" | "partially secured" | "unsecured" {
  const hasCollateral = collateral.trim().length > 0;
  const hasGuarantor = guarantor.trim().length > 0;
  const hasPledge = pledge.trim().length > 0;
  const score = Number(hasCollateral) + Number(hasGuarantor) + Number(hasPledge);
  if (score >= 2) return "secured";
  if (score === 1) return "partially secured";
  return "unsecured";
}

function formatFieldSummary(field: InstrumentField, value: string): string {
  if (!value) return `${field.label}: not provided`;
  return `${field.label}: ${value}`;
}

type SimpleClaimWizardProps = {
  onCreated?: (claimId: string) => void;
};

export function SimpleClaimWizard({ onCreated }: SimpleClaimWizardProps) {
  // UX decision: one focused decision group per step keeps cognitive load low for first-time users.
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [title, setTitle] = useState("Invoice claim");
  const [description, setDescription] = useState("Payment claim for delivered services.");
  const [amount, setAmount] = useState("12000");
  const [currency, setCurrency] = useState("CHF");

  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<InstrumentKey>("invoice_receivable");
  const [instrumentValues, setInstrumentValues] = useState<Record<string, string>>(() => buildInitialInstrumentValues());

  const [collateral, setCollateral] = useState("");
  const [guarantor, setGuarantor] = useState("");
  const [pledge, setPledge] = useState("");
  const [securityDocumentName, setSecurityDocumentName] = useState("");
  const [settlementMode, setSettlementMode] = useState<"off_chain" | "smart_contract">("off_chain");

  useEffect(() => {
    const refreshAuth = () => setIsAuthenticated(Boolean(getStoredSession()?.token));
    refreshAuth();
    return subscribeToAuthChanges(refreshAuth);
  }, []);

  const selectedInstrument = useMemo(
    () => INSTRUMENT_CONFIGS.find((entry) => entry.key === selectedInstrumentKey) || INSTRUMENT_CONFIGS[0],
    [selectedInstrumentKey]
  );

  const securityLevel = useMemo(
    () => deriveSecurityLevel(collateral, guarantor, pledge),
    [collateral, guarantor, pledge]
  );

  const dueDate = instrumentValues[selectedInstrument.dueDateFieldId];
  const issueDateValue = selectedInstrument.issueDateFieldId ? instrumentValues[selectedInstrument.issueDateFieldId] : "";
  const debtor = instrumentValues[selectedInstrument.debtorFieldId] || "Debtor TBD";

  const instrumentSummary = useMemo(
    () =>
      selectedInstrument.fields.map((field) => ({
        label: field.label,
        value: instrumentValues[field.id] || "not provided"
      })),
    [selectedInstrument.fields, instrumentValues]
  );

  const summary = useMemo(() => {
    const details = selectedInstrument.fields
      .map((field) => formatFieldSummary(field, instrumentValues[field.id]))
      .join(" | ");

    return `${description} Instrument: ${selectedInstrument.label}. Amount: ${parseAmount(amount)} ${currency.toUpperCase()}. ${details}. Security: ${securityLevel}. Settlement: ${settlementMode === "smart_contract" ? "smart contract enabled" : "standard off-chain settlement"}.`;
  }, [description, selectedInstrument, instrumentValues, amount, currency, securityLevel, settlementMode]);

  function setInstrumentFieldValue(fieldId: string, value: string) {
    setInstrumentValues((current) => ({
      ...current,
      [fieldId]: value
    }));
  }

  function validateStep(currentStep: number): string | null {
    if (currentStep === 1) {
      if (!title.trim()) return "Please enter a claim title.";
      if (!description.trim()) return "Please enter a short claim description.";
      if (parseAmount(amount) <= 0) return "Please enter a valid claim amount.";
      if (currency.trim().length !== 3) return "Please use a 3-letter currency (for example CHF or EUR).";
      return null;
    }

    if (currentStep === 2) {
      for (const field of selectedInstrument.fields) {
        if (field.required && !instrumentValues[field.id]?.trim()) {
          return `Please complete: ${field.label}.`;
        }
      }
      return null;
    }

    return null;
  }

  function nextStep() {
    const errorMessage = validateStep(step);
    if (errorMessage) {
      setStatusMessage(errorMessage);
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

    if (!dueDate) {
      setStatusMessage("Please provide an expected due date in instrument details.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage(null);

      const normalizedAmount = parseAmount(amount);
      const parsedDueDate = new Date(dueDate);
      const parsedIssueDate = issueDateValue ? new Date(issueDateValue) : new Date();
      const issueDate = Number.isNaN(parsedIssueDate.getTime()) ? new Date() : parsedIssueDate;
      const maturityDate = Number.isNaN(parsedDueDate.getTime()) ? new Date() : parsedDueDate;

      const response = await fetch(`${getApiBaseUrl()}/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          title,
          instrumentType: selectedInstrument.instrumentType,
          amount: normalizedAmount,
          currency: currency.toUpperCase(),
          issueDate: issueDate.toISOString(),
          maturityDate: maturityDate.toISOString(),
          status: ClaimStatus.DRAFT,
          settlementModel: selectedInstrument.settlementModel,
          governingLaw: "Swiss contract law",
          jurisdiction: "Zurich",
          transferability: "Transfer allowed with platform checks",
          humanSummary: summary,
          parties: [
            { role: "issuer", displayName: session.user.fullName },
            { role: "debtor", displayName: debtor },
            { role: "beneficiary", displayName: session.user.fullName }
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
        <div className={step === 1 ? "wizard-step active" : "wizard-step"}>1. Basic Information</div>
        <div className={step === 2 ? "wizard-step active" : "wizard-step"}>2. Instrument Details</div>
        <div className={step === 3 ? "wizard-step active" : "wizard-step"}>3. Security</div>
        <div className={step === 4 ? "wizard-step active" : "wizard-step"}>4. Review & Publish</div>
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
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Invoice claim - IT services" />
          </label>
          <label>
            Description
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="grid grid-2">
            <label>
              Claim amount
              <input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
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
          <div>
            <strong>Select instrument type</strong>
            <p className="dashboard-muted" style={{ marginTop: 6 }}>
              Pick one structure, then fill only the fields relevant for that instrument.
            </p>
          </div>

          <div className="instrument-option-grid">
            {INSTRUMENT_CONFIGS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={selectedInstrumentKey === option.key ? "instrument-option-card active" : "instrument-option-card"}
                onClick={() => setSelectedInstrumentKey(option.key)}
              >
                <strong>{option.label}</strong>
                <p>{option.description}</p>
              </button>
            ))}
          </div>

          <div className="grid">
            {selectedInstrument.fields.map((field) => {
              const fieldValue = instrumentValues[field.id] || "";

              if (field.type === "textarea") {
                return (
                  <label key={field.id}>
                    {field.label}
                    <textarea
                      rows={3}
                      value={fieldValue}
                      onChange={(event) => setInstrumentFieldValue(field.id, event.target.value)}
                      placeholder={field.placeholder}
                    />
                    {field.helpText ? <span className="field-help">{field.helpText}</span> : null}
                  </label>
                );
              }

              if (field.type === "select") {
                return (
                  <label key={field.id}>
                    {field.label}
                    <select value={fieldValue} onChange={(event) => setInstrumentFieldValue(field.id, event.target.value)}>
                      <option value="">Select an option</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {field.helpText ? <span className="field-help">{field.helpText}</span> : null}
                  </label>
                );
              }

              if (field.type === "upload") {
                return (
                  <label key={field.id}>
                    {field.label}
                    <input
                      type="file"
                      onChange={(event) => setInstrumentFieldValue(field.id, event.target.files?.[0]?.name || "")}
                    />
                    {fieldValue ? <span className="field-help">Selected file: {fieldValue}</span> : null}
                    {field.helpText ? <span className="field-help">{field.helpText}</span> : null}
                  </label>
                );
              }

              return (
                <label key={field.id}>
                  {field.label}
                  <input
                    type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                    value={fieldValue}
                    onChange={(event) => setInstrumentFieldValue(field.id, event.target.value)}
                    placeholder={field.placeholder}
                  />
                  {field.helpText ? <span className="field-help">{field.helpText}</span> : null}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid">
          <label>
            Collateral
            <input value={collateral} onChange={(event) => setCollateral(event.target.value)} placeholder="Asset details (optional)" />
          </label>
          <label>
            Guarantor
            <input value={guarantor} onChange={(event) => setGuarantor(event.target.value)} placeholder="Optional guarantor name" />
          </label>

          <label>
            Pledge
            <input value={pledge} onChange={(event) => setPledge(event.target.value)} placeholder="Optional pledge details" />
          </label>

          <label>
            Document upload
            <input type="file" onChange={(event) => setSecurityDocumentName(event.target.files?.[0]?.name || "")} />
            {securityDocumentName ? <span className="field-help">Selected file: {securityDocumentName}</span> : null}
          </label>

          <div className="grid">
            <strong>Settlement mode</strong>
            <label className="inline-control">
              <input
                type="radio"
                name="settlement-mode"
                checked={settlementMode === "off_chain"}
                onChange={() => setSettlementMode("off_chain")}
              />
              Standard settlement
            </label>
            <label className="inline-control">
              <input
                type="radio"
                name="settlement-mode"
                checked={settlementMode === "smart_contract"}
                onChange={() => setSettlementMode("smart_contract")}
              />
              Optional smart contract settlement
            </label>
          </div>

          <label className="inline-control">
            <span>Security level:</span>
            <strong>{securityLevel}</strong>
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
              <strong>Basic information</strong>
              <pre>{JSON.stringify({ title, description, amount: parseAmount(amount), currency: currency.toUpperCase() }, null, 2)}</pre>
            </div>
            <div>
              <strong>Instrument details</strong>
              <pre>{JSON.stringify({ instrument: selectedInstrument.label, details: instrumentSummary }, null, 2)}</pre>
            </div>
          </div>

          <div className="claim-expected-actual">
            <div>
              <strong>Security</strong>
              <pre>{JSON.stringify({ collateral, guarantor, pledge, securityDocumentName, securityLevel }, null, 2)}</pre>
            </div>
            <div>
              <strong>Settlement</strong>
              <pre>{JSON.stringify({ mode: settlementMode, dueDate: dueDate || "not provided", debtor }, null, 2)}</pre>
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
