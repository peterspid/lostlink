import { Eye, Lock } from "lucide-react";

const PUBLIC = [
  ["What it is", "Black leather wallet"],
  ["Roughly where", "Near Central Station, blurred to about 300 m"],
  ["When", "Today, around 14:10"],
  ["Reference", "K7Q3F"],
];

const PRIVATE = [
  ["What's inside", "A library card and two receipts"],
  ["Exact spot", "Bench by the north exit"],
  ["Marks", "Initials stitched inside the flap"],
  ["Your answers", "Seen only by the finder"],
];

/**
 * Privacy as a claim ticket torn in two: the stub everyone can read, and the half that
 * stays with the finder until the owner proves it's theirs.
 */
export function PrivacyTicket() {
  return (
    <div className="grid overflow-hidden rounded-[28px] border border-line-strong bg-surface shadow-[var(--shadow-lift)] md:grid-cols-2">
      <div className="p-6 md:p-8">
        <p className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Eye className="size-5" aria-hidden /> Everyone can see
        </p>
        <dl className="mt-5 flex flex-col gap-3.5">
          {PUBLIC.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[13px] font-semibold text-ink-3">{k}</dt>
              <dd className={k === "Reference" ? "ref-code text-[17px]" : "font-display text-[17px] font-bold"}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="on-ink relative bg-ink p-6 text-paper md:p-8">
        <span className="perforation-y absolute inset-y-0 left-0 hidden w-px opacity-60 md:block" aria-hidden />
        <p className="flex items-center gap-2 font-display text-lg font-extrabold text-signal">
          <Lock className="size-5" aria-hidden /> Only the finder knows
        </p>
        <dl className="mt-5 flex flex-col gap-3.5">
          {PRIVATE.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[13px] font-semibold text-paper/55">{k}</dt>
              <dd className="font-display text-[17px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
