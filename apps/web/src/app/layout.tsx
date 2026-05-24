import type { ReactNode } from "react";
import { Providers } from "./_providers/Providers";
import "./globals.css";

export const metadata = {
  title: "bGreen",
  description: "ESG data collection, AI recommendations, and regulator-ready PDFs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
