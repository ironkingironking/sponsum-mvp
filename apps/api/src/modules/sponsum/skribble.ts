import { DomainError } from "@sponsum/shared";

export type SkribbleQuality = "SES" | "AES" | "QES" | "DEMO";

export type SkribbleRequest = {
  id: string;
  signing_url: string | null;
  status_overall: string;
  quality: string | null;
  requested_quality: string | null;
  signed_quality: string | null;
  legislation: string;
  mock: boolean;
};

export function skribbleMock(): boolean {
  return ["1", "true", "yes"].includes(String(process.env.SKRIBBLE_MOCK || process.env.MOVENA_SKRIBBLE_MOCK || "").toLowerCase());
}

export function skribbleConfigured(): boolean {
  if (skribbleMock()) return true;
  return Boolean(skribbleUsername() && skribbleApiKey());
}

export function skribbleUsername(): string {
  return String(process.env.SKRIBBLE_USERNAME || process.env.MOVENA_SKRIBBLE_USERNAME || "").trim();
}

export function skribbleApiKey(): string {
  return String(process.env.SKRIBBLE_API_KEY || process.env.MOVENA_SKRIBBLE_API_KEY || "").trim();
}

export function skribbleBaseUrl(): string {
  return String(process.env.SKRIBBLE_BASE_URL || process.env.MOVENA_SKRIBBLE_BASE_URL || "https://api.skribble.com/v2")
    .replace(/\/+$/, "");
}

export function skribbleLegislation(): string {
  return String(process.env.SKRIBBLE_LEGISLATION || process.env.MOVENA_SKRIBBLE_LEGISLATION || "ZERTES").trim() || "ZERTES";
}

export function allowDemoQuality(): boolean {
  return ["1", "true", "yes"].includes(String(process.env.SKRIBBLE_ALLOW_DEMO || "").toLowerCase());
}

export function qualityRank(quality: string | null | undefined): number {
  const q = String(quality || "").toUpperCase();
  if (q === "QES") return 40;
  if (q === "AES" || q === "AES_MINIMAL") return 30;
  if (q === "SES") return 20;
  if (q === "DEMO") return 5;
  return 0;
}

export function isSkribbleSigned(status: string | null | undefined): boolean {
  return ["SIGNED", "COMPLETED", "CLOSED", "DONE"].includes(String(status || "").toUpperCase());
}

let cachedToken: string | null = null;
let cachedExp = 0;

export async function createSkribbleRequest(input: {
  title: string;
  message: string;
  content_base64: string;
  email: string;
  first_name?: string;
  last_name?: string;
  quality: SkribbleQuality;
}): Promise<SkribbleRequest> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new DomainError("skribble_signer_required", "Für QES/AES braucht es die E-Mail der zeichnenden Person.");
  }
  const quality = input.quality;
  if (skribbleMock()) {
    const id = `mock-sr-${Date.now().toString(36)}`;
    return {
      id,
      signing_url: `https://my.skribble.com/view/${id}/sponsum`,
      status_overall: mockComplete() ? "SIGNED" : "OPEN",
      quality: mockComplete() ? quality : quality,
      requested_quality: quality,
      signed_quality: mockComplete() ? quality : null,
      legislation: skribbleLegislation(),
      mock: true
    };
  }
  if (!skribbleConfigured()) {
    throw new DomainError(
      "skribble_not_configured",
      "Skribble ist nicht konfiguriert. QES/AES brauchen SKRIBBLE_USERNAME und SKRIBBLE_API_KEY."
    );
  }
  const token = await getToken();
  const raw = await skribbleFetch("/signature-requests", {
    method: "POST",
    token,
    body: {
      title: input.title.slice(0, 200),
      message: input.message.slice(0, 2000),
      content: input.content_base64,
      content_type: "application/pdf",
      quality,
      legislation: skribbleLegislation(),
      signatures: [
        {
          account_email: email,
          notify: true,
          signer_identity_data: {
            email_address: email,
            first_name: input.first_name || "Zeichner",
            last_name: input.last_name || "Sponsum"
          }
        }
      ]
    }
  });
  return normalize(jsonObject(raw), quality);
}

