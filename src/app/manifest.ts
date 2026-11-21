import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LostLink: lost & found",
    short_name: "LostLink",
    description: "Post what you lost or found. LostLink matches posts, checks ownership and lets you arrange the handover in a private chat.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f4f0",
    theme_color: "#f3f4f0",
    categories: ["utilities", "lifestyle"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "I lost something", url: "/report?kind=lost" },
      { name: "I found something", url: "/report?kind=found" },
      { name: "Chats", url: "/chats" },
    ],
  };
}
