import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Welcome to web4",
  description: "A web4 site: every visitor gets a page planned for their situation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Browser extensions (dark mode, grammar checkers, password managers) edit <html> and <body>
  // before React loads; suppressHydrationWarning ignores only those two elements' attributes.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-w4-theme="ops"
      className={`${sans.variable} ${mono.variable}`}
    >
      <body data-w4-theme="ops" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
