import Link from "next/link";
import { ArrowDownRight, BellRing, CheckCheck, Handshake, Lock, MessagesSquare, ShieldCheck, Smartphone, UserX } from "lucide-react";
import { searchItems } from "@/lib/search";
import { ItemTag } from "@/components/item-tag";
import { LinkButton } from "@/components/ui";
import { LostPropertyBoard, type BoardRow } from "@/components/landing/board";
import { WayfindingSign } from "@/components/landing/wayfinding-sign";
import { RouteLine } from "@/components/landing/route-line";
import { ChatDemo } from "@/components/landing/chat-demo";
import { PrivacyTicket } from "@/components/landing/privacy-ticket";
import { DeskBand } from "@/components/landing/desk-band";

const CHAT_FEATURES = [
  { icon: MessagesSquare, title: "A private chat for every claim", text: "Owner and finder talk inside LostLink. Phone numbers and emails are never shared." },
  { icon: ShieldCheck, title: "Cards that update themselves", text: "Claim, result and meeting cards change on both phones the moment someone decides." },
  { icon: CheckCheck, title: "Read receipts and typing", text: "See when your message was read, so nobody is left wondering." },
  { icon: Handshake, title: "Meeting point and time", text: "Propose a busy public spot on the map. The other person accepts with one tap." },
  { icon: BellRing, title: "Live alerts", text: "Matches, claims and handover updates arrive while you browse and wait in your notifications." },
];

const SAFETY = [
  { icon: Lock, text: "Wrong answers are rate limited, so nobody can guess their way to your things." },
  { icon: UserX, text: "Block or report anyone from any chat, claim or post. Blocked people can't message you." },
  { icon: Smartphone, text: "Works in any phone browser. Add it to your home screen like an app." },
];

export default async function HomePage() {
  const [found, lost] = await Promise.all([
    searchItems({ kind: "found", limit: 6 }).catch(() => []),
    searchItems({ kind: "lost", limit: 4 }).catch(() => []),
  ]);
  // The board leads with handed-in items and tops up with lost reports when it's quiet.
  const board: BoardRow[] = (found.length >= 6 ? found : [...found, ...lost.slice(0, 6 - found.length)]).map((i) => ({
    id: i.id,
    code: i.code,
    kind: i.kind,
    title: i.title,
    placeLabel: i.placeLabel,
    deskName: i.deskName,
    occurredFrom: i.occurredFrom,
  }));

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-6 md:pb-20 md:pt-14">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-14">
          <div>
            <h1 className="text-[48px] font-black leading-[0.94] tracking-[-0.045em] sm:text-[64px] lg:text-[80px]">
              Lost it?
              <br />
              Found it?
              <br />
              <span className="inline-flex items-center gap-3">
                Start here.
                <span className="inline-flex size-[0.82em] items-center justify-center rounded-[0.18em] bg-signal" aria-hidden>
                  <ArrowDownRight className="size-[0.62em]" strokeWidth={3} />
                </span>
              </span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-[18px] leading-relaxed text-ink-2">
              Post in under a minute. LostLink matches lost and found reports, checks who the real owner is, and opens a private chat for the handover.
            </p>
            <div className="mt-7">
              <WayfindingSign />
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold text-ink-2">
              <li className="flex items-center gap-1.5">
                <CheckCheck className="size-4 text-go" aria-hidden /> Free for everyone
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCheck className="size-4 text-go" aria-hidden /> No phone numbers swapped
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCheck className="size-4 text-go" aria-hidden /> Browse without an account
              </li>
            </ul>
          </div>
          <LostPropertyBoard rows={board} />
        </div>
      </section>

      <section id="how" className="border-y border-line bg-surface py-16 md:py-24" aria-labelledby="how-h">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="how-h" className="max-w-2xl text-[34px] font-black leading-[1.02] md:text-[50px]">
            How things get back to their owners
          </h2>
          <p className="mt-3 max-w-xl text-[17px] text-ink-2">Four stops, usually within a day. You only ever deal with one other person.</p>
          <div className="mt-12 md:mt-16">
            <RouteLine />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" aria-labelledby="chat-h">
        <div className="grid items-center gap-12 md:grid-cols-[1fr_400px] md:gap-16">
          <div>
            <h2 id="chat-h" className="text-[34px] font-black leading-[1.02] md:text-[50px]">
              Arrange the handover without giving out your number
            </h2>
            <p className="mt-3 max-w-xl text-[17px] text-ink-2">
              Every approved claim opens a private chat, built on Nexconn&apos;s real-time messaging. It works the way a good lost-property counter does.
            </p>
            <ul className="mt-8 flex flex-col gap-5">
              {CHAT_FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-signal" aria-hidden>
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-display text-[18px] font-extrabold leading-snug">{title}</span>
                    <span className="block text-[15px] text-ink-2">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <ChatDemo />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24" aria-labelledby="privacy-h">
        <h2 id="privacy-h" className="max-w-2xl text-[34px] font-black leading-[1.02] md:text-[50px]">
          The details that prove it stay private
        </h2>
        <p className="mt-3 max-w-xl text-[17px] text-ink-2">
          Finders keep what&apos;s inside, serial numbers and the exact spot to themselves. The owner proves it&apos;s theirs by answering questions about them.
        </p>
        <div className="mt-10">
          <PrivacyTicket />
        </div>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {SAFETY.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-[15px] text-ink-2">
              <Icon className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </section>

      {lost.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24" aria-labelledby="looking-h">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="looking-h" className="text-[30px] font-black leading-tight md:text-[40px]">
                People are looking for
              </h2>
              <p className="mt-1 text-ink-2">Seen one of these? Post it as found and LostLink connects you.</p>
            </div>
            <Link href="/browse?kind=lost" className="font-display font-bold underline decoration-signal decoration-[3px] underline-offset-4 hover:decoration-ink">
              See all lost reports
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {lost.map((i) => (
              <ItemTag key={i.id} item={i} />
            ))}
          </div>
          <LinkButton href="/report?kind=found" variant="signal" className="mt-6">
            I found something
          </LinkButton>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-4">
        <DeskBand />
      </div>
    </div>
  );
}