export async function getSkribbleRequest(id: string): Promise<SkribbleRequest> {
  if (skribbleMock()) {
    const quality = "QES";
    return {
      id,
      signing_url: `https://my.skribble.com/view/${id}/sponsum`,
      status_overall: mockComplete() ? "SIGNED" : "OPEN",
      quality: mockComplete() ? quality : quality,
      requested_quality: quality,
      signed_quality: mockComplete() ? quality : null,
      legislation: skribbleLegislation(),
      mock: true
    };
  }
  const token = await getToken();
  const raw = await skribbleFetch(`/signature-requests/${encodeURIComponent(id)}`, { method: "GET", token });
  return normalize(jsonObject(raw), null);
}

export function assertQualityHonored(requested: string, actual: string | null): string {
  const got = String(actual || "").toUpperCase();
  if (qualityRank(got) >= qualityRank(requested)) return got || requested;
  if (got === "DEMO" && allowDemoQuality()) return "DEMO";
  throw new DomainError(
    "skribble_quality_downgraded",
    got === "DEMO"
      ? "Skribble lieferte DEMO statt QES. Das Demo-Konto erzeugt keine rechtsgültige Qualifikation."
      : `Skribble lieferte ${got || "keine Stufe"} statt ${requested}.`
  );
}

function mockComplete(): boolean {
  return ["1", "true", "yes"].includes(String(process.env.SKRIBBLE_MOCK_COMPLETE || "").toLowerCase());
}

function normalize(raw: Record<string, unknown>, requested: string | null): SkribbleRequest {
  const signatures = Array.isArray(raw.signatures) ? (raw.signatures as Array<Record<string, unknown>>) : [];
  const primary = signatures[0] || {};
  const signed =
    signatures
      .map((row) => String(row.signed_quality || row.quality || ""))
      .filter(Boolean)
      .sort((a, b) => qualityRank(b) - qualityRank(a))[0] || null;
  return {
    id: String(raw.id || ""),
    signing_url: String(primary.signing_url || raw.signing_url || "") || null,
    status_overall: String(raw.status_overall || raw.status || ""),
    quality: raw.quality ? String(raw.quality) : null,
    requested_quality: requested,
    signed_quality: signed,
    legislation: String(raw.legislation || skribbleLegislation()),
    mock: false
  };
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedExp > now + 30_000) return cachedToken;
  const raw = await skribbleFetch("/access/login", {
    method: "POST",
    body: { username: skribbleUsername(), "api-key": skribbleApiKey() }
  });
  const token = typeof raw === "string" ? raw.replace(/^"|"$/g, "") : String(raw.access_token || raw.token || "");
  if (!token) throw new DomainError("skribble_auth_failed", "Skribble Login lieferte kein Token.");
  cachedToken = token;
  cachedExp = now + 10 * 60 * 1000;
  return token;
}

/** Skribble answers JSON; a text body on a 2xx response is an error, never an empty request. */
function jsonObject(raw: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof raw === "string") {
    throw new DomainError("skribble_error", "Skribble hat keine JSON-Antwort geliefert.");
  }
  return raw;
}

async function skribbleFetch(
  path: string,
  input: { method: string; token?: string; body?: unknown }
): Promise<Record<string, unknown> | string> {
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (input.token) headers.Authorization = `Bearer ${input.token}`;
  let response: Response;
  try {
    response = await fetch(`${skribbleBaseUrl()}${path}`, {
      method: input.method,
      headers,
      body: input.body == null ? undefined : JSON.stringify(input.body)
    });
  } catch (error) {
    throw new DomainError("skribble_unreachable", `Skribble nicht erreichbar: ${(error as Error).message}`);
  }
  const text = await response.text();
  let data: Record<string, unknown> | string = text;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message =
      (typeof data === "object" && data && (data.message || data.title || data.detail)) || `Skribble HTTP ${response.status}`;
    throw new DomainError(
      response.status === 401 || response.status === 403 ? "skribble_auth_failed" : "skribble_error",
      String(message).slice(0, 400)
    );
  }
  return data;
}
