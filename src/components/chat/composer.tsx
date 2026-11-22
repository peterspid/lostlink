"use client";

import { useRef, useState } from "react";
import { ImagePlus, Lock, MapPin, SendHorizontal } from "lucide-react";
import { resizeImage } from "@/lib/image-resize";
import { cx } from "@/components/ui";

const iconButton = "flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-wash hover:text-ink active:scale-95";

export function Composer({
  disabled,
  disabledReason,
  onSend,
  onImage,
  onLocation,
  onTyping,
  locationLabel = "Propose a meeting point",
}: {
  disabled?: boolean;
  disabledReason?: string;
  onSend: (text: string) => void;
  onImage?: (file: File) => void;
  onLocation?: () => void;
  onTyping?: () => void;
  locationLabel?: string;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function grow() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function send() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t.slice(0, 2000));
    setText("");
    requestAnimationFrame(grow);
    areaRef.current?.focus();
  }

  if (disabled) {
    return (
      <div className="flex items-center justify-center gap-2 border-t border-line bg-surface px-4 py-4 text-center text-[15px] text-ink-2" style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}>
        <Lock className="size-4 shrink-0" aria-hidden />
        {disabledReason}
      </div>
    );
  }

  const ready = !!text.trim();
  return (
    <div className="border-t border-line bg-surface/95 px-2 py-2 backdrop-blur" style={{ paddingBottom: "calc(0.5rem + var(--safe-bottom))" }}>
      <div className="flex items-end gap-1">
        {onImage && (
          <>
            <button type="button" className={iconButton} aria-label="Send a photo" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="chat-image-input"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const small = await resizeImage(f, 1280, 0.8).catch(() => f);
                onImage(small);
              }}
            />
          </>
        )}
        {onLocation && (
          <button type="button" className={iconButton} aria-label={locationLabel} onClick={onLocation} data-testid="propose-handover">
            <MapPin className="size-5" />
          </button>
        )}
        <label className="sr-only" htmlFor="composer">
          Message
        </label>
        <textarea
          id="composer"
          ref={areaRef}
          rows={1}
          value={text}
          placeholder="Write a message"
          enterKeyHint="send"
          onChange={(e) => {
            setText(e.target.value);
            grow();
            onTyping?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-line-strong bg-paper px-4 py-2.5 text-[16px] leading-snug transition-[border-color,box-shadow] focus:border-ink focus:outline-none focus:ring-4 focus:ring-signal/30"
          data-testid="composer"
        />
        <button
          type="button"
          onClick={send}
          disabled={!ready}
          className={cx(
            "flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200",
            ready ? "scale-100 bg-ink text-signal active:scale-90" : "scale-90 bg-wash text-ink-3",
          )}
          aria-label="Send"
          data-testid="send"
        >
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </div>
  );
}
