"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarClock, CheckCheck, Handshake, PackageCheck, Radar, ShieldCheck, Sparkles, Users } from "lucide-react";
import { api } from "@/lib/client-api";
import { useChatEvents } from "@/components/chat/chat-provider";
import { Button, EmptyState, cx } from "@/components/ui";
import { timeAgo } from "@/lib/time";

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
}

const ICON: Record<string, typeof Bell> = {
  match: Sparkles,
  alert: Radar,
  claim: ShieldCheck,
  decision: ShieldCheck,
  handover: Handshake,
  returned: PackageCheck,
  expiry: CalendarClock,
  desk: Users,
};

/** Pictogram plate colour per kind: wins in green, things needing action in yellow. */
const TONE: Record<string, string> = {
  match: "bg-signal text-ink",
  alert: "bg-signal text-ink",
  claim: "bg-ink text-signal",
  decision: "bg-go text-white",
  handover: "bg-ink text-signal",
  returned: "bg-go text-white",
  expiry: "bg-wash text-ink",
  desk: "bg-ink text-signal",
};

function dayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return "Earlier";
}

export function NotificationList({ initial }: { initial: NotificationRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const unread = rows.filter((r) => !r.readAt).length;

  useChatEvents(async (e) => {
    if (e.type !== "notice") return;
    const data = await api<{ notifications: NotificationRow[] }>("/api/notifications").catch(() => null);
    if (data) setRows(data.notifications);
  });

  async function markAll() {
    setBusy(true);
    await api("/api/notifications", { body: { all: true } }).catch(() => undefined);
    setRows((r) => r.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setBusy(false);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState icon={<Bell />} title="You're all caught up">
        Matches for your posts, alert hits, claims and handover updates show up here, and as live notices while you&apos;re using LostLink.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-2">{unread ? `${unread} unread` : "All read"}</p>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={markAll} loading={busy} icon={<CheckCheck className="size-4" aria-hidden />}>
            Mark all as read
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-7" data-testid="notifications">
        {(["Today", "Yesterday", "Earlier"] as const).map((group) => {
          const list = rows.filter((n) => dayGroup(n.createdAt) === group);
          if (list.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="mb-2.5 font-display text-[15px] font-extrabold text-ink-2">{group}</h2>
              <ul className="flex flex-col gap-2">
                {list.map((n, i) => {
                  const Icon = ICON[n.kind] ?? Bell;
                  return (
                    <li key={n.id} className="animate-rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                      <Link
                        href={n.href}
                        onClick={() => {
                          if (!n.readAt) void api("/api/notifications", { body: { ids: [n.id] } }).catch(() => undefined);
                        }}
                        className={cx(
                          "flex items-start gap-3 rounded-2xl border bg-surface p-4 transition-[border-color,box-shadow] hover:shadow-[var(--shadow-lift)]",
                          n.readAt ? "border-line hover:border-ink/50" : "border-ink",
                        )}
                        data-testid="notification"
                        data-kind={n.kind}
                      >
                        <span className={cx("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", n.readAt ? "bg-wash text-ink-2" : (TONE[n.kind] ?? "bg-signal text-ink"))}>
                          <Icon className="size-[18px]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cx("block font-display leading-snug", n.readAt ? "font-bold" : "font-extrabold")}>{n.title}</span>
                          <span className="mt-0.5 block text-[15px] text-ink-2">{n.body}</span>
                          <span className="mt-1 block text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
                        </span>
                        {!n.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-alert" aria-label="Unread" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
