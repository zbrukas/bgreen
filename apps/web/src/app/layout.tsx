import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "bGreen",
  description: "ESG data collection, AI recommendations, and regulator-ready PDFs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
