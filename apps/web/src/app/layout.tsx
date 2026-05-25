import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import type { ReactNode } from "react";
import { Providers } from "./_providers/Providers";
// CSS load order matters: globals.css (Tailwind preflight + tokens) →
// @carbon/styles (Carbon base + components) → carbon-theme.css (bGreen
// brand overrides). Last-in wins; do not reorder.
import "./globals.css";
import "@carbon/styles/css/styles.css";
import "../styles/carbon-theme.css";

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
