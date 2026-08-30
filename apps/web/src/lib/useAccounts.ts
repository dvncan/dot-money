"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface Account {
  _docID: string;
  institution: string;
  accountName: string;
  accountType: string;
  mask: string;
  source: "plaid" | "csv";
  transactionCount: number;
}

/** A short label for an account: "RBC chequing ••4521" */
export function accountLabel(a: Account): string {
  const name = [a.institution, a.accountName].filter(Boolean).join(" · ");
  return a.mask ? `${name} ••${a.mask}` : name;
}

/** The user's linked/imported accounts, for the account switcher. */
export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  const reload = useCallback(() => {
    api<Account[]>("/banks/accounts").then(setAccounts).catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  return { accounts, reload };
}
