import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import type { ReactNode } from "react";
// All CSS imports (Carbon, Plex fonts, brand theme, Tailwind) are chained
// from globals.css via @import so cascade-layer ordering is explicit.
import "./globals.css";

export const metadata = {
  title: "bGreen — Central Services",
  description: "bGreen central services console.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </body>
    </html>
  );
}
