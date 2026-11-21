import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Award, Building2, Heart, PackageCheck } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { firstName } from "@/lib/items";
import { myDesks } from "@/lib/desks";
import { ItemTag } from "@/components/item-tag";
import { EmptyState, LinkButton } from "@/components/ui";
import { DeleteAccount, SignOutButton, UnblockButton } from "@/components/profile-actions";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Your profile" };

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{me.name}</h1>
          <p className="text-ink-2">{me.email}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <Award className="size-5" aria-hidden />
          <p className="mt-2 font-display text-3xl font-black" data-testid="karma">
            {me.karma}
          </p>
          <p className="text-sm text-ink-2">Karma from returning things</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <PackageCheck className="size-5" aria-hidden />
          <p className="mt-2 font-display text-3xl font-black">{me.returnedCount}</p>
          <p className="text-sm text-ink-2">Items you returned</p>
        </div>
      </div>

      {thanks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold">Thank-you notes</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {thanks.map((n, i) => (
              <li key={i} className="rounded-lg border border-line bg-signal-soft p-3.5">
                <p className="flex items-start gap-2">
                  <Heart className="mt-1 size-4 shrink-0" aria-hidden />
                  <span>&ldquo;{n.text}&rdquo;</span>
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  {firstName(n.name)}, for &ldquo;{n.title}&rdquo;, {timeAgo(n.at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">Things you lost</h2>
        <div className="mt-3 flex flex-col gap-2">
          {lost.length === 0 ? (
            <p className="text-ink-2">Nothing yet.</p>
          ) : (
            lost.map((p) => <ItemTag key={p.id} item={{ ...p, occurredFrom: p.occurredFrom.toISOString(), createdAt: p.createdAt.toISOString() }} showStatus />)
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">Things you found</h2>
        <div className="mt-3 flex flex-col gap-2">
          {found.length === 0 ? (
            <EmptyState title="Nothing found yet" action={<LinkButton href="/report?kind=found" variant="signal">Post a found item</LinkButton>}>
              Found something? Post it and earn karma when it gets back to its owner.
            </EmptyState>
          ) : (
            found.map((p) => <ItemTag key={p.id} item={{ ...p, occurredFrom: p.occurredFrom.toISOString(), createdAt: p.createdAt.toISOString() }} showStatus />)
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">Lost & found desks</h2>
        <div className="mt-3 flex flex-col gap-2">
          {desks.map((d) => (
            <Link key={d.desk.id} href={`/desks/${d.desk.slug}/manage`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5 hover:border-ink">
              <Building2 className="size-5" aria-hidden />
              <span className="flex-1 font-semibold">{d.desk.name}</span>
              <span className="text-sm text-ink-2">{d.role === "owner" ? "Owner" : "Staff"}</span>
            </Link>
          ))}
          <LinkButton href="/desks/new" variant="outline" className="self-start">
            Set up a desk
          </LinkButton>
        </div>
      </section>

      {blocked.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold">Blocked people</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-lg border border-line bg-surface p-3">
                <span>{firstName(b.name)}</span>
                <UnblockButton userId={b.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-10 border-t border-line pt-6">
        <h2 className="text-xl font-extrabold">Account</h2>
        <div className="mt-3">
          <DeleteAccount />
        </div>
      </section>
    </div>
  );
}
