"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiBaseUrl, getStoredSession } from "@/lib/auth";

type MarketplaceInvestButtonProps = {
  listingId: string;
  disabled?: boolean;
  status: string;
  onSuccess?: () => void;
};

export function MarketplaceInvestButton({ listingId, disabled = false, status, onSuccess }: MarketplaceInvestButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const unavailable = disabled || status === "FILLED" || status === "CANCELLED";

  async function invest() {
    setMessage(null);

    const session = getStoredSession();
    if (!session?.token) {
      setMessage("Please login before investing.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${getApiBaseUrl()}/marketplace/listings/${listingId}/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Investment failed");
      }

      setMessage("Investment recorded.");
      onSuccess?.();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not invest.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 6 }}>
      <button type="button" onClick={invest} disabled={unavailable || isSubmitting}>
        {isSubmitting ? "Investing..." : unavailable ? "Unavailable" : "Invest"}
      </button>
      {message ? <p style={{ margin: 0, color: message.includes("recorded") ? "#166534" : "#b91c1c", fontSize: 13 }}>{message}</p> : null}
    </div>
  );
}
