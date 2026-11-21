"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CalendarClock,
  CircleUserRound,
  Handshake,
  Map as MapIcon,
  MessageSquare,
  PackageCheck,
  Plus,
  Radar,
  ShieldCheck,
  Sparkles,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { ChatProvider, useChat, useChatEvents } from "@/components/chat/chat-provider";
import type { NoticeContent } from "@/lib/nexconn/messages";
import { Avatar, cx } from "@/components/ui";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

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

const DESKTOP_NAV = [
  { href: "/browse", label: "Browse" },
  { href: "/chats", label: "Chats" },
  { href: "/alerts", label: "Alerts" },
  { href: "/desks", label: "Desks" },
];

const MOBILE_NAV = [
  { href: "/browse", label: "Browse", icon: MapIcon },
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/report", label: "Report", icon: Plus },
  { href: "/alerts", label: "Alerts", icon: Radar },
  { href: "/profile", label: "You", icon: CircleUserRound },
];

export const NOTICE_ICON: Record<string, LucideIcon> = {
  match: Sparkles,
  alert: Radar,
  claim: ShieldCheck,
  decision: ShieldCheck,
  handover: Handshake,
  returned: PackageCheck,
  expiry: CalendarClock,
  desk: Building2,
};

function ShellInner({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { totalUnread, status, retry } = useChat();
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [toast, setToast] = useState<NoticeContent | null>(null);
  const [scrolled, setScrolled] = useState(false);

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

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 4));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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

  // The claim chat room is a full-screen app view on phones: it brings its own header.
  const chatRoom = /^\/chats\/[^/]+$/.test(pathname);
  const immersive = chatRoom || pathname.startsWith("/report");
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const showStatus = user && (status === "offline" || status === "reconnecting" || status === "error" || status === "kicked");

  return (
    <div className="flex min-h-dvh flex-col" data-chat-status={user ? status : "signed-out"}>
      <a href="#main" className="sr-only z-[1300] rounded-lg bg-ink px-4 py-2 font-semibold text-paper focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header
        className={cx(
          "sticky top-0 z-[1100] h-[var(--header-h)] border-b bg-paper/85 backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow] duration-200",
          scrolled ? "border-line shadow-[0_6px_20px_-14px_rgb(16_36_58/0.35)]" : "border-transparent",
          chatRoom && "hidden md:block",
        )}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center gap-2 px-4">
          <Link href="/" className="group -ml-1 flex items-center rounded-lg px-1 py-1" aria-label="LostLink home">
            <Logo />
          </Link>
          <nav className="ml-6 hidden h-full items-center gap-1 md:flex" aria-label="Main">
            {DESKTOP_NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={cx(
                  "relative flex h-full items-center px-3 font-display text-[15px] font-bold transition-colors",
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:origin-left after:rounded-t after:bg-signal after:transition-transform after:duration-300",
                  active(n.href) ? "text-ink after:scale-x-100" : "text-ink-2 after:scale-x-0 hover:text-ink",
                )}
              >
                {n.label}
                {n.href === "/chats" && totalUnread > 0 && <Badge n={totalUnread} className="ml-1.5" />}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {user ? (
              <>
                <Link
                  href="/report"
                  className="hidden h-10 items-center gap-1.5 rounded-xl bg-signal px-3.5 font-display text-[15px] font-bold text-ink shadow-[var(--shadow-key)] transition-colors hover:bg-signal-deep md:inline-flex"
                >
                  <Plus className="size-4" strokeWidth={2.8} aria-hidden /> Report an item
                </Link>
                <Link
                  href="/notifications"
                  className={cx("relative flex size-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-wash", active("/notifications") && "bg-wash")}
                  aria-label={unreadNotices ? `Notifications, ${unreadNotices} unread` : "Notifications"}
                >
                  <Bell className={cx("size-[22px]", unreadNotices > 0 && "origin-top animate-[sway_900ms_ease-out]")} aria-hidden />
                  {unreadNotices > 0 && <Badge n={unreadNotices} className="absolute right-1 top-1" />}
                </Link>
                <Link href="/profile" className="hidden rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-signal md:block" aria-label="Your profile">
                  <Avatar name={user.name} size="sm" />
                </Link>
              </>
            ) : (
              <>
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="rounded-xl px-3 py-2 font-display text-[15px] font-bold text-ink hover:bg-wash">
                  Sign in
                </Link>
                <Link
                  href={`/signup?next=${encodeURIComponent(pathname)}`}
                  className="hidden rounded-xl bg-ink px-3.5 py-2 font-display text-[15px] font-bold text-paper transition-colors hover:bg-night sm:block"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {showStatus && (
        <div className={cx("pointer-events-none fixed inset-x-0 z-[1150] flex justify-center px-4", chatRoom ? "top-2 md:top-[calc(var(--header-h)+8px)]" : "top-[calc(var(--header-h)+8px)]")}>
          <div className="animate-toast pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-[var(--shadow-float)]" role="status">
            <WifiOff className="size-4 text-signal" aria-hidden />
            {status === "offline" && "You're offline. Messages send when you reconnect."}
            {status === "reconnecting" && "Reconnecting to chat…"}
            {status === "error" && (
              <>
                Chat couldn&apos;t connect.
                <button className="font-bold text-signal underline underline-offset-2" onClick={retry}>
                  Try again
                </button>
              </>
            )}
            {status === "kicked" && (
              <>
                Chat is open on another device.
                <button className="font-bold text-signal underline underline-offset-2" onClick={retry}>
                  Use it here
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <NoticeToast notice={toast} onClose={() => setToast(null)} />}

      <main id="main" className="flex-1">
        {children}
      </main>

      {!immersive && <SiteFooter signedIn={!!user} />}

      {!immersive && (
        <nav
          className="fixed inset-x-0 bottom-0 z-[1100] border-t border-line bg-surface/95 backdrop-blur-md md:hidden"
          style={{ paddingBottom: "var(--safe-bottom)" }}
          aria-label="Main"
        >
          <ul className="grid grid-cols-5">
            {MOBILE_NAV.map((n) => {
              const on = active(n.href);
              const Icon = n.icon;
              if (n.href === "/report") {
                return (
                  <li key={n.href} className="flex justify-center">
                    <Link
                      href={n.href}
                      className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-signal text-ink shadow-[0_10px_24px_-10px_rgb(16_36_58/0.55),var(--shadow-key)] ring-4 ring-paper transition-transform active:scale-95"
                      aria-label="Report an item"
                    >
                      <Icon className="size-7" strokeWidth={2.6} aria-hidden />
                    </Link>
                  </li>
                );
              }
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={cx("relative flex h-16 flex-col items-center justify-center gap-1 font-display text-[12px] font-bold transition-colors", on ? "text-ink" : "text-ink-3")}
                    aria-current={on ? "page" : undefined}
                  >
                    <span className={cx("flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200", on && "bg-ink text-signal")}>
                      <Icon className="size-[20px]" aria-hidden strokeWidth={on ? 2.5 : 2} />
                    </span>
                    {n.label}
                    {n.href === "/chats" && totalUnread > 0 && <Badge n={totalUnread} className="absolute right-[18%] top-1.5" />}
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

function NoticeToast({ notice, onClose }: { notice: NoticeContent; onClose: () => void }) {
  const Icon = NOTICE_ICON[notice.kind] ?? Bell;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--header-h)+10px)] z-[1200] flex justify-center px-4">
      <div className="animate-toast pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl bg-ink text-paper shadow-[var(--shadow-float)]" role="status">
        <Link href={notice.href} onClick={onClose} className="flex items-start gap-3 p-4 pr-12">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-signal text-ink">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-display font-bold leading-snug">{notice.title}</span>
            <span className="mt-0.5 line-clamp-2 block text-sm text-paper/75">{notice.body}</span>
          </span>
        </Link>
        <button onClick={onClose} className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-lg text-paper/70 hover:bg-white/10 hover:text-paper" aria-label="Dismiss">
          <X className="size-4" />
        </button>
        <span className="absolute inset-x-0 bottom-0 h-1 origin-left animate-[toast-timer_7s_linear_forwards] bg-signal" aria-hidden />
      </div>
    </div>
  );
}

function Badge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      key={n}
      className={cx("animate-pop inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-alert px-1 text-[11px] font-bold leading-none text-white ring-2 ring-paper", className)}
      aria-hidden
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
