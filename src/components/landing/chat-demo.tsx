"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ImagePlus, MapPin, SendHorizontal } from "lucide-react";
import { MSG } from "@/lib/nexconn/messages";
import type { ChatMessage } from "@/components/chat/use-conversation";
import { MessageView } from "@/components/chat/message-view";
import { Reveal } from "@/components/motion";
import { Avatar } from "@/components/ui";

const ME = "demo-asha";
const THEM = "demo-bilal";

function script(approved: boolean): ChatMessage[] {
  const base = Date.now() - 40 * 60_000;
  const at = new Date();
  at.setHours(17, 0, 0, 0);
  const msg = (i: number, m: Omit<ChatMessage, "id" | "sentTime" | "status" | "metadata"> & { metadata?: Record<string, string> }): ChatMessage => ({
    id: `demo-${i}`,
    sentTime: base + i * 3 * 60_000,
    status: "sent",
    metadata: {},
    ...m,
  });
  return [
    msg(0, {
      type: MSG.CLAIM,
      senderId: ME,
      mine: true,
      content: { claimId: "demo", itemId: "demo", itemCode: "K7Q3F", itemTitle: "Black leather wallet", claimantName: "Asha", questionCount: 2 },
      metadata: { status: approved ? "approved" : "pending" },
    }),
    msg(1, { type: MSG.RESULT, senderId: THEM, mine: false, content: { claimId: "demo", itemCode: "K7Q3F", itemTitle: "Black leather wallet", approved: true } }),
    msg(2, { type: "RC:TxtMsg", senderId: THEM, mine: false, content: { text: "Hi Asha! It's safe with me. I'm near Block A until 6." } }),
    msg(3, { type: "RC:TxtMsg", senderId: ME, mine: true, read: true, content: { text: "Thank you so much! Could we meet at the café by the main gate at 5?" } }),
    msg(4, {
      type: MSG.HANDOVER,
      senderId: ME,
      mine: true,
      content: { claimId: "demo", itemCode: "K7Q3F", label: "Café by the main gate", lat: 28.6315, lng: 77.2167, at: at.toISOString(), proposedByName: "Asha" },
      metadata: { status: "accepted" },
    }),
  ];
}

/**
 * A scripted claim chat built from the real chat components. It plays once when scrolled
 * into view: the claim is approved, messages arrive, the meeting plan is confirmed.
 * Messages render on the client only, so times never mismatch the server render.
 */
export function ChatDemo() {
  const [step, setStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const total = 5;

  const play = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(total + 1);
      return;
    }
    for (let i = 1; i <= total + 1; i++) timers.current.push(setTimeout(() => setStep(i), 350 + i * 900));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const messages = script(step >= 2).slice(0, Math.min(step, total));
  const typing = step >= 2 && step <= total;

  return (
    <Reveal onShow={play} threshold={0.35} className="mx-auto w-full max-w-[360px]">
      <div className="relative overflow-hidden rounded-[44px] border-[10px] border-ink bg-paper shadow-[var(--shadow-float)]" aria-label="Example claim chat" role="img">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" aria-hidden />
        <div className="flex items-center gap-2.5 border-b border-line bg-surface px-3 pb-2.5 pt-8">
          <ArrowLeft className="size-5 text-ink-2" aria-hidden />
          <Avatar name="Bilal" size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-display text-[15px] font-extrabold">
              Bilal <span className="text-[13px] font-semibold text-ink-3">found it</span>
            </p>
            <p className="truncate text-[12px] text-ink-2">{typing ? <span className="font-bold text-go">typing…</span> : <><span className="ref-code">K7Q3F</span> Black leather wallet</>}</p>
          </div>
        </div>
        <div className="flex h-[440px] flex-col justify-end gap-3 overflow-hidden px-3 py-4" aria-hidden>
          {messages.map((m) => (
            <div key={m.id} className="animate-rise" style={{ "--i": 0 } as CSSProperties}>
              <MessageView m={m} handlers={{ claimStatus: step >= 2 ? "approved" : "pending", role: "owner", myUserId: ME }} />
            </div>
          ))}
          {typing && (
            <div className="animate-rise flex w-fit items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 border-t border-line bg-surface px-2.5 py-2.5" aria-hidden>
          <ImagePlus className="size-5 text-ink-3" />
          <MapPin className="size-5 text-ink-3" />
          <span className="flex-1 rounded-xl border border-line-strong bg-paper px-3 py-2 text-sm text-ink-3">Write a message</span>
          <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-paper">
            <SendHorizontal className="size-4" />
          </span>
        </div>
      </div>
    </Reveal>
  );
}
