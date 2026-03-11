"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OnboardingModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState<"sell" | "invest" | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setIntent(null);
  }, [isOpen]);

  const stepTitle = useMemo(() => {
    if (step === 1) return "What is Sponsum?";
    if (step === 2) return "What do you want to do?";
    return "Start with these actions";
  }, [step]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Sponsum onboarding">
      <div className="onboarding-modal">
        <div className="onboarding-progress">
          <span className={step >= 1 ? "active" : ""} />
          <span className={step >= 2 ? "active" : ""} />
          <span className={step >= 3 ? "active" : ""} />
        </div>

        <h2>{stepTitle}</h2>

        {step === 1 ? (
          <p>
            Sponsum lets people trade financial claims such as invoices, bills of exchange or future payments.
          </p>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-action-grid">
            <button type="button" className={intent === "sell" ? "selected" : ""} onClick={() => setIntent("sell")}>
              Sell a claim
            </button>
            <button type="button" className={intent === "invest" ? "selected" : ""} onClick={() => setIntent("invest")}>
              Invest in a claim
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="onboarding-suggestions">
            <Link href="/claims/create" onClick={onClose} className="onboarding-link-card">
              <strong>Create your first claim</strong>
              <p>Use the 4-step wizard and publish when ready.</p>
            </Link>
            <Link href="/marketplace" onClick={onClose} className="onboarding-link-card">
              <strong>Browse marketplace</strong>
              <p>Review risk, trust signals and expected return.</p>
            </Link>
          </div>
        ) : null}

        <div className="onboarding-footer">
          <button type="button" onClick={onClose} className="ghost">
            Skip for now
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep((current) => current + 1)}>
              Continue
            </button>
          ) : (
            <button type="button" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
