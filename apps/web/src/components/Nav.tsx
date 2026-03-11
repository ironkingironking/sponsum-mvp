"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AuthUser, clearStoredSession, getStoredSession, subscribeToAuthChanges } from "@/lib/auth";

const topLinks = [
  ["/dashboard", "Dashboard"],
  ["/marketplace", "Marketplace"],
  ["/claims/create", "Create Claim"],
  ["/deals", "My Deals"],
  ["/messages", "Messages"],
  ["/profile", "Profile"]
] as const;

function onboardingStorageKey(userId: string): string {
  return `sponsum.onboarding.completed.${userId}`;
}

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const updateUser = () => {
      const session = getStoredSession();
      setUser(session?.user ?? null);
    };

    updateUser();
    return subscribeToAuthChanges(updateUser);
  }, []);

  useEffect(() => {
    if (!user) {
      setShowOnboarding(false);
      return;
    }

    const key = onboardingStorageKey(user.id);
    const done = window.localStorage.getItem(key) === "true";
    setShowOnboarding(!done);
  }, [user]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function finishOnboarding() {
    if (user) {
      window.localStorage.setItem(onboardingStorageKey(user.id), "true");
    }
    setShowOnboarding(false);
  }

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <Link href="/" className="brand">
            Sponsum
          </Link>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen((current) => !current)}
          >
            ☰
          </button>

          <nav className={menuOpen ? "top-nav-links open" : "top-nav-links"}>
            {topLinks.map(([href, label]) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link key={href} href={href} className={active ? "active" : ""}>
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="top-nav-auth">
            {user ? (
              <>
                <span>{user.fullName}</span>
                <button type="button" onClick={clearStoredSession}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login">Login</Link>
                <Link href="/auth/register">Register</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <OnboardingModal isOpen={showOnboarding} onClose={finishOnboarding} />
    </>
  );
}

