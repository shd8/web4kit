/** The web4kit mark: a page of blocks, one of them chosen. Follows the text colour. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <g fill="var(--color-fd-background)">
        <rect x="6" y="6" width="20" height="7" rx="2" fillOpacity={0.35} />
        <rect x="6" y="16" width="9" height="10" rx="2" fillOpacity={0.35} />
        <rect x="17" y="16" width="9" height="10" rx="2" />
      </g>
    </svg>
  );
}
