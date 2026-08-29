"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// MVP: token in localStorage. Move to httpOnly cookies before any hosted deployment.
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("finshield_token");
}

export function setSession(token: string, refresh: string, name?: string) {
  localStorage.setItem("finshield_token", token);
  localStorage.setItem("finshield_refresh", refresh);
  if (name) localStorage.setItem("finshield_name", name);
}

export function clearSession() {
  localStorage.removeItem("finshield_token");
  localStorage.removeItem("finshield_refresh");
  localStorage.removeItem("finshield_name");
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const doFetch = () =>
    fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...(opts.headers ?? {}),
      },
    });

  let res = await doFetch();

  // one silent refresh attempt on 401
  if (res.status === 401 && localStorage.getItem("finshield_refresh")) {
    const rr = await fetch(`${API}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: localStorage.getItem("finshield_refresh") }),
    });
    if (rr.ok) {
      const t = await rr.json();
      setSession(t.accessToken, t.refreshToken);
      res = await doFetch();
    } else {
      clearSession();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const fmtCad = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
