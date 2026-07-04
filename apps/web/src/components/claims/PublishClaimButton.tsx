"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getApiBaseUrl, getStoredSession } from "@/lib/auth";

type PublishClaimButtonProps = {
  claimId: string;
  defaultAskPrice: number;
};

export function PublishClaimButton({ claimId, defaultAskPrice }: PublishClaimButtonProps) {
  const [askPrice, setAskPrice] = useState(String(defaultAskPrice || 1));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const session = getStoredSession();
    if (!session?.token) {
      setMessage("Please login before publishing.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${getApiBaseUrl()}/claims/${claimId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          listingStatus: "PUBLISHED",
          askPrice: Number(askPrice),
          isPartialAllowed: false
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Publish failed");
      }

      setMessage("Published to marketplace.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish claim.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 10 }}>
      <label>
        Ask price
        <input
          type="number"
          min="1"
          step="0.01"
          value={askPrice}
          onChange={(event) => setAskPrice(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Publishing..." : "Publish to marketplace"}
      </button>
      {message ? <p style={{ margin: 0, color: message.includes("Published") ? "#166534" : "#b91c1c" }}>{message}</p> : null}
    </form>
  );
}
