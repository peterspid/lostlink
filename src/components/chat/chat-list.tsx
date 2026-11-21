"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Users } from "lucide-react";
import type { ClaimListEntry } from "@/lib/claim-view";
import { MSG } from "@/lib/nexconn/messages";
import { useChat, useChatEvents } from "@/components/chat/chat-provider";
import { EmptyState, LinkButton, StatusPill, cx } from "@/components/ui";
import { timeAgo } from "@/lib/time";

interface ChannelInfo {
  unread: number;
  preview: string;
  time: number;
}

interface DeskEntry {
  id: string;
  slug: string;
  name: string;
  groupId: string;
}

function previewOf(type: string, content: Record<string, unknown>): string {
  switch (type) {
    case "RC:TxtMsg":
      return String(content.text ?? content.content ?? "");
    case "RC:ImgMsg":
      return "Photo";
    case "RC:LBSMsg":
      return `Location: ${String(content.poi ?? "")}`;
    case MSG.CLAIM:
      return "Ownership claim";
    case MSG.RESULT:
      return content.approved ? "Ownership confirmed" : "Claim declined";
    case MSG.HANDOVER:
      return `Meeting plan: ${String(content.label ?? "")}`;
    case MSG.DESK:
      return String(content.title ?? "Desk update");
    default:
      return "New message";
  }
}

/**
 * Conversations: claim chats (Nexconn direct channels) and desk staff rooms (group
 * channels). Unread counts and previews come from the Nexconn channel list.
 */
export function ChatList({ claims, desks }: { claims: ClaimListEntry[]; desks: DeskEntry[] }) {
  const { sdk, status } = useChat();
  const [channels, setChannels] = useState<Map<string, ChannelInfo>>(new Map());

  const load = useCallback(async () => {
    if (!sdk || status !== "connected") return;
    const q = sdk.BaseChannel.createChannelsQuery({ pageSize: 50 });
    const res = await q.loadNextPage();
    if (res.code !== 0 || !res.data) return;
    const map = new Map<string, ChannelInfo>();
    for (const ch of res.data.data) {
      const m = ch.latestMessage;
      map.set(`${ch.channelType}:${ch.channelId}`, {
        unread: ch.unreadCount,
        preview: m ? previewOf(m.messageType, (m.content ?? {}) as Record<string, unknown>) : "",
        time: m?.sentTime ?? ch.operationTime,
      });
    }
    setChannels(map);
  }, [sdk, status]);

  useEffect(() => {
    // Loads the Nexconn channel list once connected; state is set after the async query resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useChatEvents((e) => {
    if (e.type === "message" || e.type === "synced") void load();
  });

  // Direct channels are per person pair; show the most recent claim for each pair with the channel's unread count.
  const seenPairs = new Set<string>();
  const rows = claims.map((c) => {
    const key = `1:${c.otherNexconnId}`;
    const info = channels.get(key);
    const first = !seenPairs.has(key);
    seenPairs.add(key);
    return { c, info: first ? info : undefined };
  });

  if (claims.length === 0 && desks.length === 0) {
    return (
      <EmptyState icon={<MessageSquare className="size-5" />} title="No conversations yet" action={<LinkButton href="/browse?kind=found">Browse found items</LinkButton>}>
        A private chat opens when you claim a found item, or when someone claims something you found. Nobody sees your phone number.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {desks.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Desk staff rooms</h2>
          <ul className="flex flex-col gap-2">
            {desks.map((d) => {
              const info = channels.get(`3:${d.groupId}`);
              return (
                <li key={d.id}>
                  <Link href={`/desks/${d.slug}/manage#staff-chat`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5 hover:border-ink">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-ink text-signal">
                      <Users className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{d.name} staff</span>
                      <span className="block truncate text-sm text-ink-2">{info?.preview || "Coordinate with your desk team"}</span>
                    </span>
                    {info && info.unread > 0 && <Unread n={info.unread} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {claims.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Claims</h2>
          <ul className="flex flex-col gap-2" data-testid="chat-list">
            {rows.map(({ c, info }) => (
              <li key={c.id}>
                <Link href={`/chats/${c.id}`} className={cx("flex items-center gap-3 rounded-lg border bg-surface p-3.5 hover:border-ink", info && info.unread > 0 ? "border-ink" : "border-line")} data-testid="chat-row">
                  {c.itemPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.itemPhoto} alt="" className="size-11 rounded-md border border-line object-cover" />
                  ) : (
                    <span className="flex size-11 items-center justify-center rounded-md bg-wash">
                      <MessageSquare className="size-5" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{c.otherName}</span>
                      <span className="shrink-0 text-xs text-ink-3">{c.role === "finder" ? "claims your find" : "found it"}</span>
                    </span>
                    <span className="block truncate text-sm text-ink-2">{info?.preview || c.itemTitle}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-xs text-ink-3">{info?.time ? timeAgo(new Date(info.time)) : timeAgo(c.createdAt)}</span>
                    {info && info.unread > 0 ? <Unread n={info.unread} /> : <StatusPill status={c.status} className="h-5 text-[11px]" />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Unread({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1.5 text-xs font-bold text-white" aria-label={`${n} unread`} data-testid="unread-badge">
      {n > 99 ? "99+" : n}
    </span>
  );
}
