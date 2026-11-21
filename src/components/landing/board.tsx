import Link from "next/link";
import type { CSSProperties } from "react";
import { MapPinned } from "lucide-react";
import { KindMark } from "@/components/ui";
import { BoardClock } from "@/components/landing/board-clock";
import { timeAgo } from "@/lib/time";

export interface BoardRow {
  id: string;
  code: string;
  kind: "lost" | "found";
  title: string;
  placeLabel: string;
  deskName?: string | null;
  occurredFrom: string;
}

/** Shown, clearly marked, only while nothing real has been posted yet. */
const EXAMPLES: BoardRow[] = [
  { id: "ex1", code: "K7Q3F", kind: "found", title: "Black leather wallet", placeLabel: "Platform 3 bench", occurredFrom: "" },
  { id: "ex2", code: "M4TZ8", kind: "found", title: "Blue Osprey backpack", placeLabel: "Library, 2nd floor", occurredFrom: "" },
  { id: "ex3", code: "R2WP6", kind: "lost", title: "Silver house keys, red fob", placeLabel: "Food court", occurredFrom: "" },
];

/** One character on a split-flap tile: a hairline splits the tile like the real hardware. */
function FlapCode({ code, row }: { code: string; row: number }) {
  return (
    <span className="flex gap-[3px]" aria-label={`Reference ${code}`}>
      {code.split("").map((ch, i) => (
        <span
          key={i}
          className="flap ref-code relative flex h-7 w-[19px] items-center justify-center rounded-[4px] bg-[#1e3653] text-[15px] tracking-normal text-signal shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_0_rgb(0_0_0/0.4)] md:h-8 md:w-[22px] md:text-[17px]"
          style={{ "--i": row, "--d": `${i * 55 + 120}ms` } as CSSProperties}
          aria-hidden
        >
          {ch}
          <span className="absolute inset-x-0 top-1/2 h-px bg-night" />
        </span>
      ))}
    </span>
  );
}

/**
 * The hero: a station-style lost property board listing the latest posts. Rows and code
 * tiles flip into place once on load; that's the page's single orchestrated moment.
 */
export function LostPropertyBoard({ rows }: { rows: BoardRow[] }) {
  const example = rows.length === 0;
  const list = example ? EXAMPLES : rows;
  return (
    <section className="on-ink relative overflow-hidden rounded-[28px] bg-night p-3 text-paper shadow-[var(--shadow-float)] sm:p-4" aria-labelledby="board-title">
      <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
        <h2 id="board-title" className="flex items-center gap-2 font-display text-[17px] font-extrabold">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-signal" />
          </span>
          Lost property board
        </h2>
        <BoardClock />
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-3 pb-2 text-[12px] font-semibold text-paper/45">
        <span>Ref</span>
        <span>Item and place</span>
        <span className="text-right">Posted</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {list.map((r, i) => {
          const inner = (
            <>
              <FlapCode code={r.code} row={i} />
              <span className="flap min-w-0" style={{ "--i": i } as CSSProperties}>
                <span className="block truncate font-display text-[15px] font-bold leading-tight md:text-[17px]">{r.title}</span>
                <span className="block truncate text-[13px] text-paper/55">{r.deskName ?? (r.placeLabel || "Location on map")}</span>
              </span>
              <span className="flap flex flex-col items-end gap-1" style={{ "--i": i } as CSSProperties}>
                <KindMark kind={r.kind} size="sm" onDark className="[--hole:var(--color-night)]" />
                <span className="text-[12px] tabular-nums text-paper/55">{example ? "Example" : timeAgo(r.occurredFrom).replace(" ago", "")}</span>
              </span>
            </>
          );
          const cls = "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-white/[0.045] px-3 py-2.5";
          return (
            <li key={r.id}>
              {example ? (
                <div className={`${cls} opacity-75`}>{inner}</div>
              ) : (
                <Link href={`/items/${r.id}`} className={`${cls} transition-colors hover:bg-white/[0.09]`}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
        <p className="text-[13px] text-paper/55">{example ? "Examples. Real posts appear here as soon as they're made." : "Locations are blurred to about 300 m."}</p>
        <Link href="/browse?view=map" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-display text-[14px] font-bold text-signal hover:bg-white/10">
          <MapPinned className="size-4" aria-hidden /> Open the map
        </Link>
      </div>
    </section>
  );
}
