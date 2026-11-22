import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LostLink: lost & found",
    short_name: "LostLink",
    description: "Post what you lost or found. LostLink matches posts, checks ownership and lets you arrange the handover in a private chat.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f3ee",
    theme_color: "#10243a",
    categories: ["utilities", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "I lost something", url: "/report?kind=lost", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "I found something", url: "/report?kind=found", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Chats", url: "/chats", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
