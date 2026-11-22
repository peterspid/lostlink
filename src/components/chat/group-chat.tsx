"use client";

import { useLayoutEffect, useRef } from "react";
import { Users } from "lucide-react";
import { useConversation } from "@/components/chat/use-conversation";
import { DayDivider, MessageView, withDayDividers } from "@/components/chat/message-view";
import { Composer } from "@/components/chat/composer";
import { useChat } from "@/components/chat/chat-provider";
import { Banner, Button, Spinner } from "@/components/ui";

/** Desk staff room: a Nexconn group channel with the team and LostLink bot notices. */
export function GroupChat({ groupId, members }: { groupId: string; members: { nexconnId: string; name: string }[] }) {
  const { status } = useChat();
  const convo = useConversation("group", groupId);
  const names = new Map(members.map((m) => [m.nexconnId, m.name.split(" ")[0]]));
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convo.messages.length]);

  return (
    <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-line-strong bg-paper shadow-[var(--shadow-lift)]" data-testid="group-chat">
      <div className="flex items-center gap-2.5 border-b border-line bg-surface px-3.5 py-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-signal">
          <Users className="size-4" aria-hidden />
        </span>
        <span className="font-display text-[15px] font-bold">Staff room</span>
        <span className="text-sm text-ink-3">
          {members.length} member{members.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-ink-3">
          <span className={status === "connected" ? "size-2 rounded-full bg-go" : "size-2 animate-pulse rounded-full bg-signal-deep"} aria-hidden />
          {status === "connected" ? "Live" : "Connecting"}
        </span>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {convo.hasMore && (
          <div className="mb-2 flex justify-center">
            <Button size="sm" variant="outline" onClick={() => void convo.loadEarlier()}>
              Load earlier
            </Button>
          </div>
        )}
        {convo.loading && status !== "error" && convo.messages.length === 0 ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading staff chat" />
          </div>
        ) : convo.error ? (
          <Banner tone="error">{convo.error}</Banner>
        ) : convo.messages.length === 0 ? (
          <p className="py-8 text-center text-ink-3">No messages yet. Say hello to your team.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {withDayDividers(convo.messages).map((row) =>
              row.kind === "day" ? (
                <DayDivider key={row.id} label={row.label} />
              ) : (
                <MessageView
                  key={row.m.id}
                  m={row.m}
                  senderName={names.get(row.m.senderId) ?? (row.m.senderId.endsWith("lostlinkbot") ? "LostLink" : "Staff")}
                  handlers={{}}
                />
              ),
            )}
          </div>
        )}
      </div>
      <Composer onSend={(t) => void convo.sendText(t)} onImage={(f) => void convo.sendImage(f)} />
    </div>
  );
}
