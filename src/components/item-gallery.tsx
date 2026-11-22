"use client";

import { useState, ViewTransition } from "react";
import { Expand } from "lucide-react";
import { CategoryIcon, photoTransitionName } from "@/components/item-tag";
import { cx } from "@/components/ui";

/** Item photos: a large hero (the morph target from list thumbnails) and a thumbnail strip. */
export function ItemGallery({ id, title, photos, category, kind }: { id: string; title: string; photos: string[]; category: string; kind: "lost" | "found" }) {
  const [active, setActive] = useState(0);
  if (photos.length === 0) {
    return (
      <div className={cx("flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-3xl border border-line", kind === "found" ? "bg-signal-soft" : "bg-wash")}>
        <CategoryIcon category={category} className="size-12 text-ink/70" />
        <p className="text-sm text-ink-3">No photo yet</p>
      </div>
    );
  }
  const src = photos[active] ?? photos[0];
  return (
    <div>
      <ViewTransition name={photoTransitionName(id)} share="morph" default="none">
        <a href={src} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-3xl border border-line bg-wash">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={src} src={src} alt={`${title}, photo ${active + 1}`} className="animate-rise aspect-[4/3] w-full object-cover" />
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-semibold text-paper opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            <Expand className="size-3.5" aria-hidden /> Full size
          </span>
        </a>
      </ViewTransition>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2" role="tablist" aria-label="Photos">
          {photos.map((p, i) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Photo ${i + 1}`}
              onClick={() => setActive(i)}
              className={cx("overflow-hidden rounded-xl border-2 transition-[border-color,opacity]", i === active ? "border-ink" : "border-transparent opacity-70 hover:opacity-100")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="size-16 object-cover sm:size-20" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
