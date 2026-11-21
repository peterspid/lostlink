"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Flag, MoreHorizontal, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { Banner, Button, Select, Textarea, cx } from "@/components/ui";
import { Sheet } from "@/components/sheet";

export function OwnerActions({ itemId, status, expiringSoon }: { itemId: string; status: string; expiringSoon: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  async function act(action: "renew" | "close" | "reopen") {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/items/${itemId}`, { method: "PATCH", body: { action } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the post.");
    } finally {
      setBusy(null);
      setConfirmClose(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Banner tone="error">{error}</Banner>}
      {(status === "expired" || expiringSoon) && (
        <Banner
          tone="signal"
          title={status === "expired" ? "This post has expired" : "This post expires soon"}
          action={
            <Button variant="ink" size="sm" loading={busy === "renew"} onClick={() => act("renew")} icon={<RotateCcw className="size-4" />}>
              Renew for 60 days
            </Button>
          }
        >
          {status === "expired" ? "It's hidden from search and no longer matching." : "Renew it to keep it visible and keep matching."}
        </Banner>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "open" && !expiringSoon && (
          <Button variant="outline" size="sm" loading={busy === "renew"} onClick={() => act("renew")} icon={<RotateCcw className="size-4" />}>
            Renew
          </Button>
        )}
        {status === "open" &&
          (confirmClose ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-sm">Close this post?</span>
              <Button variant="danger" size="sm" loading={busy === "close"} onClick={() => act("close")}>
                Yes, close it
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClose(false)}>
                Keep it open
              </Button>
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmClose(true)} icon={<XCircle className="size-4" />}>
              Close post
            </Button>
          ))}
        {status === "closed" && (
          <Button variant="outline" size="sm" loading={busy === "reopen"} onClick={() => act("reopen")} icon={<RotateCcw className="size-4" />}>
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}

export function RefreshMatches({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {msg && <span className="text-sm text-ink-2">{msg}</span>}
      <Button
        variant="ghost"
        size="sm"
        loading={busy}
        icon={<RefreshCw className="size-4" />}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await api<{ kept: number }>(`/api/items/${itemId}/matches`, { method: "POST" });
            setMsg(r.kept ? `${r.kept} match${r.kept === 1 ? "" : "es"}` : "No new matches");
            router.refresh();
          } catch (err) {
            setMsg(err instanceof ApiError ? err.message : "Couldn't refresh");
          } finally {
            setBusy(false);
          }
        }}
      >
        Check again
      </Button>
    </span>
  );
}

/** Report an item or person, or block a person. Available on items, claims and chats. */
export function SafetyMenu({ itemId, userId, userName, blocked: initialBlocked = false, onBlockedChange }: { itemId?: string; userId?: string; userName?: string; blocked?: boolean; onBlockedChange?: (b: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "report" | "done">("menu");
  const [reason, setReason] = useState("scam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [doneText, setDoneText] = useState("");

  async function sendReport() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/reports", { body: { itemId, userId, reason, details } });
      setDoneText("Thanks. We've recorded your report. Posts reported by several people are hidden automatically.");
      setMode("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/blocks", { method: blocked ? "DELETE" : "POST", body: { userId } });
      const nb = !blocked;
      setBlocked(nb);
      onBlockedChange?.(nb);
      setDoneText(nb ? `${userName ?? "This person"} can no longer message you or claim your items.` : `${userName ?? "This person"} is unblocked.`);
      setMode("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the block.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMode("menu");
          setError(null);
        }}
        className="flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-wash hover:text-ink"
        aria-label="Report or block"
        data-testid="safety-menu"
      >
        <MoreHorizontal className="size-5" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={mode === "report" ? "Report" : "Safety"}>
        {error && (
          <div className="mb-3">
            <Banner tone="error">{error}</Banner>
          </div>
        )}
        {mode === "menu" && (
          <div className="flex flex-col gap-2">
            <button className={menuRow} onClick={() => setMode("report")}>
              <Flag className="size-5" aria-hidden />
              <span>
                <span className="block font-semibold">{itemId ? "Report this post" : `Report ${userName ?? "this person"}`}</span>
                <span className="text-sm text-ink-2">Scams, fake posts, offensive content, personal information.</span>
              </span>
            </button>
            {userId && (
              <button className={cx(menuRow, !blocked && "text-alert")} onClick={toggleBlock} disabled={busy}>
                <Ban className="size-5" aria-hidden />
                <span>
                  <span className="block font-semibold">{blocked ? `Unblock ${userName ?? "this person"}` : `Block ${userName ?? "this person"}`}</span>
                  <span className="text-sm text-ink-2">{blocked ? "They'll be able to message you again." : "They won't be able to message you or claim your items."}</span>
                </span>
              </button>
            )}
          </div>
        )}
        {mode === "report" && (
          <div className="flex flex-col gap-3">
            <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="scam">Scam or trying to get money</option>
              <option value="fake">Fake or misleading post</option>
              <option value="offensive">Offensive or abusive</option>
              <option value="personal-info">Shows someone&apos;s personal information</option>
              <option value="other">Something else</option>
            </Select>
            <Textarea aria-label="Details" placeholder="What happened? (optional)" value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} />
            <Button onClick={sendReport} loading={busy}>
              Send report
            </Button>
          </div>
        )}
        {mode === "done" && (
          <div className="flex flex-col gap-3">
            <p>{doneText}</p>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

const menuRow = "flex w-full items-start gap-3 rounded-lg border border-line p-3.5 text-left hover:border-ink";
