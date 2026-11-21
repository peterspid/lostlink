"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
}

const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Station-board clock. Renders nothing on the server so there's no hydration mismatch. */
export function BoardClock() {
  const time = useSyncExternalStore(subscribe, now, () => "");
  return (
    <span className="ref-code min-w-[3.2em] text-right text-[15px] text-signal tabular-nums" aria-hidden>
      {time}
    </span>
  );
}
