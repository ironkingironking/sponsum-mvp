"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, SectionTitle } from "@sponsum/ui";
import { ClaimCreationWizard } from "@/components/claims/ClaimCreationWizard";
import { getStoredSession, subscribeToAuthChanges } from "@/lib/auth";
import type { StructuredClaim } from "@/lib/claims";

export default function CreateClaimPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastCreatedClaimId, setLastCreatedClaimId] = useState<string | null>(null);

  useEffect(() => {
    const updateAuth = () => setIsAuthenticated(Boolean(getStoredSession()?.token));
    updateAuth();
    return subscribeToAuthChanges(updateAuth);
  }, []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle
          title="Claim-Erstellung"
          subtitle="Strukturierte Claims mit Referenzen auf Template-Felder, Klauselblöcke, Settlement-Events und Dokumentpflichten."
        />
        {!isAuthenticated ? (
          <p style={{ margin: 0, color: "#475569" }}>
            Für die Claim-Erstellung ist ein Login erforderlich.
          </p>
        ) : (
          <p style={{ margin: 0, color: "#475569" }}>
            Schrittweise Erstellung mit Snapshot-Logik und Blueprint-basierten Vorschlägen.
          </p>
        )}
      </Card>

      {!isAuthenticated ? (
        <Card>
          <p style={{ margin: "0 0 10px", color: "#334155" }}>
            Ohne aktive Session ist das Erstellen von Claims deaktiviert.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/auth/login">
              <button type="button">Zum Login</button>
            </Link>
            <Link href="/auth/register">
              <button type="button">Registrieren</button>
            </Link>
          </div>
        </Card>
      ) : null}

      {isAuthenticated ? (
        <ClaimCreationWizard
          onClaimCreated={(claim: StructuredClaim) => {
            setLastCreatedClaimId(claim.id);
          }}
        />
      ) : null}

      {lastCreatedClaimId ? (
        <Card>
          <p style={{ margin: 0, color: "#166534" }}>
            Claim erfolgreich erstellt: <strong>{lastCreatedClaimId}</strong>
          </p>
        </Card>
      ) : null}
    </div>
  );
}
