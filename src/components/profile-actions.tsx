"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { api } from "@/lib/client-api";
import { disconnectChat } from "@/components/chat/chat-provider";
import { Button } from "@/components/ui";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="paper"
      loading={busy}
      icon={<LogOut className="size-4" aria-hidden />}
      onClick={async () => {
        setBusy(true);
        await disconnectChat().catch(() => undefined);
        await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        // Full reload so the server layout drops the session and chat disconnects cleanly.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      }}
    >
      Sign out
    </Button>
  );
}

export function UnblockButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await api("/api/blocks", { method: "DELETE", body: { userId } }).catch(() => undefined);
        router.refresh();
      }}
    >
      Unblock
    </Button>
  );
}

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Delete my account
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-alert/40 bg-alert-soft p-4">
      <p className="text-[15px]">This deletes your posts, claims, alerts and desks. Type DELETE to confirm.</p>
      <div className="flex gap-2">
        <input
          aria-label="Type DELETE to confirm"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          variant="danger"
          size="sm"
          className="h-10"
          disabled={text !== "DELETE"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await disconnectChat().catch(() => undefined);
            await api("/api/auth/account", { method: "DELETE", body: { confirm: "DELETE" } }).catch(() => undefined);
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/");
          }}
        >
          Delete
        </Button>
        <Button variant="ghost" size="sm" className="h-10" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
