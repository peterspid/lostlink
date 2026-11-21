"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, CheckCircle2, ChevronDown, ChevronUp, Heart, PackageCheck, ShieldCheck, X } from "lucide-react";
import type { ClaimView } from "@/lib/claim-view";
import { api, ApiError } from "@/lib/client-api";
import { locationThumbnail } from "@/lib/map-thumb";
import { MSG } from "@/lib/nexconn/messages";
import { useChat, useChatEvents } from "@/components/chat/chat-provider";
import { useConversation } from "@/components/chat/use-conversation";
import { MessageView } from "@/components/chat/message-view";
import { Composer } from "@/components/chat/composer";
import { LocationField, type LocationValue } from "@/components/location-field";
import { SafetyMenu } from "@/components/item-actions";
import { Sheet } from "@/components/sheet";
import { Banner, Button, Field, Input, Spinner, StatusPill, Textarea, cx } from "@/components/ui";

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function ChatRoom({ initial, justClaimed }: { initial: ClaimView; justClaimed: boolean }) {
  const [claim, setClaim] = useState(initial);
  const { status } = useChat();
  const convo = useConversation("direct", claim.other.nexconnId);
  const [panelOpen, setPanelOpen] = useState(initial.status === "pending" && initial.role === "finder");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(initial.blockedByMe);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const reload = useCallback(async () => {
    try {
      const { claim: c } = await api<{ claim: ClaimView }>(`/api/claims/${claim.id}`);
      setClaim(c);
    } catch {
      /* keep current state */
    }
  }, [claim.id]);

  // Card state changes (metadata) and new cards mean the claim moved on: refresh it.
  useChatEvents((e) => {
    if (e.type === "metadata") void reload();
    if (e.type === "message" && [MSG.RESULT, MSG.HANDOVER, MSG.CLAIM].includes(e.message.messageType as never)) void reload();
    if (e.type === "notice" && e.notice.href.includes(claim.id)) void reload();
  });

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [convo.messages.length, convo.typing]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  async function run(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const decide = (approve: boolean, note = "") =>
    run(approve ? "approve" : "reject", () => api(`/api/claims/${claim.id}/decision`, { body: { approve, note } })).then(() => setPanelOpen(false));
  const respondHandover = (action: "accept" | "decline") => run("handover", () => api(`/api/claims/${claim.id}/handover`, { method: "PATCH", body: { action } }));
  const markReturned = () => run("returned", () => api(`/api/claims/${claim.id}/returned`, { method: "POST" }));

  const isFinder = claim.role === "finder";
  const closed = claim.status === "rejected" || claim.status === "cancelled";
  const blocked = blockedByMe || claim.blockedMe;
  const composerDisabled = blocked || (closed && !isFinder) || claim.status === "cancelled";
  const disabledReason = blockedByMe
    ? `You blocked ${claim.other.name}. Unblock them from the menu to chat.`
    : claim.blockedMe
      ? "You can't message this person."
      : claim.status === "rejected"
        ? "The finder declined this claim."
        : "This claim was withdrawn.";

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-3xl flex-col bg-paper">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2">
        <Link href="/chats" className="flex size-10 items-center justify-center rounded-lg hover:bg-wash" aria-label="Back to chats">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] font-extrabold leading-tight" data-testid="chat-title">
            {claim.other.name}
            <span className="ml-2 text-sm font-semibold text-ink-3">{isFinder ? "says it's theirs" : "found it"}</span>
          </p>
          <p className="truncate text-sm text-ink-2">
            {convo.typing ? (
              <span className="font-semibold text-ink" data-testid="typing">
                typing…
              </span>
            ) : (
              <>
                <span className="ref-code text-xs">{claim.item.code}</span> {claim.item.title}
              </>
            )}
          </p>
        </div>
        <StatusPill status={claim.status} className="hidden sm:inline-flex" />
        <SafetyMenu userId={claim.other.id} userName={claim.other.name} blocked={blockedByMe} onBlockedChange={setBlockedByMe} />
      </div>

      {/* Claim panel */}
      <div className="border-b border-line bg-surface">
        <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 text-[15px] font-semibold">
            {claim.status === "pending" && (isFinder ? "Check their answers" : `Waiting for ${claim.other.name} to check your answers`)}
            {claim.status === "approved" && (claim.handover?.status === "accepted" ? "Handover agreed" : "Approved: arrange the handover")}
            {claim.status === "returned" && "Returned. Case closed."}
            {claim.status === "rejected" && "Claim declined"}
            {claim.status === "cancelled" && "Claim withdrawn"}
          </span>
          <StatusPill status={claim.status} className="sm:hidden" />
          {panelOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </button>
        {panelOpen && (
          <div className="max-h-[45dvh] overflow-y-auto border-t border-line px-4 py-3" data-testid="claim-panel">
            {!isFinder && claim.other.returnedCount > 0 && (
              <p className="mb-2 flex items-center gap-1.5 text-sm text-ink-2">
                <BadgeCheck className="size-4" aria-hidden /> {claim.other.name} has returned {claim.other.returnedCount} item{claim.other.returnedCount === 1 ? "" : "s"} ({claim.other.karma} karma).
              </p>
            )}
            <ul className="flex flex-col gap-2.5">
              {claim.answers.map((a, i) => (
                <li key={i} className="rounded-lg border border-line p-3">
                  <p className="text-sm text-ink-3">{a.question}</p>
                  <p className="mt-0.5 font-semibold" data-testid="panel-answer">
                    {a.answer}
                  </p>
                  {isFinder && a.expected !== undefined && (
                    <p className={cx("mt-1.5 flex items-center gap-1.5 text-sm", a.looksRight ? "text-ink" : "text-alert")}>
                      {a.looksRight ? <CheckCircle2 className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                      Your answer: {a.expected}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {claim.note && <p className="mt-2.5 rounded-md bg-wash p-2.5 text-[15px]">&ldquo;{claim.note}&rdquo;</p>}
            {isFinder && claim.status === "pending" && <DecisionButtons busy={busy} onDecide={decide} />}
            {!isFinder && claim.status === "pending" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                loading={busy === "withdraw"}
                onClick={() => run("withdraw", () => api(`/api/claims/${claim.id}`, { method: "DELETE" }))}
              >
                Withdraw claim
              </Button>
            )}
          </div>
        )}
        {actionError && (
          <div className="px-4 pb-3">
            <Banner tone="error" onClose={() => setActionError(null)}>
              {actionError}
            </Banner>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4" aria-live="polite" data-testid="message-list">
        {justClaimed && claim.status === "pending" && (
          <div className="mb-4">
            <Banner tone="success" title="Claim sent">
              {claim.other.name} will check your answers. You&apos;ll get a notification when they reply. You can chat here meanwhile.
            </Banner>
          </div>
        )}
        {convo.hasMore && (
          <div className="mb-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void convo.loadEarlier()}>
              Load earlier messages
            </Button>
          </div>
        )}
        {(convo.loading || status === "connecting") && convo.messages.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner label="Loading conversation" />
          </div>
        ) : convo.error ? (
          <Banner tone="error">{convo.error}</Banner>
        ) : (
          <div className="flex flex-col gap-3">
            {convo.messages.map((m) => (
              <MessageView
                key={m.id}
                m={m}
                handlers={{
                  claimStatus: claim.status,
                  role: claim.role,
                  myUserId: convo.me,
                  onRespondHandover: claim.status === "approved" ? respondHandover : undefined,
                  handoverBusy: busy === "handover",
                  activeHandoverMessageId: claim.handover?.status === "proposed" ? claim.handover.messageId : null,
                }}
              />
            ))}
          </div>
        )}
        {convo.typing && (
          <p className="mt-2 text-sm text-ink-3" aria-hidden>
            {claim.other.name} is typing…
          </p>
        )}
      </div>

      {/* Handover / returned bar */}
      {claim.status === "approved" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-3 py-2">
          <Button size="sm" variant="outline" onClick={() => setHandoverOpen(true)} data-testid="open-handover">
            {claim.handover ? "Change meeting plan" : "Propose meeting point"}
          </Button>
          {(isFinder ? claim.finderReturned : claim.ownerReturned) ? (
            <span className="text-sm text-ink-2" data-testid="waiting-returned">
              Waiting for {claim.other.name} to confirm the handover
            </span>
          ) : (
            <Button size="sm" variant="signal" loading={busy === "returned"} onClick={markReturned} icon={<PackageCheck className="size-4" aria-hidden />} data-testid="mark-returned">
              {isFinder ? "I handed it over" : "I got it back"}
            </Button>
          )}
        </div>
      )}
      {claim.status === "returned" && <ReturnedBar claim={claim} onThanked={reload} />}

      <Composer
        disabled={composerDisabled}
        disabledReason={disabledReason}
        onSend={(t) => void convo.sendText(t)}
        onImage={(f) => void convo.sendImage(f)}
        onLocation={claim.status === "approved" ? () => setHandoverOpen(true) : undefined}
        onTyping={convo.notifyTyping}
      />

      <HandoverSheet
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        claimId={claim.id}
        sendLocation={convo.sendLocation}
        onDone={async () => {
          setHandoverOpen(false);
          await reload();
        }}
      />
    </div>
  );
}

function DecisionButtons({ busy, onDecide }: { busy: string | null; onDecide: (approve: boolean, note?: string) => Promise<void> }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  if (rejecting) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <Textarea aria-label="Reason (optional)" placeholder="Optional: tell them why, kindly." value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="danger" loading={busy === "reject"} onClick={() => void onDecide(false, note)}>
            Decline claim
          </Button>
          <Button variant="ghost" onClick={() => setRejecting(false)}>
            Back
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 flex gap-2">
      <Button variant="ink" loading={busy === "approve"} onClick={() => void onDecide(true)} icon={<ShieldCheck className="size-4" aria-hidden />} data-testid="approve-claim">
        Approve, it&apos;s theirs
      </Button>
      <Button variant="outline" onClick={() => setRejecting(true)} data-testid="reject-claim">
        Decline
      </Button>
    </div>
  );
}

function HandoverSheet({
  open,
  onClose,
  claimId,
  sendLocation,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  claimId: string;
  sendLocation: (loc: { latitude: number; longitude: number; poi: string; thumbnailBase64: string }) => Promise<void>;
  onDone: () => Promise<void>;
}) {
  const [loc, setLoc] = useState<LocationValue | null>(null);
  const [at, setAt] = useState(() => localInput(new Date(Date.now() + 2 * 3600_000)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!loc) return setError("Drop a pin on the meeting point.");
    if (loc.label.trim().length < 2) return setError("Name the meeting point, e.g. Main gate, City Mall.");
    const when = new Date(at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 3600_000) return setError("Pick a time from now on.");
    setBusy(true);
    setError(null);
    try {
      // 1) Share the spot as a Nexconn location message, 2) send the handover card.
      const thumb = await locationThumbnail(loc.lat, loc.lng).catch(() => "");
      await sendLocation({ latitude: loc.lat, longitude: loc.lng, poi: loc.label.trim(), thumbnailBase64: thumb });
      await api(`/api/claims/${claimId}/handover`, { body: { lat: loc.lat, lng: loc.lng, label: loc.label.trim(), at: when.toISOString() } });
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the plan. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Propose a meeting point">
      <div className="flex flex-col gap-4">
        <p className="text-[15px] text-ink-2">Pick a busy public place: a café, a station entrance, a security desk.</p>
        {error && <Banner tone="error">{error}</Banner>}
        <LocationField value={loc} onChange={setLoc} labelPlaceholder="e.g. Main entrance, City Mall" mapClassName="h-52" />
        <Field label="When" htmlFor="handover-at">
          <Input id="handover-at" type="datetime-local" value={at} min={localInput(new Date())} onChange={(e) => setAt(e.target.value)} />
        </Field>
        <Button size="lg" onClick={submit} loading={busy} data-testid="send-handover">
          Send meeting plan
        </Button>
      </div>
    </Sheet>
  );
}

function ReturnedBar({ claim, onThanked }: { claim: ClaimView; onThanked: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (claim.thankYou) {
    return (
      <div className="border-t border-line bg-signal-soft px-4 py-3 text-[15px]" data-testid="thank-you">
        <Heart className="mr-1.5 inline size-4" aria-hidden />
        {claim.role === "finder" ? `${claim.other.name} wrote: ` : "You wrote: "}&ldquo;{claim.thankYou}&rdquo;
      </div>
    );
  }
  if (claim.role === "finder") {
    return (
      <div className="border-t border-line bg-signal-soft px-4 py-3 text-[15px]" data-testid="returned-done">
        <CheckCircle2 className="mr-1.5 inline size-4" aria-hidden />
        Returned. You earned karma for handing it in. Thank you.
      </div>
    );
  }
  return (
    <div className="border-t border-line bg-signal-soft px-3 py-3" data-testid="returned-done">
      <p className="mb-2 text-[15px] font-semibold">It&apos;s back with you. Say thanks to {claim.other.name}?</p>
      {error && <p className="mb-2 text-sm text-alert">{error}</p>}
      <div className="flex gap-2">
        <Input aria-label="Thank-you note" placeholder="Thank you so much for handing it in!" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} data-testid="thanks-input" />
        <Button
          loading={busy}
          data-testid="send-thanks"
          onClick={async () => {
            if (text.trim().length < 2) return setError("Write a short note.");
            setBusy(true);
            setError(null);
            try {
              await api(`/api/claims/${claim.id}/thanks`, { body: { text: text.trim() } });
              await onThanked();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Couldn't send.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Send thanks
        </Button>
      </div>
    </div>
  );
}
