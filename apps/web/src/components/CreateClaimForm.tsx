"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CORE_TEMPLATES, InstrumentType, SettlementModel } from "@sponsum/shared";
import { getApiBaseUrl, getStoredSession, subscribeToAuthChanges } from "@/lib/auth";

type CreateClaimFormProps = {
  initialTemplateId?: string;
};

export function CreateClaimForm({ initialTemplateId }: CreateClaimFormProps) {
  const initialTemplate = CORE_TEMPLATES.find((tpl) => tpl.id === initialTemplateId) ?? CORE_TEMPLATES[0];
  const [templateId, setTemplateId] = useState(initialTemplate.id);
  const [title, setTitle] = useState(`${initialTemplate.title} Example`);
  const [amount, setAmount] = useState(10000);
  const [currency, setCurrency] = useState("CHF");
  const [maturityDate, setMaturityDate] = useState("2027-06-01");
  const [issuerName, setIssuerName] = useState("Issuer");
  const [debtorName, setDebtorName] = useState("Debtor");
  const [status, setStatus] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const template = useMemo(() => CORE_TEMPLATES.find((item) => item.id === templateId) ?? CORE_TEMPLATES[0], [templateId]);

  useEffect(() => {
    if (!initialTemplateId) {
      return;
    }
    const templateFromWizard = CORE_TEMPLATES.find((tpl) => tpl.id === initialTemplateId);
    if (templateFromWizard) {
      setTemplateId(templateFromWizard.id);
      setTitle(`${templateFromWizard.title} Example`);
    }
  }, [initialTemplateId]);

  useEffect(() => {
    const refreshAuth = () => {
      setIsAuthenticated(Boolean(getStoredSession()?.token));
    };

    refreshAuth();
    return subscribeToAuthChanges(refreshAuth);
  }, []);

  const humanSummary = useMemo(() => {
    return `This claim represents a payment obligation of ${amount} ${currency} due on ${maturityDate}. If payment fails, settlement events, optional guarantor/collateral triggers, and dispute flow apply.`;
  }, [amount, currency, maturityDate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    try {
      const session = getStoredSession();

      if (!session?.token) {
        setStatus("Please login first. Creating claims requires authentication.");
        return;
      }

      const response = await fetch(`${getApiBaseUrl()}/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          title,
          instrumentType: template.instrumentType as InstrumentType,
          amount,
          currency,
          issueDate: new Date().toISOString(),
          maturityDate: new Date(maturityDate).toISOString(),
          status: "DRAFT",
          settlementModel: (template.settlementDefaults[0] || SettlementModel.SINGLE_MATURITY) as SettlementModel,
          governingLaw: "Swiss OR",
          jurisdiction: "Zurich",
          transferability: "transferable under listed conditions",
          humanSummary,
          parties: [
            { role: "issuer", displayName: issuerName },
            { role: "debtor", displayName: debtorName },
            { role: "creditor", displayName: issuerName }
          ]
        })
      });

      if (!response.ok) throw new Error("Create failed");
      const data = await response.json();
      setStatus(`Created claim ${data.id}`);
    } catch {
      setStatus("Failed to create claim. Please check login state and API availability.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
      <div style={{ border: "1px solid #d7dce4", borderRadius: 10, padding: 10, background: "#fff" }}>
        <strong>Template</strong>
        <p style={{ marginBottom: 0, color: "#475569" }}>{template.title}</p>
      </div>
      {!isAuthenticated ? (
        <p style={{ margin: 0, color: "#b91c1c" }}>
          You must{" "}
          <Link href="/auth/login" style={{ textDecoration: "underline" }}>
            login
          </Link>{" "}
          before creating a claim.
        </p>
      ) : null}
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid grid-2">
        <label>
          Amount
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </label>
        <label>
          Currency
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </label>
      </div>
      <label>
        Maturity Date
        <input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
      </label>
      <div className="grid grid-2">
        <label>
          Issuer Label
          <input value={issuerName} onChange={(e) => setIssuerName(e.target.value)} />
        </label>
        <label>
          Debtor Label
          <input value={debtorName} onChange={(e) => setDebtorName(e.target.value)} />
        </label>
      </div>

      <div style={{ border: "1px solid #d7dce4", borderRadius: 10, padding: 10, background: "#fff" }}>
        <strong>Human-readable summary preview</strong>
        <p style={{ color: "#475569" }}>{humanSummary}</p>
      </div>

      <button type="submit" disabled={!isAuthenticated}>
        Save Draft Claim
      </button>
      {status ? <p style={{ color: "#334155" }}>{status}</p> : null}
    </form>
  );
}
