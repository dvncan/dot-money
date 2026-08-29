"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getToken } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/cancellations", label: "Cancellations" },
  { href: "/transactions", label: "Transactions" },
  { href: "/merchants", label: "Merchants" },
  { href: "/budgets", label: "Budgets" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-hairline p-4 flex flex-col gap-1">
        <div className="text-lg font-semibold px-3 py-2 mb-2">
          Dot<span style={{ color: "var(--series-1)" }}>Money</span>
        </div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm ${
              pathname.startsWith(item.href)
                ? "bg-surface font-semibold border border-hairline"
                : "text-ink-2 hover:bg-surface"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <div className="mt-auto">
          <button
            className="px-3 py-2 text-sm text-ink-2 hover:text-ink"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 max-w-5xl">{children}</main>
    </div>
  );
}
