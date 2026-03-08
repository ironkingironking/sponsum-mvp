"use client";

import { useMemo, useState } from "react";
import {
  attachTargetToClaimDraft,
  claimMockInstrumentContexts,
  createTargetSnapshot,
  getClaimBlueprintsForInstrumentType,
  suggestBlueprintsForTarget,
  type ClaimBlueprint,
  type ClaimEvidenceType,
  type ClaimRemedyType,
  type ClaimSeverity,
  type ClaimStatus,
  type ClaimTargetCandidate,
  type InstrumentContext,
  type StructuredClaim,
  validateStructuredClaim
} from "@/lib/claims";
import { deriveClaimTargetCandidates } from "@/lib/claims/claim-targets";
import { ClaimBlueprintSelector } from "./ClaimBlueprintSelector";
import { ClaimEvidenceSuggestions } from "./ClaimEvidenceSuggestions";
import { ClaimLinkedClauseCard } from "./ClaimLinkedClauseCard";
import { ClaimLinkedDocumentRequirementCard } from "./ClaimLinkedDocumentRequirementCard";
import { ClaimLinkedSettlementCard } from "./ClaimLinkedSettlementCard";
import { ClaimLinkedTemplateFieldCard } from "./ClaimLinkedTemplateFieldCard";
import { ClaimRemedySelector } from "./ClaimRemedySelector";
import { ClaimTargetSelector } from "./ClaimTargetSelector";
import { ClaimTargetSummary } from "./ClaimTargetSummary";

type ClaimCreationWizardProps = {
  onClaimCreated?: (claim: StructuredClaim) => void;
};

const allRemedies: ClaimRemedyType[] = [
  "payment_order",
  "late_fee",
  "specific_performance",
  "recourse",
  "rescission",
  "indemnity",
  "document_cure",
  "declaratory_relief",
  "penalty",
  "escalation",
  "interest_adjustment",
  "termination_option",
  "suspension",
  "damages_claim",
  "custom"
];

const allEvidenceTypes: ClaimEvidenceType[] = [
  "payment_proof",
  "assignment_document",
  "origin_document",
  "warranty_schedule",
  "reporting_statement",
  "contract_extract",
  "signature_page",
  "settlement_log",
  "notice_letter",
  "custom"
];

const steps = [
  "Instrument waehlen",
  "Claim Target waehlen",
  "Blueprint waehlen",
  "Claim ausfuellen",
  "Evidence/Remedies",
  "Review & Submit"
];

function initialContext(): InstrumentContext {
  return claimMockInstrumentContexts[0];
}

