import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const description = "Pages planned per visitor by System One decision models.";
// Link previews (Open Graph / X cards) need absolute URLs. SITE_BASE_PATH is /web4kit on Pages.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ogImage = {
  url: `${basePath}/og.png`,
  width: 1200,
  height: 630,
  alt: "The same restaurant page planned for three visitors. None of these were designed. They were decided.",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN ?? "https://shd8.github.io"),
  title: { default: "web4kit", template: "%s · web4kit" },
  description,
  openGraph: {
    type: "website",
    siteName: "web4kit",
    title: "web4kit",
    description,
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "web4kit",
    description,
    images: [ogImage],
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ options: { type: "static" } }}>{children}</RootProvider>
      </body>
    </html>
  );
}
