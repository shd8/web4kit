"use client";

import { useState } from "react";
import { CREATE_COMMAND, TYPESAFE_CONSOLE_URL } from "@/lib/links";

/** "Try it on your site" (spec: site): the scaffold command with a copy button, and the console. */
export function TryIt() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CREATE_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the command stays selectable.
    }
  };
  return (
    <section
      data-try-it=""
      className="mt-12 flex flex-col gap-3 rounded-xl border border-fd-border bg-fd-card p-5"
    >
      <h2 className="text-lg font-semibold">Try it on your site</h2>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-fd-muted px-3 py-2 font-mono text-sm select-all">
          {CREATE_COMMAND}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-fd-border px-3 py-2 text-sm hover:bg-fd-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-sm text-fd-muted-foreground">
        Without a key, pages are planned by the offline rules engine. For a System One model, get a
        Jev key from the{" "}
        <a href={TYPESAFE_CONSOLE_URL} className="underline">
          TypeSafe console
        </a>{" "}
        and put it in <code>.env</code>.
      </p>
    </section>
  );
}
