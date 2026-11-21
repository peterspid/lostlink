import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, BadgeCheck, Building2, CalendarClock, Clock, EyeOff, Lock, MapPin, MessageSquare, Radar, Sparkles } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { canManageItem, firstName, getItem, isExpiringSoon, toPublicItem } from "@/lib/items";
import { listMatches } from "@/lib/matching";
import { categoryLabel } from "@/lib/categories";
import { formatWhen, timeAgo } from "@/lib/time";
import { ItemsMap } from "@/components/map";
import { ItemTag, CategoryIcon } from "@/components/item-tag";
import { ItemGallery } from "@/components/item-gallery";
import { OwnerActions, RefreshMatches, SafetyMenu } from "@/components/item-actions";
import { Avatar, Banner, EmptyState, KindMark, LinkButton, StatusPill, cx } from "@/components/ui";
import { CopyLink } from "@/components/copy-link";

async function load(id: string) {
  const item = await getItem(id);
  if (!item) return null;
  const [owner] = await db()
    .select({ name: schema.users.name, karma: schema.users.karma, returnedCount: schema.users.returnedCount })
    .from(schema.users)
    .where(eq(schema.users.id, item.ownerId));
  const desk = item.deskId
    ? (await db().select({ name: schema.desks.name, slug: schema.desks.slug, hours: schema.desks.hours }).from(schema.desks).where(eq(schema.desks.id, item.deskId)))[0]
    : undefined;
  const [{ n }] = await db().select({ n: count() }).from(schema.verificationQuestions).where(eq(schema.verificationQuestions.itemId, id));
  return { item, owner, desk, questionCount: n };
}

export async function generateMetadata({ params }: PageProps<"/items/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data || data.item.status === "hidden") return { title: "Item not found" };
  const { item } = data;
  const verb = item.kind === "found" ? "Found" : "Lost";
  const title = `${verb}: ${item.title}`;
  const description = `${verb} ${timeAgo(item.occurredFrom)}${item.placeLabel ? ` near ${item.placeLabel}` : ""}. Ref ${item.code}. ${
    item.kind === "found" ? "Is it yours? Prove it on LostLink and arrange the handover in a private chat." : "Seen it? Post it on LostLink."
  }`;
  return { title, description, alternates: { canonical: `/items/${id}` }, openGraph: { title, description, type: "article" }, twitter: { card: "summary_large_image", title, description } };
}

function matchStrength(score: number) {
  if (score >= 0.7) return { label: "Strong match", bars: 3 };
  if (score >= 0.52) return { label: "Good match", bars: 2 };
  return { label: "Possible match", bars: 1 };
}

