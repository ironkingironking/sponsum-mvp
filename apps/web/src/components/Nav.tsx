"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthUser, clearStoredSession, getStoredSession, subscribeToAuthChanges } from "@/lib/auth";

const links = [
  ["/", "Landing"],
  ["/dashboard", "Dashboard"],
  ["/marketplace", "Marketplace"],
  ["/templates", "Templates"],
  ["/instruments", "Instruments"],
  ["/claims/create", "Create Claim"],
  ["/disputes", "Disputes"],
  ["/collateral", "Collateral"],
  ["/escrow", "Escrow"],
  ["/custody", "Custody"]
] as const;

export function Nav() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const updateUser = () => {
      setUser(getStoredSession()?.user ?? null);
    };

    updateUser();
    return subscribeToAuthChanges(updateUser);
  }, []);

  return (
    <header style={{ borderBottom: "1px solid #d7dce4", background: "#fff" }}>
      <div className="container" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ marginRight: 16 }}>Sponsum</strong>
        {links.map(([href, label]) => (
          <Link key={href} href={href} style={{ fontSize: 14, color: "#334155" }}>
            {label}
          </Link>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {user ? (
            <>
              <span style={{ fontSize: 14, color: "#334155" }}>{user.fullName}</span>
              <button type="button" onClick={clearStoredSession}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" style={{ fontSize: 14, color: "#334155" }}>
                Login
              </Link>
              <Link href="/auth/register" style={{ fontSize: 14, color: "#334155" }}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
