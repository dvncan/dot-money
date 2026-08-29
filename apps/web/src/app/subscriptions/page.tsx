"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { api, fmtCad } from "@/lib/api";

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [letter, setLetter] = useState<{ vendor: string; content: string; id: string } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    api("/subscriptions").then(setSubs).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function startCancellation(sub: any) {
    setBusyId(sub._docID);
    try {
      const res = await api<any>("/cancellation-requests", {
        method: "POST",
        body: JSON.stringify({ subscriptionId: sub._docID, vendor: sub.vendor, templateId: "cancel-subscription" }),
      });
      setLetter({ vendor: sub.vendor, content: res.letterContent, id: res.id });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  async function markSent(id: string) {
    await api(`/cancellation-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status: "sent" }) });
    setLetter(null);
  }

  const statusBadge = (s: string) =>
    s === "active" ? ["●", "var(--status-good)", "Active"] :
    s === "pending_cancel" ? ["◐", "var(--status-warning)", "Cancelling"] :
    ["○", "var(--text-muted)", "Cancelled"];

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-2">Subscriptions</h1>
      <p className="text-sm text-ink-2 mb-6">
        Detected automatically from recurring charges. Duplicates in the same category are flagged.
      </p>
      {error && <p className="text-sm mb-4" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}

      <div className="flex flex-col gap-3">
        {subs.map((s) => {
          const [dot, color, label] = statusBadge(s.status);
          return (
            <div key={s._docID} className="card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {s.vendor}
                  {s.possibleDuplicate && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: "var(--status-warning)", color: "var(--text-secondary)" }}>
                      ⚠ possible duplicate
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {s.category} · {s.billingCycle} · seen {s.occurrences}× · next ~{s.nextBillingDate || "?"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{fmtCad(s.cost)}</p>
                <p className="text-xs text-muted">{fmtCad(s.monthlyCost)}/mo</p>
              </div>
              <span className="text-sm w-24 text-right" style={{ color: color as string }}>
                {dot} {label}
              </span>
              {s.status === "active" && (
                <button
                  onClick={() => startCancellation(s)}
                  disabled={busyId === s._docID}
                  className="text-sm px-3 py-1.5 rounded-lg border border-hairline hover:bg-plane"
                >
                  {busyId === s._docID ? "…" : "Cancel it"}
                </button>
              )}
            </div>
          );
        })}
        {subs.length === 0 && !error && (
          <p className="text-sm text-muted">No subscriptions detected yet — import transactions first.</p>
        )}
      </div>

      {letter && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6" onClick={() => setLetter(null)}>
          <div className="card max-w-2xl w-full max-h-[85vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-1">Cancellation letter — {letter.vendor}</h2>
            <p className="text-xs text-muted mb-4">
              General self-advocacy template, not legal advice. Review before sending, then email or mail it to the vendor.
            </p>
            <pre className="text-sm whitespace-pre-wrap bg-plane p-4 rounded-lg border border-hairline">{letter.content}</pre>
            <div className="flex gap-3 mt-4">
              <button className="text-sm px-4 py-2 rounded-lg font-semibold text-white" style={{ background: "var(--series-1)" }}
                onClick={() => navigator.clipboard.writeText(letter.content)}>
                Copy letter
              </button>
              <button className="text-sm px-4 py-2 rounded-lg border border-hairline" onClick={() => markSent(letter.id)}>
                I've sent it — start the clock
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
