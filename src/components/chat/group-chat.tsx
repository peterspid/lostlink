"use client";

import { useLayoutEffect, useRef } from "react";
import { useConversation } from "@/components/chat/use-conversation";
import { MessageView } from "@/components/chat/message-view";
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
    <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border border-line-strong bg-paper" data-testid="group-chat">
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3">
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
            {convo.messages.map((m) => (
              <MessageView key={m.id} m={m} senderName={names.get(m.senderId) ?? (m.senderId.endsWith("lostlinkbot") ? "LostLink" : "Staff")} handlers={{}} />
            ))}
          </div>
        )}
      </div>
      <Composer onSend={(t) => void convo.sendText(t)} onImage={(f) => void convo.sendImage(f)} />
    </div>
  );
}
