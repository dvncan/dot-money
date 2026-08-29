"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession } from "@/lib/api";

const PROVINCES = ["ON", "BC", "QC", "AB", "MB", "SK", "NS", "NB", "NL", "PE"];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [province, setProvince] = useState("ON");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body =
        mode === "login" ? { email, password } : { email, password, name, province };
      const res = await api<any>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSession(res.accessToken, res.refreshToken, res.name);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-8 flex flex-col gap-4">
        <div className="text-2xl font-semibold">
          Fin<span style={{ color: "var(--series-1)" }}>Shield</span>
        </div>
        <p className="text-sm text-ink-2">
          Your financial advocate — subscriptions, refunds, and spending audits for Canadians.
        </p>
        {mode === "register" && (
          <>
            <input className="card px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="text-sm text-ink-2">
              Province{" "}
              <select className="card px-2 py-1 ml-2" value={province} onChange={(e) => setProvince(e.target.value)}>
                {PROVINCES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
          </>
        )}
        <input className="card px-3 py-2 text-sm" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="card px-3 py-2 text-sm" type="password" required minLength={8} placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}
        <button disabled={busy} className="rounded-lg py-2 font-semibold text-white" style={{ background: "var(--series-1)" }}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="text-sm text-ink-2 underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        <p className="text-xs text-muted">Demo login: demo@finshield.ca / demo-password-123</p>
      </form>
    </div>
  );
}
