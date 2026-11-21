/** Wordmark: a luggage-tag mark (signal yellow, punched hole) beside the name. */
export function Logo({ size = 28, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <path d="M9 3h14a3 3 0 0 1 3 3v20.5a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 6 26.5V6a3 3 0 0 1 3-3Z" fill="#F5B800" stroke="#1C2733" strokeWidth="2" />
        <circle cx="16" cy="9" r="2.6" fill="#F3F4F0" stroke="#1C2733" strokeWidth="2" />
        <path d="M11 17h10M11 21.5h6.5" stroke="#1C2733" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {withName && <span className="font-display text-[21px] font-extrabold leading-none tracking-tight text-ink">LostLink</span>}
    </span>
  );
}
