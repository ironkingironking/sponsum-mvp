"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getApiBaseUrl, setStoredSession } from "@/lib/auth";

type RegisterResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  token: string;
  error?: string;
};

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password })
      });

      const payload = (await response.json()) as RegisterResponse;

      if (!response.ok || !payload.token || !payload.user) {
        setError(payload.error || "Registration failed");
        return;
      }

      setStoredSession({
        token: payload.token,
        user: payload.user
      });

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to register right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
      <label>
        Full name
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} required />
      </label>
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
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p style={{ margin: 0, color: "#475569" }}>
        Already registered?{" "}
        <Link href="/auth/login" style={{ textDecoration: "underline" }}>
          Login
        </Link>
      </p>
    </form>
  );
}