export default async function ItemPage({ params, searchParams }: PageProps<"/items/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await load(id);
  if (!data) notFound();
  const { item, owner, desk, questionCount } = data;
  const me = await currentUser();
  const manage = me ? await canManageItem(item, me.id) : false;
  if (item.status === "hidden" && !manage) notFound();
  const pub = toPublicItem(item, { ownerName: owner?.name ?? "Someone", deskName: desk?.name, deskSlug: desk?.slug, questionCount }, manage);
  const isFound = item.kind === "found";
  const matches = manage ? await listMatches(item) : [];

  const myClaim =
    me && !manage
      ? (
          await db()
            .select({ id: schema.claims.id, status: schema.claims.status })
            .from(schema.claims)
            .where(and(eq(schema.claims.itemId, item.id), eq(schema.claims.claimantId, me.id)))
            .orderBy(desc(schema.claims.createdAt))
            .limit(1)
        )[0]
      : undefined;

  const claims =
    manage && isFound
      ? await db()
          .select({ id: schema.claims.id, status: schema.claims.status, createdAt: schema.claims.createdAt, name: schema.users.name })
          .from(schema.claims)
          .innerJoin(schema.users, eq(schema.users.id, schema.claims.claimantId))
          .where(and(eq(schema.claims.itemId, item.id), inArray(schema.claims.status, ["pending", "approved", "returned", "rejected"])))
          .orderBy(desc(schema.claims.createdAt))
      : [];

  const expiringSoon = isExpiringSoon(item);
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const a = pub.attributes;
  const specs = [
    ["Colour", a.color],
    ["Brand", a.brand],
    ["Material", a.material],
    ["Marks", a.marks?.length ? a.marks.join(", ") : undefined],
  ].filter((r): r is [string, string] => !!r[1]);
  const ownerName = firstName(owner?.name ?? "Someone");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      {sp.posted === "1" && manage && (
        <div className="mb-6">
          <Banner tone="success" title={isFound ? "Posted. Thank you for handing it in." : "Posted. We're looking for it."}>
            {matches.length
              ? `We found ${matches.length} possible match${matches.length === 1 ? "" : "es"} below. ${isFound ? "If the owner claims it, you'll get a notification." : ""}`
              : isFound
                ? "We'll notify you as soon as someone who lost it posts or claims it."
                : "No matches yet. We'll notify you the moment a matching item is found."}
          </Banner>
        </div>
      )}

      <div className="mb-5 flex items-center gap-2">
        <Link href="/browse" className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:bg-wash hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Browse
        </Link>
        <span className="ml-auto inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1">
          <span className="text-xs font-semibold text-ink-3">Ref</span>
          <span className="ref-code text-[15px]" aria-label={`Reference ${item.code}`}>
            {item.code}
          </span>
        </span>
        <SafetyMenu itemId={manage ? undefined : item.id} userId={manage || !me ? undefined : item.ownerId} userName={ownerName} />
      </div>

      <div className="grid gap-x-10 gap-y-7 md:grid-cols-[1.35fr_1fr]">
        {/* Title and photos */}
        <div className="min-w-0 md:col-start-1 md:row-start-1">
          <div className="flex flex-wrap items-center gap-2">
            <KindMark kind={item.kind} />
            {item.status !== "open" && <StatusPill status={item.status} />}
          </div>
          <h1 className="mt-3 text-[34px] font-black leading-[1.05] md:text-[46px]" data-testid="item-title">
            {item.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[15px] text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <CategoryIcon category={item.category} className="size-4" />
              {categoryLabel(item.category)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden />
              {formatWhen(item.occurredFrom, item.occurredTo)}
            </span>
            {pub.placeLabel && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{pub.placeLabel}</span>
              </span>
            )}
          </p>
          <div className="mt-6">
            <ItemGallery id={item.id} title={item.title} photos={pub.photos} category={item.category} kind={item.kind} />
          </div>
        </div>

        {/* Actions, holder and map: right column on desktop, straight after the photos on phones */}
        <aside className="flex flex-col gap-4 md:sticky md:top-[calc(var(--header-h)+1.5rem)] md:col-start-2 md:row-span-2 md:row-start-1 md:self-start">
          {!manage && isFound && item.status === "open" && !myClaim && (
            <div className="on-ink relative overflow-hidden rounded-3xl bg-ink p-5 text-paper shadow-[var(--shadow-float)]">
              <p className="font-display text-[24px] font-black leading-tight">Is this yours?</p>
              <p className="mt-1.5 text-[15px] text-paper/75">
                Answer {questionCount === 1 ? "one question" : `${questionCount} questions`} only the owner would know. {desk ? "Desk staff check" : `${ownerName} checks`} your answers, then you chat to arrange the handover.
              </p>
              <LinkButton
                href={me ? `/items/${item.id}/claim${from ? `?from=${from}` : ""}` : `/login?next=${encodeURIComponent(`/items/${item.id}/claim`)}`}
                variant="signal"
                size="lg"
                className="mt-4 w-full"
                icon={<Lock className="size-4" aria-hidden />}
                data-testid="claim-cta"
              >
                This is mine
              </LinkButton>
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-paper/60">
                <EyeOff className="size-3.5" aria-hidden /> Only the finder sees your answers.
              </p>
            </div>
          )}
          {myClaim && (
            <div className="rounded-3xl border-2 border-ink bg-surface p-5">
              <div className="flex items-center gap-2">
                <p className="font-display text-lg font-extrabold">Your claim</p>
                <StatusPill status={myClaim.status} />
              </div>
              <LinkButton href={`/chats/${myClaim.id}`} variant="ink" className="mt-3 w-full" icon={<MessageSquare className="size-4" aria-hidden />}>
                Open chat with the finder
              </LinkButton>
            </div>
          )}
          {!manage && !isFound && item.status === "open" && (
            <div className="rounded-3xl bg-signal p-5 text-ink shadow-[var(--shadow-lift)]">
              <p className="font-display text-[24px] font-black leading-tight">Seen this?</p>
              <p className="mt-1.5 text-[15px] text-ink/80">Post it as found and LostLink will connect you with the owner, without sharing numbers.</p>
              <LinkButton href={`/report?kind=found&category=${item.category}&title=${encodeURIComponent(item.title)}`} variant="ink" size="lg" className="mt-4 w-full">
                I found this
              </LinkButton>
            </div>
          )}
          {manage && <OwnerActions itemId={item.id} status={item.status} expiringSoon={expiringSoon} />}

          {desk ? (
            <Link href={`/desks/${desk.slug}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink/50">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink text-signal">
                <Building2 className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-display font-bold">Held at {desk.name}</span>
                <span className="block text-sm text-ink-2">{desk.hours || "Official lost & found desk"}</span>
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <Avatar name={ownerName} tone={isFound ? "signal" : "ink"} />
              <span className="min-w-0">
                <span className="block font-display font-bold">
                  {isFound ? "Found by" : "Posted by"} {ownerName}
                </span>
                <span className="flex items-center gap-1 text-sm text-ink-2">
                  {owner && owner.returnedCount > 0 ? (
                    <>
                      <BadgeCheck className="size-4 text-go" aria-hidden /> {owner.karma} karma, returned {owner.returnedCount} item{owner.returnedCount === 1 ? "" : "s"}
                    </>
                  ) : (
                    `Posted ${timeAgo(item.createdAt)}`
                  )}
                </span>
              </span>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="h-56">
              <ItemsMap markers={[{ id: item.id, lat: pub.lat, lng: pub.lng, kind: item.kind }]} fuzzRadiusM={pub.exactLocation ? undefined : 300} className="h-full w-full" />
            </div>
            <div className="flex items-start gap-2 border-t border-line p-3.5 text-[15px]">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {pub.placeLabel || "Location on map"}
                <span className="block text-sm text-ink-3">{pub.exactLocation ? "Exact spot, visible only to you." : "Shown within about 300 m to protect privacy."}</span>
              </span>
            </div>
          </div>
          <CopyLink path={`/items/${item.id}`} className="w-full" />
        </aside>

        {/* Description and details */}
        <div className="min-w-0 md:col-start-1 md:row-start-2">
          {pub.description && <p className="max-w-prose whitespace-pre-line text-[17px] leading-relaxed">{pub.description}</p>}
          {specs.length > 0 && (
            <dl className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
              {specs.map(([label, value], i) => (
                <div key={label} className={cx("grid grid-cols-[110px_1fr] gap-3 px-4 py-3", i > 0 && "border-t border-line")}>
                  <dt className="text-sm font-semibold text-ink-3">{label}</dt>
                  <dd className="font-display font-bold first-letter:uppercase">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {isFound && !manage && (
              <p className="flex items-start gap-2 text-sm text-ink-3">
                <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden /> The finder keeps identifying details private. The owner proves it by answering their questions.
              </p>
            )}
            {item.aiFilled && (
              <p className="flex items-start gap-2 text-sm text-ink-3">
                <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden /> Details pre-filled from the photo and checked by the poster.
              </p>
            )}
          </div>
        </div>
      </div>

      {manage && isFound && (
        <section className="mt-14 border-t border-line pt-8" aria-labelledby="claims-h">
          <h2 id="claims-h" className="flex items-center gap-2.5 text-[26px] font-black">
            Claims
            {claims.length > 0 && <span className="rounded-full bg-ink px-2.5 py-0.5 font-display text-sm text-signal">{claims.length}</span>}
          </h2>
          {claims.length === 0 ? (
            <p className="mt-2 text-ink-2">No one has claimed it yet. You&apos;ll get a notification when someone does.</p>
          ) : (
            <ul className="mt-4 grid gap-2.5 md:grid-cols-2">
              {claims.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/chats/${c.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-[border-color,box-shadow] hover:border-ink/50 hover:shadow-[var(--shadow-lift)]"
                    data-testid="claim-row"
                  >
                    <Avatar name={firstName(c.name)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-bold">{firstName(c.name)} says it&apos;s theirs</span>
                      <span className="flex items-center gap-1 text-sm text-ink-2">
                        <Clock className="size-3.5" aria-hidden />
                        {timeAgo(c.createdAt)}
                      </span>
                    </span>
                    <StatusPill status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {manage && (
        <section className="mt-14 border-t border-line pt-8" aria-labelledby="matches-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="matches-h" className="flex items-center gap-2.5 text-[26px] font-black">
              {isFound ? "People who may have lost this" : "Possible matches"}
              {matches.length > 0 && <span className="rounded-full bg-signal px-2.5 py-0.5 font-display text-sm">{matches.length}</span>}
            </h2>
            {item.status === "open" && <RefreshMatches itemId={item.id} />}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2" data-testid="matches">
            {matches.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState icon={<Radar />} title="No matches yet">
                  {isFound
                    ? "When someone reports losing something like this nearby, they'll appear here and both of you get a notification."
                    : "We compare every new found item by description, place and time. You'll get a notification the moment one matches."}
                  {!isFound && (
                    <span className="mt-2 block">
                      <Link href="/alerts" className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">
                        Set up an alert
                      </Link>{" "}
                      to watch a wider area.
                    </span>
                  )}
                </EmptyState>
              </div>
            ) : (
              matches.map((m) => {
                const strength = matchStrength(m.score);
                return (
                  <ItemTag
                    key={m.matchId}
                    item={m.other}
                    href={isFound ? `/items/${m.other.id}` : `/items/${m.other.id}?from=${item.id}`}
                    extra={
                      <div className="mt-2">
                        <span className="flex items-center gap-1.5 text-[13px] font-bold">
                          <span className="flex items-end gap-0.5" aria-hidden>
                            {[1, 2, 3].map((b) => (
                              <span key={b} className={cx("w-1 rounded-sm", b <= strength.bars ? "bg-go" : "bg-line-strong")} style={{ height: 4 + b * 3 }} />
                            ))}
                          </span>
                          {strength.label}
                        </span>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Why it matches">
                          {m.reasons.map((r) => (
                            <li key={r} className="rounded-full bg-wash px-2.5 py-0.5 text-[12px] font-semibold text-ink">
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    }
                  />
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
