import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { currentUser } from "@/lib/auth/session";
import { CreateDeskForm } from "@/components/desk-forms";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Set up a desk" };

export default async function NewDeskPage() {
  const me = await currentUser();
  if (!me) redirect("/login?next=/desks/new");
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PageHeader
        back={{ href: "/desks", label: "Your desks" }}
        icon={<Building2 />}
        title="Set up a lost & found desk"
        description="You get a public page people can search, a QR poster to print, an inventory that matches itself against lost reports, and a private staff chat."
      />
      <div className="mt-8 rounded-3xl border border-line bg-surface p-5 md:p-6">
        <CreateDeskForm />
      </div>
    </div>
  );
}
