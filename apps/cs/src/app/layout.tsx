import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import type { ReactNode } from "react";
// CSS load order matters:
//   1. globals.css            — Tailwind preflight + project tokens
//   2. @carbon/styles         — Carbon base + components + CDN @font-face refs
//   3. @ibm/plex-*            — self-hosted @font-face *after* Carbon so the
//                               local /_next/static/media woffs win the
//                               cascade and we avoid s81c.com runtime fetches
//   4. carbon-theme.css       — bGreen --cds-* brand overrides
// Last-in wins; do not reorder.
import "./globals.css";
import "@carbon/styles/css/styles.css";
import "@ibm/plex-sans/css/ibm-plex-sans-default.css";
import "@ibm/plex-mono/css/ibm-plex-mono-default.css";
import "../styles/carbon-theme.css";

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
