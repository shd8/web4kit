import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-azulejo-display",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Casa Ribeira · Boutique hotel in Porto",
  description:
    "Twelve rooms on the Ribeira waterfront. A web4 starter: every visitor gets a page planned for their situation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-w4-theme="azulejo" className={`${display.variable} ${sans.variable}`}>
      <body data-w4-theme="azulejo">{children}</body>
    </html>
  );
}
