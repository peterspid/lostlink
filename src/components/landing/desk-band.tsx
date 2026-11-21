import QRCode from "qrcode";
import { Building2, MessagesSquare, Printer, ScanLine } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { appUrl } from "@/lib/env";

const POINTS = [
  { icon: ScanLine, text: "A public page and a printable QR poster for the counter" },
  { icon: Building2, text: "An inventory that matches itself against lost reports" },
  { icon: MessagesSquare, text: "A private staff chat where new items and claims post automatically" },
  { icon: Printer, text: "Reference codes for shelf labels, A4 PDF ready to print" },
];

/** For venues: a desk sign in wayfinding yellow, with a real, scannable mini poster. */
export async function DeskBand() {
  const qr = await QRCode.toString(`${appUrl()}/desks/new`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#10243a", light: "#ffffff" } });
  return (
    <section className="overflow-hidden rounded-[32px] bg-signal text-ink" aria-labelledby="desk-h">
      <div className="grid items-center gap-10 p-6 md:grid-cols-[1.2fr_1fr] md:p-12">
        <div>
          <h2 id="desk-h" className="text-[34px] font-black leading-[1.02] md:text-[48px]">
            Run a lost &amp; found desk?
          </h2>
          <p className="mt-3 max-w-lg text-[17px] text-ink/80">
            Campuses, malls, stations and events get everything a lost-property office needs, set up in two minutes.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-[16px]">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-signal" aria-hidden>
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <LinkButton href="/desks/new" size="lg" className="mt-8">
            Set up a desk
          </LinkButton>
        </div>
        <div className="flex justify-center" aria-hidden>
          <div className="w-[250px] rotate-[3deg] overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-24px_rgb(16_36_58/0.55)] transition-transform duration-500 ease-[var(--ease-out-soft)] hover:rotate-0 md:w-[280px]">
            <div className="bg-signal px-5 pb-4 pt-5 [box-shadow:inset_0_-3px_0_rgb(16_36_58/0.12)]">
              <p className="font-display text-[26px] font-black leading-[1.02]">Lost something here?</p>
              <p className="mt-2 font-display text-[15px] font-extrabold">Central Library Desk</p>
            </div>
            <div className="flex flex-col items-center px-5 pb-5 pt-5">
              <div className="rounded-xl border-[3px] border-ink p-3 [&_svg]:block [&_svg]:size-[150px]" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-4 text-center font-display text-[15px] font-extrabold leading-tight">Scan to see what&apos;s been handed in</p>
            </div>
            <div className="flex items-center gap-2 bg-ink px-5 py-3 text-paper">
              <span className="size-4 rounded-[4px] bg-signal" />
              <span className="font-display text-[15px] font-black">LostLink</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
