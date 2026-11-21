import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic dynamic rendering model: every page that reads the session cookie
  // renders per request. Keeps auth-gated pages simple and correct.
  cacheComponents: false,
  partialPrefetching: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
