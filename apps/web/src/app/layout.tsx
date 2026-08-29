import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DotMoney — your financial advocate",
  description: "Canadian subscription management, refunds, and spending audits.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
