import Link from "next/link";
import { Logo } from "@/components/logo";

const COLUMNS = [
  {
    title: "Lost & found",
    links: [
      { href: "/report?kind=lost", label: "Report a lost item" },
      { href: "/report?kind=found", label: "Report a found item" },
      { href: "/browse", label: "Browse the map" },
      { href: "/alerts", label: "Set an alert" },
    ],
  },
  {
    title: "For venues",
    links: [
      { href: "/desks/new", label: "Set up a desk" },
      { href: "/desks", label: "Your desks" },
    ],
  },
  {
    title: "LostLink",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/privacy", label: "Privacy and safety" },
    ],
  },
];

/** Closing signage band: what LostLink is, where to go next, and who carries the chat. */
export function SiteFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="on-ink mt-16 bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-12 md:grid-cols-[1.3fr_2fr]">
        <div>
          <Logo tone="paper" />
          <p className="mt-4 max-w-xs text-[15px] text-paper/70">
            The lost-property office in your pocket. Post it, match it, prove it, and hand it back without swapping phone numbers.
          </p>
          {!signedIn && (
            <Link href="/signup" className="mt-5 inline-flex h-11 items-center rounded-xl bg-signal px-4 font-display font-bold text-ink transition-colors hover:bg-signal-deep">
              Create a free account
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-display text-[15px] font-extrabold text-signal">{col.title}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[15px] text-paper/75 transition-colors hover:text-paper">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 pb-28 text-sm text-paper/55 md:pb-5">
          <p>Private chat, claim cards and live notices run on Nexconn.</p>
          <p>Locations on public posts are blurred to about 300 m.</p>
        </div>
      </div>
    </footer>
  );
}
