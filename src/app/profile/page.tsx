import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Award, Building2, ChevronRight, Heart, PackageCheck, Plus, Search, ShieldOff } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { firstName } from "@/lib/items";
import { myDesks } from "@/lib/desks";
import { ItemTag } from "@/components/item-tag";
import { Avatar, EmptyState, LinkButton } from "@/components/ui";
import { DeleteAccount, SignOutButton, UnblockButton } from "@/components/profile-actions";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Your profile" };

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[22px] font-black">
      {children}
      {count != null && count > 0 && <span className="rounded-full bg-wash px-2.5 py-0.5 font-display text-sm text-ink-2">{count}</span>}
    </h2>
  );
}

export default async function ProfilePage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/profile");
  const t = schema.items;
  const [posts, thanks, blocked, desks] = await Promise.all([
    db().select().from(t).where(eq(t.ownerId, me.id)).orderBy(desc(t.createdAt)).limit(50),
    db()
      .select({ text: schema.claims.thankYou, at: schema.claims.createdAt, title: schema.items.title, name: schema.users.name })
      .from(schema.claims)
      .innerJoin(schema.items, eq(schema.items.id, schema.claims.itemId))
      .innerJoin(schema.users, eq(schema.users.id, schema.claims.claimantId))
      .where(and(eq(schema.claims.finderId, me.id), isNotNull(schema.claims.thankYou)))
      .orderBy(desc(schema.claims.createdAt))
      .limit(20),
    db()
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.blocks)
      .innerJoin(schema.users, eq(schema.users.id, schema.blocks.blockedId))
      .where(eq(schema.blocks.blockerId, me.id)),
    myDesks(me.id),
  ]);
  const lost = posts.filter((p) => p.kind === "lost");
  const found = posts.filter((p) => p.kind === "found" && !p.deskId);
  const tag = (p: (typeof posts)[number]) => ({ ...p, occurredFrom: p.occurredFrom.toISOString(), createdAt: p.createdAt.toISOString() });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <section className="on-ink overflow-hidden rounded-[28px] bg-ink text-paper shadow-[var(--shadow-float)]">
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <Avatar name={me.name} size="lg" tone="signal" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-black leading-tight [overflow-wrap:anywhere] sm:text-[30px]">{me.name}</h1>
            <p className="truncate text-[15px] text-paper/65">{me.email}</p>
          </div>
          <div className="w-full sm:w-auto [&>button]:w-full">
            <SignOutButton />
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-white/10">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-signal text-ink" aria-hidden>
              <Award className="size-5" />
            </span>
            <span>
              <span className="block font-display text-[30px] font-black leading-none" data-testid="karma">
                {me.karma}
              </span>
              <span className="text-sm text-paper/65">Karma from returning things</span>
            </span>
          </div>
          <div className="flex flex-col gap-3 border-l border-white/10 p-5 sm:flex-row sm:items-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-go text-white" aria-hidden>
              <PackageCheck className="size-5" />
            </span>
            <span>
              <span className="block font-display text-[30px] font-black leading-none">{me.returnedCount}</span>
              <span className="text-sm text-paper/65">Items you returned</span>
            </span>
          </div>
        </div>
      </section>

      {thanks.length > 0 && (
        <section className="mt-10">
          <SectionTitle count={thanks.length}>Thank-you notes</SectionTitle>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {thanks.map((n, i) => (
              <li key={i} className="rounded-2xl border border-go/30 bg-go-soft p-4">
                <Heart className="size-5 text-go" aria-hidden />
                <p className="mt-2 font-display text-[17px] font-bold leading-snug">&ldquo;{n.text}&rdquo;</p>
                <p className="mt-2 text-sm text-ink-2">
                  {firstName(n.name)}, for &ldquo;{n.title}&rdquo;, {timeAgo(n.at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle count={lost.length}>Things you lost</SectionTitle>
          <LinkButton href="/report?kind=lost" variant="outline" size="sm" icon={<Search className="size-4" aria-hidden />}>
            Report lost
          </LinkButton>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {lost.length === 0 ? <p className="text-ink-2">Nothing yet. Fingers crossed it stays that way.</p> : lost.map((p) => <ItemTag key={p.id} item={tag(p)} showStatus />)}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle count={found.length}>Things you found</SectionTitle>
          {found.length > 0 && (
            <LinkButton href="/report?kind=found" variant="signal" size="sm" icon={<Plus className="size-4" aria-hidden />}>
              Report found
            </LinkButton>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {found.length === 0 ? (
            <EmptyState icon={<PackageCheck />} title="Nothing found yet" action={<LinkButton href="/report?kind=found" variant="signal">Post a found item</LinkButton>}>
              Found something? Post it and earn karma when it gets back to its owner.
            </EmptyState>
          ) : (
            found.map((p) => <ItemTag key={p.id} item={tag(p)} showStatus />)
          )}
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle count={desks.length}>Lost &amp; found desks</SectionTitle>
        <div className="mt-4 flex flex-col gap-2">
          {desks.map((d) => (
            <Link
              key={d.desk.id}
              href={`/desks/${d.desk.slug}/manage`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-[border-color,box-shadow] hover:border-ink/50 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-signal" aria-hidden>
                <Building2 className="size-5" />
              </span>
              <span className="flex-1 font-display font-bold">{d.desk.name}</span>
              <span className="text-sm font-semibold text-ink-2">{d.role === "owner" ? "Owner" : "Staff"}</span>
              <ChevronRight className="size-4 text-ink-3" aria-hidden />
            </Link>
          ))}
          <LinkButton href="/desks/new" variant="outline" className="self-start" icon={<Plus className="size-4" aria-hidden />}>
            Set up a desk
          </LinkButton>
        </div>
      </section>

      {blocked.length > 0 && (
        <section className="mt-10">
          <SectionTitle count={blocked.length}>Blocked people</SectionTitle>
          <ul className="mt-4 flex flex-col gap-2">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                <ShieldOff className="size-5 text-alert" aria-hidden />
                <span className="flex-1 font-semibold">{firstName(b.name)}</span>
                <UnblockButton userId={b.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-extrabold">Account</h2>
        <p className="mt-1 text-[15px] text-ink-2">
          Deleting your account removes your posts, claims, alerts and desks. Read how we handle data in{" "}
          <Link href="/privacy" className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">
            privacy and safety
          </Link>
          .
        </p>
        <div className="mt-4">
          <DeleteAccount />
        </div>
      </section>
    </div>
  );
}
