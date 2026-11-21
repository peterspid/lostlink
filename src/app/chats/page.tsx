import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { listClaimsFor } from "@/lib/claim-view";
import { myDesks } from "@/lib/desks";
import { ChatList } from "@/components/chat/chat-list";

export const metadata: Metadata = { title: "Chats" };

export default async function ChatsPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/chats");
  const [claims, desks] = await Promise.all([listClaimsFor(me.id), myDesks(me.id)]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">Chats</h1>
      <p className="mt-1 text-ink-2">Private conversations about claims and handovers.</p>
      <div className="mt-6">
        <ChatList claims={claims} desks={desks.map((d) => ({ id: d.desk.id, slug: d.desk.slug, name: d.desk.name, groupId: d.desk.nexconnGroupId }))} />
      </div>
    </div>
  );
}
