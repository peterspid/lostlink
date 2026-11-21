import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { ExternalLink, Plus } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { deskMembers, deskRole, getDeskBySlug } from "@/lib/desks";
import { firstName } from "@/lib/items";
import { ItemTag } from "@/components/item-tag";
import { Banner, EmptyState, LinkButton } from "@/components/ui";
import { InvitePanel, PosterButtons, StaffList } from "@/components/desk-forms";
import { GroupChat } from "@/components/chat/group-chat";

export const metadata: Metadata = { title: "Manage desk" };

export default async function ManageDeskPage({ params, searchParams }: PageProps<"/desks/[slug]/manage">) {
  const { slug } = await params;
  const sp = await searchParams;
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/desks/${slug}/manage`)}`);
  const desk = await getDeskBySlug(slug);
  if (!desk) notFound();
  const role = await deskRole(desk.id, me.id);
  if (!role) redirect(`/desks/${slug}`);
  const isOwner = desk.ownerId === me.id;

  const [members, inventory] = await Promise.all([
    deskMembers(desk.id),
    db()
      .select({
        item: schema.items,
        claims: sql<number>`(SELECT count(*)::int FROM ${schema.claims} c WHERE c.item_id = ${schema.items.id} AND c.status = 'pending')`,
      })
      .from(schema.items)
      .where(eq(schema.items.deskId, desk.id))
      .orderBy(desc(schema.items.createdAt))
      .limit(200),
  ]);
  const open = inventory.filter((r) => r.item.status === "open" || r.item.status === "claimed");
  const done = inventory.filter((r) => !(r.item.status === "open" || r.item.status === "claimed"));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {sp.created === "1" && (
        <div className="mb-5">
          <Banner tone="success" title="Your desk is ready">
            Print the QR poster, invite your staff, and log the first item.
          </Banner>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-2">{isOwner ? "You own this desk" : "You're on the staff team"}</p>
          <h1 className="text-3xl font-extrabold">{desk.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/desks/${desk.slug}`} variant="outline" icon={<ExternalLink className="size-4" aria-hidden />}>
            Public page
          </LinkButton>
          <LinkButton href={`/report?desk=${desk.id}`} variant="signal" icon={<Plus className="size-4" aria-hidden />} data-testid="log-item">
            Log a found item
          </LinkButton>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="text-xl font-extrabold">Inventory</h2>
            <div className="mt-3 flex flex-col gap-2">
              {open.length === 0 ? (
                <EmptyState title="No items logged">Log items as they&apos;re handed in. Each gets a reference code for the shelf label, and is matched against lost reports automatically.</EmptyState>
              ) : (
                open.map((r) => (
                  <ItemTag
                    key={r.item.id}
                    item={{ ...r.item, occurredFrom: r.item.occurredFrom.toISOString(), createdAt: r.item.createdAt.toISOString() }}
                    showStatus
                    extra={r.claims > 0 ? <p className="mt-1.5 text-sm font-semibold text-alert">{r.claims} claim{r.claims === 1 ? "" : "s"} waiting</p> : undefined}
                  />
                ))
              )}
            </div>
            {done.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-[15px] font-semibold">Returned and closed ({done.length})</summary>
                <div className="mt-2 flex flex-col gap-2">
                  {done.map((r) => (
                    <ItemTag key={r.item.id} item={{ ...r.item, occurredFrom: r.item.occurredFrom.toISOString(), createdAt: r.item.createdAt.toISOString() }} showStatus />
                  ))}
                </div>
              </details>
            )}
          </section>

          <section id="staff-chat">
            <h2 className="text-xl font-extrabold">Staff chat</h2>
            <p className="mt-1 text-sm text-ink-2">Only desk staff can see this. New items and claims are posted here automatically.</p>
            <div className="mt-3">
              <GroupChat groupId={desk.nexconnGroupId} members={members.map((m) => ({ nexconnId: m.nexconnId, name: m.name }))} />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <section>
            <h2 className="text-xl font-extrabold">QR poster</h2>
            <p className="mt-1 text-[15px] text-ink-2">Print it for the counter, entrances and notice boards. Scanning opens this desk&apos;s public page.</p>
            <div className="mt-3">
              <PosterButtons deskId={desk.id} />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/desks/${desk.id}/poster?format=png`} alt={`QR poster for ${desk.name}`} className="mt-3 w-48 rounded-md border border-line-strong" loading="lazy" />
          </section>

          <section>
            <h2 className="text-xl font-extrabold">Invite staff</h2>
            <div className="mt-3">
              <InvitePanel deskId={desk.id} initialToken={desk.inviteToken} isOwner={isOwner} />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-extrabold">Team</h2>
            <div className="mt-3">
              <StaffList deskId={desk.id} ownerId={desk.ownerId} isOwner={isOwner} members={members.map((m) => ({ userId: m.userId, name: firstName(m.name), role: m.role }))} />
            </div>
            <p className="mt-2 text-sm text-ink-3">
              Claims on desk items go to the staff member who logged them. <Link href="/chats" className="underline">See your chats</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
