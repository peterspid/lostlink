"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bell, CircleUserRound, Map as MapIcon, MessageSquare, Plus, Radar, WifiOff } from "lucide-react";
import { ChatProvider, useChat, useChatEvents } from "@/components/chat/chat-provider";
import type { NoticeContent } from "@/lib/nexconn/messages";
import { cx } from "@/components/ui";
import { Logo } from "@/components/logo";

export interface ShellUser {
  id: string;
  name: string;
}

export function AppShell({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return (
    <ChatProvider enabled={!!user}>
      <ShellInner user={user}>{children}</ShellInner>
    </ChatProvider>
  );
}

const NAV = [
  { href: "/browse", label: "Browse", icon: MapIcon },
  { href: "/report", label: "Report", icon: Plus },
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/alerts", label: "Alerts", icon: Radar },
  { href: "/profile", label: "You", icon: CircleUserRound },
];

function ShellInner({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { totalUnread, status, retry } = useChat();
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [toast, setToast] = useState<NoticeContent | null>(null);

  const loadNotices = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/notifications", { credentials: "same-origin" }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { unread: number };
      setUnreadNotices(data.unread);
    }
  }, [user]);

  useEffect(() => {
    // Initial load; the setState happens after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotices();
  }, [loadNotices, pathname]);

  useChatEvents((e) => {
    if (e.type === "notice") {
      setToast(e.notice);
      void loadNotices();
      router.refresh();
    }
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const immersive = pathname.startsWith("/chats/") || pathname.startsWith("/report");

  return (
    <div className="flex min-h-dvh flex-col" data-chat-status={user ? status : "signed-out"}>
      <header className="sticky top-0 z-[1100] border-b border-line bg-paper/95 backdrop-blur-0">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 rounded-md" aria-label="LostLink home">
            <Logo />
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  "relative rounded-md px-3 py-2 text-[15px] font-semibold",
                  pathname.startsWith(n.href) ? "bg-ink text-paper" : "text-ink-2 hover:bg-wash hover:text-ink",
                )}
              >
                {n.label}
                {n.href === "/chats" && totalUnread > 0 && <Badge n={totalUnread} className="ml-1.5" />}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {user ? (
              <Link
                href="/notifications"
                className="relative flex size-11 items-center justify-center rounded-lg text-ink hover:bg-wash"
                aria-label={unreadNotices ? `Notifications, ${unreadNotices} unread` : "Notifications"}
              >
                <Bell className="size-[22px]" aria-hidden />
                {unreadNotices > 0 && <Badge n={unreadNotices} className="absolute right-1 top-1" />}
              </Link>
            ) : (
              <>
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-wash">
                  Sign in
                </Link>
                <Link href={`/signup?next=${encodeURIComponent(pathname)}`} className="hidden rounded-lg bg-ink px-3 py-2 text-[15px] font-semibold text-paper sm:block">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
        {user && (status === "offline" || status === "reconnecting" || status === "error" || status === "kicked") && (
          <div className="border-t border-line bg-surface">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 text-sm text-ink-2" role="status">
              <WifiOff className="size-4" aria-hidden />
              {status === "offline" && "You're offline. Messages will send when you reconnect."}
              {status === "reconnecting" && "Reconnecting to chat…"}
              {status === "error" && (
                <>
                  Chat couldn&apos;t connect.
                  <button className="font-semibold text-ink underline" onClick={retry}>
                    Try again
                  </button>
                </>
              )}
              {status === "kicked" && (
                <>
                  Chat is open on another device.
                  <button className="font-semibold text-ink underline" onClick={retry}>
                    Use it here
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[1200] flex justify-center px-4">
          <Link
            href={toast.href}
            onClick={() => setToast(null)}
            className="animate-toast pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-ink bg-surface p-3.5 shadow-[0_6px_24px_rgba(28,39,51,0.18)]"
            role="status"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-signal">
              <Bell className="size-4 text-ink" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{toast.title}</span>
              <span className="line-clamp-2 block text-sm text-ink-2">{toast.body}</span>
            </span>
          </Link>
        </div>
      )}

      <main className={cx("flex-1", !immersive && "pb-24 md:pb-10")}>{children}</main>

      {!immersive && (
        <nav
          className="fixed inset-x-0 bottom-0 z-[1100] border-t border-line bg-surface md:hidden"
          style={{ paddingBottom: "var(--safe-bottom)" }}
          aria-label="Main"
        >
          <ul className="grid grid-cols-5">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={cx("relative flex h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold", active ? "text-ink" : "text-ink-3")}
                    aria-current={active ? "page" : undefined}
                  >
                    {n.href === "/report" ? (
                      <span className="flex size-9 items-center justify-center rounded-lg bg-signal text-ink">
                        <Icon className="size-5" aria-hidden />
                      </span>
                    ) : (
                      <Icon className="size-[22px]" aria-hidden strokeWidth={active ? 2.4 : 2} />
                    )}
                    {n.href !== "/report" && n.label}
                    {n.href === "/report" && <span className="sr-only">{n.label}</span>}
                    {active && n.href !== "/report" && <span className="absolute top-0 h-[3px] w-8 rounded-b bg-ink" />}
                    {n.href === "/chats" && totalUnread > 0 && <Badge n={totalUnread} className="absolute right-[22%] top-2" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

function Badge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cx("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-alert px-1 text-[11px] font-bold leading-none text-white", className)}
      aria-hidden
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
