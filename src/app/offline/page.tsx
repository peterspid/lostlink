import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <WifiOff className="size-10" aria-hidden />
      <h1 className="mt-4 text-3xl font-extrabold">You&apos;re offline</h1>
      <p className="mt-2 text-ink-2">LostLink needs a connection to search, post and chat. It will pick up where you left off when you&apos;re back online.</p>
    </div>
  );
}
