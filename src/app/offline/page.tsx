import { WifiOff } from "lucide-react";
import { Pictogram } from "@/components/ui";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <Pictogram size="lg">
        <WifiOff />
      </Pictogram>
      <h1 className="mt-6 text-[34px] font-black leading-tight">You&apos;re offline</h1>
      <p className="mt-2 text-[17px] text-ink-2">LostLink needs a connection to search, post and chat. It picks up where you left off when you&apos;re back online.</p>
    </div>
  );
}
