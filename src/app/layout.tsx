import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Overpass } from "next/font/google";
import "./globals.css";
import { currentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { appUrl } from "@/lib/env";

// Overpass descends from US highway signage; Atkinson Hyperlegible was drawn for low-vision readers.
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  display: "swap",
});

const description =
  "Post what you lost or found in under a minute. LostLink matches lost and found posts, checks who the real owner is, and opens a private chat to arrange the handover. No phone numbers swapped.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "LostLink: lost & found that reunites people with their things", template: "%s | LostLink" },
  description,
  applicationName: "LostLink",
  keywords: ["lost and found", "lost property", "found item", "lost wallet", "lost phone", "lost keys", "campus lost and found", "QR lost and found desk"],
  appleWebApp: { capable: true, title: "LostLink", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { siteName: "LostLink", type: "website", locale: "en", description },
  twitter: { card: "summary_large_image", description },
};

export const viewport: Viewport = {
  themeColor: "#f2f3ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${overpass.variable} ${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell user={user ? { id: user.id, name: user.name } : null}>{children}</AppShell>
      </body>
    </html>
  );
}
