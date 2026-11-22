import type { MetadataRoute } from "next";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";

// Read per request so new posts and desks are discoverable straight away.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/browse`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/desks/new`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
  try {
    const [items, desks] = await Promise.all([
      db()
        .select({ id: schema.items.id, updatedAt: schema.items.updatedAt })
        .from(schema.items)
        .where(and(eq(schema.items.status, "open"), gt(schema.items.expiresAt, new Date())))
        .orderBy(desc(schema.items.createdAt))
        .limit(1000),
      db().select({ slug: schema.desks.slug, createdAt: schema.desks.createdAt }).from(schema.desks).limit(500),
    ]);
    return [
      ...pages,
      ...desks.map((d) => ({ url: `${base}/desks/${d.slug}`, lastModified: d.createdAt, changeFrequency: "daily" as const, priority: 0.7 })),
      ...items.map((i) => ({ url: `${base}/items/${i.id}`, lastModified: i.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
    ];
  } catch {
    // The static pages are still worth listing if the database is unreachable.
    return pages;
  }
}
