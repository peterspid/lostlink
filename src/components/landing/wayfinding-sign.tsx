import Link from "next/link";
import { ArrowRight, Plus, Search } from "lucide-react";

const ROWS = [
  {
    href: "/report?kind=lost",
    testid: "cta-lost",
    label: "I lost something",
    sub: "Describe it once. We keep looking and alert you.",
    icon: Search,
    plate: "bg-paper text-ink",
  },
  {
    href: "/report?kind=found",
    testid: "cta-found",
    label: "I found something",
    sub: "Snap a photo. We fill in the details and find the owner.",
    icon: Plus,
    plate: "bg-signal text-ink",
  },
];

/** The two ways in, set like an airport direction sign: pictogram, destination, arrow. */
export function WayfindingSign() {
  return (
    <nav aria-label="Start a report" className="on-ink overflow-hidden rounded-[28px] bg-ink text-paper shadow-[var(--shadow-float)]">
      {ROWS.map((r, i) => {
        const Icon = r.icon;
        return (
          <Link
            key={r.href}
            href={r.href}
            data-testid={r.testid}
            className={`group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-white/[0.06] sm:px-5 sm:py-5 ${i > 0 ? "border-t border-white/10" : ""}`}
          >
            <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${r.plate}`} aria-hidden>
              <Icon className="size-7" strokeWidth={2.6} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[26px]">{r.label}</span>
              <span className="mt-0.5 block text-[15px] text-paper/70">{r.sub}</span>
            </span>
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-paper/25 text-signal transition-[transform,border-color,background-color] duration-300 ease-[var(--ease-out-soft)] group-hover:translate-x-1 group-hover:border-signal group-hover:bg-signal group-hover:text-ink"
              aria-hidden
            >
              <ArrowRight className="size-5" strokeWidth={2.6} />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
