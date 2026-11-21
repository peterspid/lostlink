import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { getDesk, deskRole } from "@/lib/desks";
import { ReportForm } from "@/components/report-form";

export const metadata: Metadata = { title: "Report an item" };

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/report${qs ? `?${qs}` : ""}`)}`);
  const kind = sp.kind === "lost" || sp.kind === "found" ? sp.kind : null;
  let desk: { id: string; name: string; lat: number; lng: number; placeLabel: string } | null = null;
  if (typeof sp.desk === "string") {
    const d = await getDesk(sp.desk);
    if (d && (await deskRole(d.id, me.id))) desk = { id: d.id, name: d.name, lat: d.lat, lng: d.lng, placeLabel: d.placeLabel };
  }
  return (
    <ReportForm
      initialKind={desk ? "found" : kind}
      desk={desk}
      prefill={{
        title: typeof sp.title === "string" ? sp.title.slice(0, 80) : "",
        category: typeof sp.category === "string" ? sp.category : "",
      }}
    />
  );
}
