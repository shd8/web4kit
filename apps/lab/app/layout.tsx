import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

/** The public site (spec: public-release); NEXT_PUBLIC_SITE_URL overrides it, without a trailing slash. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shd8.github.io/web4kit";
const PLAYGROUND_URL = `${SITE_URL}/playground/`;

export const metadata: Metadata = {
  title: "web4 lab",
  description: "Pages planned per visitor by System One decision models.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Browser extensions (dark mode, grammar checkers, password managers) edit <html> and <body>
  // before React loads; suppressHydrationWarning ignores only those two elements' attributes.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${mono.variable}`}
    >
      <body suppressHydrationWarning>
        <p
          data-lab-banner=""
          className="border-b border-zinc-200 bg-zinc-50 px-4 py-1.5 text-center text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
        >
          This is the local web4 lab: live engines and arbitrary situations, for working on web4. It
          isn't deployed. The public demo is the{" "}
          <a href={PLAYGROUND_URL} className="underline">
            playground
          </a>
          .
        </p>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
