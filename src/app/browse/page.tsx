import type { Metadata } from "next";
import { Suspense } from "react";
import { searchItems, searchParamsSchema } from "@/lib/search";
import { BrowseView } from "@/components/browse-view";

export const metadata: Metadata = {
  title: "Browse lost and found items",
  description: "Search lost and found items on a map or as a list. Filter by category, distance and date.",
};

export default async function BrowsePage({ searchParams }: PageProps<"/browse">) {
  const sp = await searchParams;
  const flat = Object.fromEntries(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && v ? [[k, v]] : [])));
  const parsed = searchParamsSchema.safeParse({ ...flat, limit: 80 });
  const items = parsed.success ? await searchItems(parsed.data).catch(() => []) : [];
  return (
    <Suspense>
      <BrowseView initial={items} />
    </Suspense>
  );
}
