"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { api, fmtCad } from "@/lib/api";

const STATUS_FLOW: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["responded", "resolved"],
  responded: ["resolved"],
  resolved: [],
};

export default function CancellationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api("/cancellation-requests").then(setRows).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function setStatus(id: string, status: string) {
    await api(`/cancellation-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
    setOpen(null);
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-2">Cancellations & refunds</h1>
      <p className="text-sm text-ink-2 mb-6">Track every request and its response deadline.</p>
      {error && <p className="text-sm mb-4" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}

      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const overdue = r.status === "sent" && r.responseDeadline < new Date().toISOString().slice(0, 10);
          return (
            <div key={r._docID} className="card p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">{r.vendor}</p>
                <p className="text-xs text-muted">
                  {r.templateId} · created {r.createdAt?.slice(0, 10)}
                  {r.sentDate && ` · sent ${r.sentDate}`}
                  {r.responseDeadline && ` · respond by ${r.responseDeadline}`}
                </p>
              </div>
              {r.refundAmount > 0 && <span className="text-sm tabular-nums">{fmtCad(r.refundAmount)}</span>}
              <span className="text-sm" style={{ color: overdue ? "var(--status-critical)" : "var(--text-secondary)" }}>
                {overdue ? "⏰ deadline passed" : r.status}
              </span>
              <button className="text-sm px-3 py-1.5 rounded-lg border border-hairline" onClick={() => setOpen(r)}>
                View
              </button>
            </div>
          );
        })}
        {rows.length === 0 && !error && (
          <p className="text-sm text-muted">No requests yet. Start one from the Subscriptions page.</p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6" onClick={() => setOpen(null)}>
          <div className="card max-w-2xl w-full max-h-[85vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-4">{open.vendor} — {open.status}</h2>
            <pre className="text-sm whitespace-pre-wrap bg-plane p-4 rounded-lg border border-hairline">{open.letterContent}</pre>
            <div className="flex gap-3 mt-4">
              {STATUS_FLOW[open.status]?.map((next: string) => (
                <button key={next} className="text-sm px-4 py-2 rounded-lg border border-hairline" onClick={() => setStatus(open._docID, next)}>
                  Mark {next}
                </button>
              ))}
              <button className="text-sm px-4 py-2 rounded-lg border border-hairline" onClick={() => navigator.clipboard.writeText(open.letterContent)}>
                Copy letter
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
