import type { CSSProperties } from "react";
import { ScrollProgress } from "@/components/motion";

const STOPS = [
  { title: "Post", text: "Snap a photo and drop a pin. LostLink reads the photo and fills in the category, colour and brand." },
  { title: "Match", text: "Every new post is compared with what's lost or found nearby, by description, place and time. Both sides get an alert." },
  { title: "Prove it", text: "The owner answers questions only they could know. The finder sees the answers next to their own, then approves." },
  { title: "Meet", text: "Chat privately, agree a busy public spot and a time, then both tap Returned. The finder earns karma." },
];

/**
 * How it works, drawn as a metro line. The yellow line fills as you scroll and each stop
 * lights up as the line reaches it (pure CSS on the --p published by ScrollProgress).
 */
export function RouteLine() {
  return (
    <ScrollProgress className="relative">
      <div className="absolute bottom-20 left-[22px] top-6 w-1.5 overflow-hidden rounded-full bg-line-strong md:inset-x-[12.5%] md:bottom-auto md:left-[12.5%] md:top-[19px] md:h-1.5 md:w-auto" aria-hidden>
        <div className="route-fill-y md:route-fill-x size-full rounded-full bg-signal" />
      </div>
      <ol className="relative grid gap-9 md:grid-cols-4 md:gap-6">
        {STOPS.map((s, i) => {
          const t = (i / (STOPS.length - 1)) * 0.97;
          const lit = { "--t": t } as CSSProperties;
          return (
            <li key={s.title} className="flex gap-5 md:flex-col md:items-center md:gap-4 md:text-center" style={lit}>
              <span className="relative flex size-[50px] shrink-0 items-center justify-center rounded-full border-[5px] border-ink bg-paper md:size-11 md:border-4">
                <span
                  className="absolute inset-0.5 rounded-full bg-signal transition-transform duration-300 ease-[var(--ease-spring)]"
                  style={{ transform: "scale(clamp(0, calc((var(--p, 0) - var(--t)) * 14 + 0.0001), 1))" }}
                  aria-hidden
                />
                <span className="relative font-display text-[17px] font-black">{i + 1}</span>
              </span>
              <div className="pt-1.5 md:pt-0">
                <h3 className="font-display text-[22px] font-black leading-tight">{s.title}</h3>
                <p className="mt-1.5 max-w-[34ch] text-[15px] text-ink-2 md:mx-auto">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </ScrollProgress>
  );
}
