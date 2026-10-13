import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions()}>
      {children}
      <footer className="px-4 py-8 text-center text-xs text-fd-muted-foreground">
        This site counts page views with{" "}
        <a className="underline" href="https://www.goatcounter.com">
          GoatCounter
        </a>
        : no cookies, no personal data.
      </footer>
    </HomeLayout>
  );
}
