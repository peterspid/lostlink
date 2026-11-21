import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { BadgeCheck, CalendarClock, Clock, EyeOff, Lock, MapPin, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { canManageItem, firstName, getItem, isExpiringSoon, toPublicItem } from "@/lib/items";
import { listMatches } from "@/lib/matching";
import { categoryLabel } from "@/lib/categories";
import { formatWhen, timeAgo } from "@/lib/time";
import { ItemsMap } from "@/components/map";
import { ItemTag, CategoryIcon } from "@/components/item-tag";
import { OwnerActions, RefreshMatches, SafetyMenu } from "@/components/item-actions";
import { Banner, EmptyState, KindMark, LinkButton, StatusPill } from "@/components/ui";
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
  return { title, description, openGraph: { title, description, type: "article" }, twitter: { card: "summary_large_image", title, description } };
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {sp.posted === "1" && manage && (
        <div className="mb-5">
          <Banner tone="success" title={isFound ? "Posted. Thank you for handing it in." : "Posted. We're looking for it."}>
            {matches.length
              ? `We found ${matches.length} possible match${matches.length === 1 ? "" : "es"} below. ${isFound ? "If the owner claims it, you'll get a notification." : ""}`
              : isFound
                ? "We'll notify you as soon as someone who lost it posts or claims it."
                : "No matches yet. We'll notify you the moment a matching item is found."}
          </Banner>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <KindMark kind={item.kind} />
            {item.status !== "open" && <StatusPill status={item.status} />}
            <span className="ref-code ml-auto text-sm text-ink-2" aria-label={`Reference ${item.code}`}>
              Ref {item.code}
            </span>
            <SafetyMenu itemId={manage ? undefined : item.id} userId={manage || !me ? undefined : item.ownerId} userName={firstName(owner?.name ?? "")} />
          </div>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight md:text-[40px]" data-testid="item-title">
            {item.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <CategoryIcon category={item.category} className="size-4" />
              {categoryLabel(item.category)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden />
              {formatWhen(item.occurredFrom, item.occurredTo)}
            </span>
          </p>

          {pub.photos.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {pub.photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={p} alt={`${item.title}, photo ${i + 1}`} className={i === 0 ? "col-span-2 aspect-[4/3] w-full rounded-lg border border-line object-cover" : "aspect-square w-full rounded-lg border border-line object-cover"} />
              ))}
            </div>
          ) : (
            <div className="mt-5 flex aspect-[3/1] items-center justify-center rounded-lg border border-line bg-wash">
              <CategoryIcon category={item.category} className="size-10 text-ink-3" />
            </div>
          )}

          {pub.description && <p className="mt-5 max-w-prose whitespace-pre-line text-[17px] leading-relaxed">{pub.description}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
            {a.color && <Attr label="Color" value={a.color} />}
            {a.brand && <Attr label="Brand" value={a.brand} />}
            {a.material && <Attr label="Material" value={a.material} />}
            {a.marks && a.marks.length > 0 && <Attr label="Marks" value={a.marks.join(", ")} wide />}
          </dl>
          {isFound && !manage && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-3">
              <EyeOff className="size-4" aria-hidden /> The finder keeps identifying details private. The owner proves it by answering their questions.
            </p>
          )}
          {item.aiFilled && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-3">
              <Sparkles className="size-4" aria-hidden /> Details pre-filled from the photo and checked by the poster.
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-line-strong">
            <div className="h-56">
              <ItemsMap markers={[{ id: item.id, lat: pub.lat, lng: pub.lng, kind: item.kind }]} fuzzRadiusM={pub.exactLocation ? undefined : 300} className="h-full w-full" />
            </div>
            <div className="flex items-start gap-2 border-t border-line bg-surface p-3 text-[15px]">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {pub.placeLabel || "Location on map"}
                {!pub.exactLocation && <span className="block text-sm text-ink-3">Shown within about 300 m to protect privacy.</span>}
              </span>
            </div>
          </div>

          {desk ? (
            <Link href={`/desks/${desk.slug}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 hover:border-ink">
              <ShieldCheck className="size-6 shrink-0" aria-hidden />
              <span>
                <span className="block font-semibold">Held at {desk.name}</span>
                <span className="text-sm text-ink-2">{desk.hours || "Official lost & found desk"}</span>
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5">
              <BadgeCheck className="size-6 shrink-0" aria-hidden />
              <span>
                <span className="block font-semibold">
                  {isFound ? "Found by" : "Posted by"} {firstName(owner?.name ?? "Someone")}
                </span>
                <span className="text-sm text-ink-2">
                  {owner && owner.returnedCount > 0 ? `${owner.karma} karma, returned ${owner.returnedCount} item${owner.returnedCount === 1 ? "" : "s"}` : `Posted ${timeAgo(item.createdAt)}`}
                </span>
              </span>
            </div>
          )}

          {!manage && isFound && item.status === "open" && !myClaim && (
            <div className="rounded-xl border-2 border-ink bg-surface p-4">
              <p className="font-display text-xl font-extrabold">Is this yours?</p>
              <p className="mt-1 text-[15px] text-ink-2">
                Answer {questionCount === 1 ? "one question" : `${questionCount} questions`} only the owner would know. The finder checks your answers, then you can chat to arrange the handover.
              </p>
              <LinkButton
                href={me ? `/items/${item.id}/claim${from ? `?from=${from}` : ""}` : `/login?next=${encodeURIComponent(`/items/${item.id}/claim`)}`}
                variant="signal"
                size="lg"
                className="mt-3 w-full"
                icon={<Lock className="size-4" aria-hidden />}
                data-testid="claim-cta"
              >
                This is mine
              </LinkButton>
            </div>
          )}
          {myClaim && (
            <div className="rounded-xl border border-ink bg-surface p-4">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Your claim</p>
                <StatusPill status={myClaim.status} />
              </div>
              <LinkButton href={`/chats/${myClaim.id}`} variant="ink" className="mt-3 w-full" icon={<MessageSquare className="size-4" aria-hidden />}>
                Open chat with the finder
              </LinkButton>
            </div>
          )}
          {!manage && !isFound && item.status === "open" && (
            <div className="rounded-xl border border-line-strong bg-surface p-4">
              <p className="font-display text-xl font-extrabold">Seen this?</p>
              <p className="mt-1 text-[15px] text-ink-2">Post it as found and LostLink will connect you with the owner, without sharing numbers.</p>
              <LinkButton href={`/report?kind=found&category=${item.category}&title=${encodeURIComponent(item.title)}`} variant="signal" className="mt-3 w-full">
                I found this
              </LinkButton>
            </div>
          )}
          {manage && <OwnerActions itemId={item.id} status={item.status} expiringSoon={expiringSoon} />}
          <CopyLink path={`/items/${item.id}`} />
        </aside>
      </div>

      {manage && isFound && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-2xl font-extrabold">Claims</h2>
          {claims.length === 0 ? (
            <p className="mt-2 text-ink-2">No one has claimed it yet. You&apos;ll get a notification when someone does.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {claims.map((c) => (
                <li key={c.id}>
                  <Link href={`/chats/${c.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5 hover:border-ink" data-testid="claim-row">
                    <MessageSquare className="size-5" aria-hidden />
                    <span className="flex-1">
                      <span className="block font-semibold">{firstName(c.name)} says it&apos;s theirs</span>
                      <span className="text-sm text-ink-2">
                        <Clock className="mr-1 inline size-3.5" aria-hidden />
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
        <section className="mt-10 border-t border-line pt-6" aria-labelledby="matches-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="matches-h" className="text-2xl font-extrabold">
              {isFound ? "People who may have lost this" : "Possible matches"}
            </h2>
            {item.status === "open" && <RefreshMatches itemId={item.id} />}
          </div>
          <div className="mt-4 flex flex-col gap-2.5" data-testid="matches">
            {matches.length === 0 ? (
              <EmptyState title="No matches yet">
                {isFound
                  ? "When someone reports losing something like this nearby, they'll appear here and both of you get a notification."
                  : "We compare every new found item by description, place and time. You'll get a notification the moment one matches."}
                {!isFound && (
                  <span className="mt-2 block">
                    <Link href="/alerts" className="font-semibold text-ink underline underline-offset-2">
                      Set up an alert
                    </Link>{" "}
                    to watch a wider area.
                  </span>
                )}
              </EmptyState>
            ) : (
              matches.map((m) => (
                <ItemTag
                  key={m.matchId}
                  item={m.other}
                  href={isFound ? `/items/${m.other.id}` : `/items/${m.other.id}?from=${item.id}`}
                  extra={
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Why it matches">
                      {m.reasons.map((r) => (
                        <li key={r} className="rounded-full bg-wash px-2.5 py-0.5 text-[13px] font-semibold text-ink">
                          {r}
                        </li>
                      ))}
                    </ul>
                  }
                />
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Attr({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : undefined}>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="font-semibold first-letter:uppercase">{value}</dd>
    </div>
  );
}
