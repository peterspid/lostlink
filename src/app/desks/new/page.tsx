import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { CreateDeskForm } from "@/components/desk-forms";

export const metadata: Metadata = { title: "Set up a desk" };

export default async function NewDeskPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/desks/new");
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">Set up a lost & found desk</h1>
      <p className="mt-2 text-ink-2">
        You&apos;ll get a public page people can search, a QR poster to print, an inventory that matches itself against lost reports, and a private staff chat.
      </p>
      <div className="mt-6">
        <CreateDeskForm />
      </div>
    </div>
  );
}
