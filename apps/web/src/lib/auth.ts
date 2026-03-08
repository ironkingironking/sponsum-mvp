export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "sponsum.auth.session";
const AUTH_CHANGED_EVENT = "sponsum-auth-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
}

export function getStoredSession(): AuthSession | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearStoredSession(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function subscribeToAuthChanges(callback: () => void): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  window.addEventListener(AUTH_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
