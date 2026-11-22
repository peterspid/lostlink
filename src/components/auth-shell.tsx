import type { ReactNode } from "react";
import { BellRing, Lock, MessagesSquare, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/logo";

const POINTS = [
  { icon: BellRing, text: "Get matched the moment someone posts your item" },
  { icon: ShieldCheck, text: "Owners prove it with private questions" },
  { icon: MessagesSquare, text: "Arrange the handover in a private chat" },
  { icon: Lock, text: "Your phone number and email stay private" },
];

/** Sign-in and sign-up frame: the form, and on wide screens a signage panel saying why. */
export function AuthShell({ title, lede, children }: { title: string; lede: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-[1fr_1fr] md:items-center md:py-16 lg:gap-16">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-[36px] font-black leading-[1.02] md:text-[44px]">{title}</h1>
        <p className="mt-3 text-[17px] text-ink-2">{lede}</p>
        <div className="mt-8">{children}</div>
      </div>
      <aside className="on-ink relative hidden overflow-hidden rounded-[32px] bg-ink p-10 text-paper shadow-[var(--shadow-float)] md:block" aria-label="Why LostLink">
        <LogoMark size={64} className="text-paper" />
        <p className="mt-6 max-w-sm font-display text-[30px] font-black leading-[1.08]">Things get handed in every day. The hard part is finding each other.</p>
        <ul className="mt-8 flex flex-col gap-4">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[16px] text-paper/85">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-signal text-ink" aria-hidden>
                <Icon className="size-[18px]" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