export function ClaimCreationWizard({ onClaimCreated }: ClaimCreationWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(initialContext().id);
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(undefined);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | "custom">("custom");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [statement, setStatement] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [status, setStatus] = useState<ClaimStatus>("draft");
  const [severity, setSeverity] = useState<ClaimSeverity>("warning");
  const [selectedRemedies, setSelectedRemedies] = useState<ClaimRemedyType[]>([]);
  const [selectedEvidenceTypes, setSelectedEvidenceTypes] = useState<ClaimEvidenceType[]>([]);
  const [requestedDeadline, setRequestedDeadline] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [createdClaim, setCreatedClaim] = useState<StructuredClaim | null>(null);

  const context = useMemo(
    () => claimMockInstrumentContexts.find((entry) => entry.id === selectedInstrumentId) || initialContext(),
    [selectedInstrumentId]
  );

  const targets = useMemo(() => deriveClaimTargetCandidates(context), [context]);
  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId),
    [targets, selectedTargetId]
  );

  const blueprintsForInstrument = useMemo(
    () => getClaimBlueprintsForInstrumentType(context.template.type),
    [context.template.type]
  );

  const blueprintSuggestions = useMemo(() => {
    if (!selectedTarget) return blueprintsForInstrument;
    return suggestBlueprintsForTarget(selectedTarget, blueprintsForInstrument);
  }, [selectedTarget, blueprintsForInstrument]);

  const selectedBlueprint = useMemo(
    () =>
      selectedBlueprintId === "custom"
        ? undefined
        : blueprintSuggestions.find((entry) => entry.claimBlueprintId === selectedBlueprintId),
    [blueprintSuggestions, selectedBlueprintId]
  );

  function applyBlueprintDefaults(blueprint: ClaimBlueprint | undefined, target: ClaimTargetCandidate | undefined) {
    if (!blueprint) {
      return;
    }

    if (!title) setTitle(blueprint.label);
    if (!summary) setSummary(blueprint.description);
    if (!statement) setStatement(blueprint.description);
    setSeverity(blueprint.severity);
    setSelectedRemedies(blueprint.suggestedRemedies);
    setSelectedEvidenceTypes(blueprint.suggestedEvidenceTypes);

    if (target?.expectedValue !== undefined && blueprint.requiresAmount) {
      if (typeof target.expectedValue === "number") {
        setAmount(String(target.expectedValue));
      } else if (typeof target.expectedValue === "object" && target.expectedValue && "amount" in (target.expectedValue as Record<string, unknown>)) {
        const next = (target.expectedValue as { amount?: number }).amount;
        if (next !== undefined) {
          setAmount(String(next));
        }
      }
    }
  }

  function nextStep() {
    if (step === 2 && !selectedTarget) return;
    if (step === 3 && selectedBlueprintId !== "custom" && !selectedBlueprint) return;
    setStep((current) => Math.min(6, current + 1));
  }

  function previousStep() {
    setStep((current) => Math.max(1, current - 1));
  }

  function buildDraftClaim(): StructuredClaim {
    const base: StructuredClaim = {
      id: `claim-${Date.now()}`,
      instrumentId: context.id,
      claimType: selectedBlueprint?.defaultClaimType || "custom",
      category: selectedBlueprint?.defaultCategory || "custom",
      title: title || selectedBlueprint?.label || "Custom Claim",
      summary: summary || selectedBlueprint?.description || "",
      statementByClaimant: statement || summary || "",
      amountInDispute: amount ? Number(amount) : undefined,
      currency: typeof context.values.waehrung === "string" ? context.values.waehrung : "CHF",
      requestedRemedy: selectedRemedies,
      status,
      severity,
      evidenceTypes: selectedEvidenceTypes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetType: selectedTarget?.targetType || "custom",
      targetValueSnapshot: selectedTarget ? createTargetSnapshot(selectedTarget) : undefined,
      expectedValue: selectedTarget?.expectedValue,
      actualValue: selectedTarget?.actualValue,
      breachDetectedFrom: selectedTarget ? "manual_user_input" : undefined,
      sourceContext: {
        templateType: context.template.type,
        templateVersion: context.template.version,
        templateTitle: context.template.title,
        instrumentTitle: context.title,
        createdAt: new Date().toISOString(),
        actor: "Current User"
      }
    };

    return selectedTarget ? attachTargetToClaimDraft(base, selectedTarget) : base;
  }

  function submitClaim() {
    const draft = buildDraftClaim();
    const validation = validateStructuredClaim(draft, selectedBlueprint);

    if (validationErrors.length) {
      setValidationErrors([]);
    }

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setCreatedClaim(draft);
    onClaimCreated?.(draft);
  }

  return (
    <div className="dashboard-widget-card">
      <div className="dashboard-widget-head">
        <div>
          <h3>Claim Creation Wizard</h3>
          <p>Instrument -> ClaimTarget -> Blueprint -> Evidence -> Snapshot -> Submit</p>
        </div>
      </div>

      <div className="wizard-steps">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          return (
            <div key={label} className={step === stepNumber ? "wizard-step active" : "wizard-step"}>
              {stepNumber}. {label}
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <div className="grid">
          <label>
            Instrument
            <select
              value={selectedInstrumentId}
              onChange={(event) => {
                setSelectedInstrumentId(event.target.value);
                setSelectedTargetId(undefined);
                setSelectedBlueprintId("custom");
              }}
            >
              {claimMockInstrumentContexts.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.title} ({instrument.template.type})
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <ClaimTargetSelector
          targets={targets}
          selectedId={selectedTargetId}
          onSelect={(targetId) => {
            setSelectedTargetId(targetId);
            setSelectedBlueprintId("custom");
          }}
        />
      ) : null}

      {step === 3 ? (
        <ClaimBlueprintSelector
          blueprints={blueprintSuggestions}
          selectedBlueprintId={selectedBlueprintId}
          onSelect={(blueprintId) => {
            setSelectedBlueprintId(blueprintId);
            const nextBlueprint =
              blueprintId === "custom"
                ? undefined
                : blueprintSuggestions.find((entry) => entry.claimBlueprintId === blueprintId);
            applyBlueprintDefaults(nextBlueprint, selectedTarget);
          }}
        />
      ) : null}

      {step === 4 ? (
        <div className="grid">
          <label>
            Titel
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Summary
            <textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <label>
            Statement by claimant
            <textarea rows={4} value={statement} onChange={(event) => setStatement(event.target.value)} />
          </label>
          <div className="grid grid-2">
            <label>
              Amount in dispute
              <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as ClaimStatus)}>
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="under_review">under_review</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
                <option value="resolved">resolved</option>
              </select>
            </label>
          </div>
          <label>
            Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value as ClaimSeverity)}>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label>
            Related deadline (optional)
            <input type="date" value={requestedDeadline} onChange={(event) => setRequestedDeadline(event.target.value)} />
          </label>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="grid grid-2">
          <div>
            <h4>Evidence Suggestions</h4>
            <ClaimEvidenceSuggestions
              selected={selectedEvidenceTypes}
              suggestions={selectedTarget?.suggestedEvidenceTypes || selectedBlueprint?.suggestedEvidenceTypes || allEvidenceTypes}
              onChange={setSelectedEvidenceTypes}
            />
          </div>
          <div>
            <h4>Remedy Suggestions</h4>
            <ClaimRemedySelector
              selected={selectedRemedies}
              options={selectedTarget?.suggestedRemedies || selectedBlueprint?.suggestedRemedies || allRemedies}
              onChange={setSelectedRemedies}
            />
          </div>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="grid">
          <ClaimTargetSummary target={selectedTarget} />
          <ClaimLinkedTemplateFieldCard
            context={context}
            fieldId={selectedTarget?.templateFieldId}
            expectedValue={selectedTarget?.expectedValue}
            actualValue={selectedTarget?.actualValue}
          />
          <ClaimLinkedClauseCard context={context} clauseId={selectedTarget?.clauseBlockId} />
          <ClaimLinkedSettlementCard context={context} settlementEventId={selectedTarget?.settlementEventId} />
          <ClaimLinkedDocumentRequirementCard
            context={context}
            requirementInstanceId={selectedTarget?.documentRequirementId}
            documentId={selectedTarget?.documentId}
          />

          {validationErrors.length ? (
            <div className="dashboard-list">
              {validationErrors.map((error) => (
                <p key={error} style={{ color: "#b91c1c", margin: 0 }}>
                  {error}
                </p>
              ))}
            </div>
          ) : null}

          {createdClaim ? (
            <div className="claim-created-box">
              <strong>Claim erstellt</strong>
              <pre>{JSON.stringify(createdClaim, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="instrument-actions">
        <button type="button" onClick={previousStep} disabled={step === 1}>
          Zurueck
        </button>
        {step < 6 ? (
          <button type="button" onClick={nextStep}>
            Weiter
          </button>
        ) : (
          <button type="button" onClick={submitClaim}>
            Claim validieren & erstellen
          </button>
        )}
      </div>
    </div>
  );
}
