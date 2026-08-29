"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";

const PROVINCES = ["", "ON", "BC", "QC", "AB", "MB", "SK", "NS", "NB", "NL", "PE"];

export interface MerchantRecord {
  _docID: string;
  name: string;
  category: string;
  pattern: string;
  address?: string;
  city?: string;
  province?: string;
}

/** Modal for teaching the app a merchant (e.g. a neighbourhood coffee shop),
 *  or editing one of the user's own. On save, the API re-categorizes all
 *  matching transactions. */
export default function AddMerchant({
  existing,
  onClose,
  onAdded,
}: {
  existing?: MerchantRecord;
  onClose: () => void;
  onAdded: (recategorized: number) => void;
}) {
  const { categories: CATEGORIES } = useCategories();
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "Dining");
  const [pattern, setPattern] = useState(existing?.pattern ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [province, setProvince] = useState(existing?.province ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        name,
        category,
        ...(pattern.trim() ? { pattern: pattern.trim() } : {}),
        address: address.trim(),
        city: city.trim(),
        province,
      };
      const res = existing
        ? await api<any>(`/merchants/${existing._docID}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<any>("/merchants", { method: "POST", body: JSON.stringify(payload) });
      onAdded(res.recategorized ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <form onSubmit={submit} className="card max-w-md w-full p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold">{existing ? `Edit ${existing.name}` : "Add a merchant"}</h2>
        <p className="text-xs text-muted">
          Transactions whose description contains the match text get this category — now and on
          every future import.
        </p>
        <label className="text-sm text-ink-2 flex flex-col gap-1">
          Name *
          <input className="card px-3 py-2" required minLength={2} value={name}
            placeholder="e.g. Sam James Coffee Bar" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-sm text-ink-2 flex flex-col gap-1">
          Category *
          <select className="card px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-sm text-ink-2 flex flex-col gap-1">
          Match texts <span className="text-muted">(optional — defaults to the name; separate several with commas)</span>
          <input className="card px-3 py-2" value={pattern}
            placeholder="e.g. united airlines, united payment, united travel" onChange={(e) => setPattern(e.target.value)} />
        </label>
        <label className="text-sm text-ink-2 flex flex-col gap-1">
          Address <span className="text-muted">(optional)</span>
          <input className="card px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <div className="flex gap-3">
          <label className="text-sm text-ink-2 flex flex-col gap-1 flex-1">
            City <span className="text-muted">(optional)</span>
            <input className="card px-3 py-2" value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="text-sm text-ink-2 flex flex-col gap-1 w-28">
            Province
            <select className="card px-3 py-2" value={province} onChange={(e) => setProvince(e.target.value)}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p || "—"}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="text-sm" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}
        <div className="flex gap-3 mt-1">
          <button disabled={busy} className="text-sm px-4 py-2 rounded-lg font-semibold text-white" style={{ background: "var(--series-1)" }}>
            {busy ? "Saving…" : existing ? "Save changes" : "Save merchant"}
          </button>
          <button type="button" className="text-sm px-4 py-2 rounded-lg border border-hairline" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
