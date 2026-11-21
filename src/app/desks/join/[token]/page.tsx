import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { deskRole } from "@/lib/desks";
import { JoinDeskButton } from "@/components/desk-forms";

export const metadata: Metadata = { title: "Join a desk team" };

export default async function JoinDeskPage({ params }: PageProps<"/desks/join/[token]">) {
  const { token } = await params;
  const me = await currentUser();
  if (!me) redirect(`/signup?next=${encodeURIComponent(`/desks/join/${token}`)}`);
  const [desk] = await db().select().from(schema.desks).where(eq(schema.desks.inviteToken, token)).limit(1);
  if (!desk) notFound();
  if (await deskRole(desk.id, me.id)) redirect(`/desks/${desk.slug}/manage`);
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <span className="flex size-12 items-center justify-center rounded-lg bg-ink text-signal">
        <Users className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-3xl font-extrabold">Join {desk.name}</h1>
      <p className="mt-2 text-ink-2">
        You&apos;ve been invited to the staff team. You&apos;ll be able to log found items, handle claims and chat with the team.
      </p>
      <div className="mt-6">
        <JoinDeskButton token={token} />
      </div>
    </div>
  );
}
