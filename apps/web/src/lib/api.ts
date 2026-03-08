const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`GET ${path} failed`);
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`POST ${path} failed`);
  return response.json() as Promise<T>;
}
