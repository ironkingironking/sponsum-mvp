"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getApiBaseUrl, setStoredSession } from "@/lib/auth";

type LoginResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  token: string;
  error?: string;
};

const DEMO_EMAIL = "issuer@sponsum.io";
const DEMO_PASSWORD = "mockpass123";
const DEMO_FULL_NAME = "Iris Issuer";

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function LoginForm() {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const apiBaseUrl = getApiBaseUrl();

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const payload = await readJson<LoginResponse>(response);

      if (!response.ok || !payload?.token || !payload?.user) {
        const canBootstrapDemoUser =
          response.status === 401 &&
          email.trim().toLowerCase() === DEMO_EMAIL &&
          password === DEMO_PASSWORD;

        if (!canBootstrapDemoUser) {
          setError(payload?.error || "Login fehlgeschlagen.");
          return;
        }

        const registerResponse = await fetch(`${apiBaseUrl}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: DEMO_EMAIL, fullName: DEMO_FULL_NAME, password: DEMO_PASSWORD })
        });

        const registerPayload = await readJson<LoginResponse>(registerResponse);
        if (!registerResponse.ok || !registerPayload?.token || !registerPayload?.user) {
          setError(registerPayload?.error || "Demo-User konnte nicht erstellt werden.");
          return;
        }

        setStoredSession({
          token: registerPayload.token,
          user: registerPayload.user
        });
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setStoredSession({
        token: payload.token,
        user: payload.user
      });

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(`API nicht erreichbar unter ${apiBaseUrl}. Bitte API-Server starten.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
      <label>
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
      </label>

      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}

      <button type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <p style={{ margin: 0, color: "#475569" }}>
        No account yet?{" "}
        <Link href="/auth/register" style={{ textDecoration: "underline" }}>
          Register
        </Link>
      </p>
      <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
        Demo Login: <code>{DEMO_EMAIL}</code> / <code>{DEMO_PASSWORD}</code>
      </p>
    </form>
  );
}
