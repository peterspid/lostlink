import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Overpass } from "next/font/google";
import "./globals.css";
import { currentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { appUrl } from "@/lib/env";

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

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "LostLink: lost & found that reunites people with their things", template: "%s | LostLink" },
  description:
    "Post what you lost or found in under a minute. LostLink matches lost and found posts, checks ownership, and lets you arrange the handover in a private chat.",
  applicationName: "LostLink",
  appleWebApp: { capable: true, title: "LostLink", statusBarStyle: "default" },
  openGraph: { siteName: "LostLink", type: "website" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
};

export const viewport: Viewport = {
  themeColor: "#f3f4f0",
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
