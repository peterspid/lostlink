"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Bottom sheet on phones, centred dialog on larger screens. Uses the native <dialog> for focus trapping. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-lg"
      aria-label={title}
    >
      {open && (
        <div className="animate-sheet max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-sheet)] bg-surface p-5 pb-[calc(1.25rem+var(--safe-bottom))] text-ink shadow-[var(--shadow-float)] sm:rounded-[var(--radius-sheet)]">
          <div className="mx-auto -mt-1.5 mb-3 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-[22px] font-black">{title}</h2>
            <button onClick={onClose} className="flex size-10 items-center justify-center rounded-xl hover:bg-wash" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
