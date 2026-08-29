"use client";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { api } from "@/lib/api";

/** Opens Plaid Link as soon as the token is ready, then exchanges the public
 *  token server-side and reports how many transactions came in. */
function PlaidLauncher({
  token,
  onDone,
}: {
  token: string;
  onDone: (msg: string, refresh: boolean) => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async (publicToken) => {
      try {
        const res = await api<any>("/banks/exchange", {
          method: "POST",
          body: JSON.stringify({ publicToken }),
        });
        onDone(`Bank linked — imported ${res.transactionsImported} transactions.`, true);
      } catch (err: any) {
        onDone(`Link succeeded but import failed: ${err.message}`, false);
      }
    },
    onExit: () => onDone("", false),
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return null;
}

export default function ConnectBank({ onLinked }: { onLinked?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setMsg("");
    try {
      const res = await api<{ linkToken: string }>("/banks/link-token", { method: "POST" });
      setLinkToken(res.linkToken);
    } catch (err: any) {
      setMsg(err.message); // includes the "set PLAID_CLIENT_ID…" guidance when keys are missing
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        onClick={start}
        disabled={busy || !!linkToken}
        className="text-sm px-3 py-2 rounded-lg font-semibold text-white"
        style={{ background: "var(--series-1)" }}
      >
        {busy ? "Connecting…" : "Connect bank"}
      </button>
      {linkToken && (
        <PlaidLauncher
          token={linkToken}
          onDone={(m, refresh) => {
            setLinkToken(null);
            setMsg(m);
            if (refresh) onLinked?.();
          }}
        />
      )}
      {msg && <span className="text-sm text-ink-2">{msg}</span>}
    </span>
  );
}
