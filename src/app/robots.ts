import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

/** Public pages are crawlable; accounts, chats and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/chats", "/profile", "/notifications", "/alerts", "/report", "/login", "/signup", "/desks/join/", "/desks/*/manage", "/items/*/claim"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
