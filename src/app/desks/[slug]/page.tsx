import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, Clock, MapPin, Radar, Search, Settings } from "lucide-react";
import { currentUser } from "@/lib/auth/session";
import { DESK_KINDS, deskRole, getDeskBySlug } from "@/lib/desks";
import { searchItems } from "@/lib/search";
import { ItemsMap } from "@/components/map";
import { ItemTag } from "@/components/item-tag";
import { EmptyState, LinkButton } from "@/components/ui";
import { CopyLink } from "@/components/copy-link";

export async function generateMetadata({ params }: PageProps<"/desks/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const desk = await getDeskBySlug(slug);
  if (!desk) return { title: "Desk not found" };
  const description = `Items handed in at ${desk.name}${desk.placeLabel ? `, ${desk.placeLabel}` : ""}. Lost something here? Search and claim it on LostLink.`;
  return { title: `${desk.name} lost & found`, description, openGraph: { title: `${desk.name} lost & found`, description } };
}

export default async function DeskPage({ params }: PageProps<"/desks/[slug]">) {
  const { slug } = await params;
  const desk = await getDeskBySlug(slug);
  if (!desk) notFound();
  const me = await currentUser();
  const role = me ? await deskRole(desk.id, me.id) : null;
  const items = await searchItems({ deskId: desk.id, limit: 100 }).catch(() => []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-[var(--shadow-float)]">
        <div className="flex items-start gap-4 bg-signal px-5 py-7 md:px-8 md:py-9">
          <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-signal sm:flex" aria-hidden>
            <Building2 className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[15px] font-extrabold text-ink/75">{DESK_KINDS[desk.kind as keyof typeof DESK_KINDS] ?? "Desk"} lost &amp; found</p>
            <h1 className="mt-1 text-[34px] font-black leading-[1.02] md:text-[48px]" data-testid="desk-title">
              {desk.name}
            </h1>
          </div>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_340px] md:p-8">
          <div className="flex flex-col gap-2.5 text-[16px]">
            {desk.placeLabel && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {desk.placeLabel}
              </p>
            )}
            {desk.hours && (
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden /> {desk.hours}
              </p>
            )}
            {desk.description && <p className="mt-1 max-w-prose text-ink-2">{desk.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton href={`/report?kind=lost`} variant="ink" icon={<Search className="size-4" aria-hidden />}>
                I lost something here
              </LinkButton>
              <LinkButton href="/alerts" variant="outline" icon={<Radar className="size-4" aria-hidden />}>
                Get an alert
              </LinkButton>
              {role && (
                <LinkButton href={`/desks/${desk.slug}/manage`} variant="outline" icon={<Settings className="size-4" aria-hidden />}>
                  Manage desk
                </LinkButton>
              )}
            </div>
          </div>
          <div className="h-52 overflow-hidden rounded-2xl border border-line">
            <ItemsMap markers={[{ id: desk.id, lat: desk.lat, lng: desk.lng, kind: "desk" }]} className="h-full w-full" />
          </div>
        </div>
      </div>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-[28px] font-black">
            Handed in here
            {items.length > 0 && <span className="rounded-full bg-signal px-2.5 py-0.5 font-display text-sm">{items.length}</span>}
          </h2>
          <CopyLink path={`/desks/${desk.slug}`} label="Share this desk" />
        </div>
        <p className="mt-1 text-ink-2">Think one of these is yours? Open it and tap &ldquo;This is mine&rdquo;. Staff will check your answers.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2" data-testid="desk-inventory">
          {items.length === 0 ? (
            <div className="md:col-span-2">
              <EmptyState title="Nothing logged yet">Items handed in at this desk appear here with a reference code.</EmptyState>
            </div>
          ) : (
            items.map((i) => <ItemTag key={i.id} item={i} />)
          )}
        </div>
      </section>
    </div>
  );
}
