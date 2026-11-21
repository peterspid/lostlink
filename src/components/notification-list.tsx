"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarClock, Handshake, PackageCheck, Radar, ShieldCheck, Sparkles, Users } from "lucide-react";
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
      <EmptyState icon={<Bell className="size-5" />} title="You're all caught up">
        Matches for your posts, alert hits, claims and handover updates show up here, and as live notices while you&apos;re using LostLink.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-2">{unread ? `${unread} unread` : "All read"}</p>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={markAll} loading={busy}>
            Mark all as read
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2" data-testid="notifications">
        {rows.map((n) => {
          const Icon = ICON[n.kind] ?? Bell;
          return (
            <li key={n.id}>
              <Link
                href={n.href}
                onClick={() => {
                  if (!n.readAt) void api("/api/notifications", { body: { ids: [n.id] } }).catch(() => undefined);
                }}
                className={cx("flex items-start gap-3 rounded-lg border bg-surface p-3.5 hover:border-ink", n.readAt ? "border-line" : "border-ink")}
                data-testid="notification"
                data-kind={n.kind}
              >
                <span className={cx("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md", n.readAt ? "bg-wash" : "bg-signal")}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{n.title}</span>
                  <span className="block text-[15px] text-ink-2">{n.body}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-alert" aria-label="Unread" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
