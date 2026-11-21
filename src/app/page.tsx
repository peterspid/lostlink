import Link from "next/link";
import { ArrowUpRight, Building2, Plus, Search } from "lucide-react";
import { searchItems } from "@/lib/search";
import { ItemTag } from "@/components/item-tag";
import { EmptyState, LinkButton } from "@/components/ui";

export default async function HomePage() {
  const [found, lost] = await Promise.all([
    searchItems({ kind: "found", limit: 6 }).catch(() => []),
    searchItems({ kind: "lost", limit: 4 }).catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="pb-8 pt-8 md:pt-14">
        <h1 className="max-w-3xl text-[40px] font-black leading-[1.02] tracking-tight md:text-[64px]">Lost it? Found it? Start here.</h1>
        <p className="mt-4 max-w-xl text-lg text-ink-2">
          Post in under a minute. LostLink matches lost and found reports, checks who the real owner is, and lets you arrange the handover in a private chat.
        </p>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          <Link
            href="/report?kind=lost"
            className="group flex min-h-[132px] items-stretch overflow-hidden rounded-xl border-2 border-ink bg-surface hover:bg-wash"
            data-testid="cta-lost"
          >
            <span className="flex w-20 shrink-0 items-center justify-center border-r-2 border-ink">
              <Search className="size-8" aria-hidden strokeWidth={2.4} />
            </span>
            <span className="flex flex-1 flex-col justify-center p-5">
              <span className="font-display text-2xl font-extrabold">I lost something</span>
              <span className="mt-1 text-ink-2">Describe it once. We keep looking and alert you when it turns up.</span>
            </span>
            <ArrowUpRight className="m-4 size-6 shrink-0 self-start text-ink-3 group-hover:text-ink" aria-hidden />
          </Link>
          <Link
            href="/report?kind=found"
            className="group flex min-h-[132px] items-stretch overflow-hidden rounded-xl border-2 border-signal-deep bg-signal hover:bg-signal-deep"
            data-testid="cta-found"
          >
            <span className="flex w-20 shrink-0 items-center justify-center bg-ink text-signal">
              <Plus className="size-8" aria-hidden strokeWidth={2.6} />
            </span>
            <span className="flex flex-1 flex-col justify-center p-5">
              <span className="font-display text-2xl font-extrabold">I found something</span>
              <span className="mt-1 text-ink/80">Snap a photo. We fill in the details and find the owner.</span>
            </span>
            <ArrowUpRight className="m-4 size-6 shrink-0 self-start text-ink/60 group-hover:text-ink" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="grid gap-10 border-t border-line py-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold">Recently handed in</h2>
            <Link href="/browse?kind=found" className="text-[15px] font-semibold underline underline-offset-4">
              See all on the map
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {found.length === 0 ? (
              <EmptyState title="Nothing handed in yet" action={<LinkButton href="/report?kind=found" variant="signal">Post a found item</LinkButton>}>
                When someone posts a found item it appears here, with its rough location and a reference code.
              </EmptyState>
            ) : (
              found.map((i) => <ItemTag key={i.id} item={i} />)
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold">People are looking for</h2>
          <div className="mt-4 flex flex-col gap-2.5">
            {lost.length === 0 ? (
              <p className="text-ink-2">No open lost reports right now.</p>
            ) : (
              lost.map((i) => <ItemTag key={i.id} item={i} />)
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-line py-10">
        <h2 className="text-2xl font-extrabold">How things get back to their owners</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-4">
          {[
            ["Post", "A photo and a pin. LostLink reads the photo and fills in category, colour and brand."],
            ["Match", "Every new post is compared by description, place and time. Both sides get an alert."],
            ["Prove it", "The owner answers the finder's private questions. The finder approves."],
            ["Meet", "Chat in LostLink, agree a meeting point and time, then mark it returned."],
          ].map(([t, d], i) => (
            <li key={t} className="border-t-2 border-ink pt-3">
              <span className="font-display text-sm font-extrabold text-ink-3">Step {i + 1}</span>
              <p className="mt-1 font-display text-xl font-extrabold">{t}</p>
              <p className="mt-1 text-[15px] text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[15px] text-ink-2">Nobody shares a phone number. Chats stay inside LostLink and you can block or report anyone.</p>
      </section>

      <section className="mb-6 flex flex-col items-start gap-4 rounded-xl bg-ink p-6 text-paper md:flex-row md:items-center md:p-8">
        <Building2 className="size-10 shrink-0 text-signal" aria-hidden />
        <div className="flex-1">
          <h2 className="text-2xl font-extrabold">Run a lost & found desk?</h2>
          <p className="mt-1 text-paper/80">
            Campuses, malls, stations and events get a public page, a printable QR poster, a staff chat and an inventory that matches itself.
          </p>
        </div>
        <LinkButton href="/desks/new" variant="signal" size="lg" className="on-ink">
          Set up a desk
        </LinkButton>
      </section>
    </div>
  );
}
