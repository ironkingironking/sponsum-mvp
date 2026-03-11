"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, SectionTitle } from "@sponsum/ui";
import { SimpleClaimWizard } from "@/components/claims/SimpleClaimWizard";

export default function CreateClaimPage() {
  const [createdClaimId, setCreatedClaimId] = useState<string | null>(null);

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle
          title="Create Claim"
          subtitle="Simple 4-step flow: basic info, instrument details, security, then review."
        />
        <p style={{ margin: 0, color: "#475569" }}>
          Keep it simple. Choose your instrument type and fill only the relevant fields.
        </p>
      </Card>

      <SimpleClaimWizard onCreated={setCreatedClaimId} />

      {createdClaimId ? (
        <Card>
          <p style={{ margin: "0 0 10px", color: "#166534" }}>
            Claim created successfully: <strong>{createdClaimId}</strong>
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/claims/${createdClaimId}`}>
              <button type="button">View claim</button>
            </Link>
            <Link href="/marketplace">
              <button type="button" className="ghost">
                Browse marketplace
              </button>
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
