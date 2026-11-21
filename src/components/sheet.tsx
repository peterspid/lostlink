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
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/40 sm:m-auto sm:max-w-lg"
      aria-label={title}
    >
      {open && (
        <div className="animate-sheet max-h-[85dvh] overflow-y-auto rounded-t-[var(--radius-sheet)] border border-line bg-surface p-5 pb-[calc(1.25rem+var(--safe-bottom))] text-ink sm:rounded-[var(--radius-sheet)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-extrabold">{title}</h2>
            <button onClick={onClose} className="flex size-10 items-center justify-center rounded-lg hover:bg-wash" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
