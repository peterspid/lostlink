import { cx } from "@/lib/cx";

/**
 * The LostLink mark: a wayfinding-yellow luggage tag with a punched hole, the string that
 * links it back to its owner, and a claim-ticket perforation. Outlines follow `currentColor`
 * so the mark works on paper (ink) and on dark signage panels (paper).
 */
export function LogoMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <g transform="rotate(-14 24 26)">
        <path d="M24 11.5c0-6 3.8-9.5 9-9" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path
          d="M18 8h12l7.5 7.5V40a3.5 3.5 0 0 1-3.5 3.5H14A3.5 3.5 0 0 1 10.5 40V15.5z"
          fill="var(--color-signal)"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="15" r="3" fill="var(--color-paper)" stroke="currentColor" strokeWidth="2.6" />
        <path d="M15.5 34h17" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="2.6 3" />
      </g>
    </svg>
  );
}

/** Mark + wordmark. `tone="paper"` for use on ink/night panels. */
export function Logo({ size = 30, withName = true, tone = "ink", className }: { size?: number; withName?: boolean; tone?: "ink" | "paper"; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", tone === "paper" ? "text-paper" : "text-ink", className)}>
      <LogoMark size={size} className="shrink-0 transition-transform duration-300 ease-out group-hover:-rotate-6" />
      {withName && <span className="font-display text-[21px] font-black leading-none tracking-[-0.03em]">LostLink</span>}
    </span>
  );
}
