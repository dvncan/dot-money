"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { api } from "@/lib/api";

/**
 * OAuth return page. Canadian OAuth institutions (RBC, TD, BMO, …) send the
 * user to their own login, then redirect back here. Link must be re-initialized
 * with the same link token plus the full redirect URL to complete the flow.
 */
function ResumeLink({ token, receivedRedirectUri }: { token: string; receivedRedirectUri: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing your bank connection…");

  const { open, ready } = usePlaidLink({
    token,
    receivedRedirectUri,
    onSuccess: async (publicToken) => {
      try {
        const res = await api<any>("/banks/exchange", {
          method: "POST",
          body: JSON.stringify({ publicToken }),
        });
        setMsg(`Bank linked — imported ${res.transactionsImported} transactions. Redirecting…`);
      } catch (err: any) {
        setMsg(`Link succeeded but import failed: ${err.message}`);
      }
      localStorage.removeItem("dotmoney_plaid_link_token");
      setTimeout(() => router.replace("/transactions"), 1200);
    },
    onExit: () => {
      localStorage.removeItem("dotmoney_plaid_link_token");
      router.replace("/transactions");
    },
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return <p className="text-sm text-ink-2">{msg}</p>;
}

export default function PlaidOauthPage() {
  const router = useRouter();
  const [state, setState] = useState<{ token: string; uri: string } | null | "missing">(null);

  useEffect(() => {
    const token = localStorage.getItem("dotmoney_plaid_link_token");
    if (!token) {
      setState("missing");
      return;
    }
    setState({ token, uri: window.location.href });
  }, []);

  useEffect(() => {
    if (state === "missing") {
      const t = setTimeout(() => router.replace("/transactions"), 2000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8">
        {state === "missing" ? (
          <p className="text-sm text-ink-2">No pending bank connection found — redirecting…</p>
        ) : state ? (
          <ResumeLink token={state.token} receivedRedirectUri={state.uri} />
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </div>
    </div>
  );
}
