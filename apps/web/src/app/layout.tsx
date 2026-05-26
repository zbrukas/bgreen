import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import type { ReactNode } from "react";
import { Providers } from "./_providers/Providers";
// All CSS imports (Carbon, Plex fonts, brand theme, Tailwind) are chained
// from globals.css via @import so cascade-layer ordering is explicit.
import "./globals.css";

export const metadata = {
  title: "bGreen",
  description: "ESG data collection, AI recommendations, and regulator-ready PDFs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <Providers>
          <AuthenticatedShell>{children}</AuthenticatedShell>
        </Providers>
      </body>
    </html>
  );
}
