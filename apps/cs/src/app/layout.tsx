import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "bGreen — Central Services",
  description: "bGreen central services console.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
