"use client";

import { AlertCircle, Check, CheckCheck, Clock, Handshake, Lock, MapPin, RotateCw, ShieldCheck, ShieldX } from "lucide-react";
import { MSG, type ClaimCardContent, type ClaimResultContent, type DeskNoticeContent, type HandoverCardContent } from "@/lib/nexconn/messages";
import type { ChatMessage } from "@/components/chat/use-conversation";
import { Button, StatusPill, cx } from "@/components/ui";

export function timeLabel(t: number) {
  return new Date(Math.min(t, Date.now())).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function osmLink(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

export interface CardHandlers {
  claimStatus?: string;
  role?: "owner" | "finder";
  myUserId?: string | null;
  onRespondHandover?: (action: "accept" | "decline") => Promise<void>;
  handoverBusy?: boolean;
  activeHandoverMessageId?: string | null;
}

export function MessageView({ m, senderName, handlers }: { m: ChatMessage; senderName?: string; handlers: CardHandlers }) {
  const c = m.content;
  if (m.type === MSG.CLAIM) return <ClaimCard m={m} content={c as unknown as ClaimCardContent} fallbackStatus={handlers.claimStatus} />;
  if (m.type === MSG.RESULT) return <ResultCard content={c as unknown as ClaimResultContent} />;
  if (m.type === MSG.HANDOVER) return <HandoverCard m={m} content={c as unknown as HandoverCardContent} handlers={handlers} />;
  if (m.type === MSG.DESK) return <DeskNotice content={c as unknown as DeskNoticeContent} time={m.sentTime} />;

  let body: React.ReactNode;
  if (m.type === "RC:TxtMsg") {
    body = <p className="whitespace-pre-wrap break-words text-[16px] leading-snug">{String(c.text ?? c.content ?? "")}</p>;
  } else if (m.type === "RC:ImgMsg") {
    const src = String(c.remoteUrl ?? c.imageUri ?? "");
    const thumb = c.thumbnailBase64 ? `data:image/jpeg;base64,${c.thumbnailBase64}` : src;
    body = (
      <a href={src || undefined} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src || thumb} alt="Photo" className="max-h-72 w-full max-w-[260px] rounded-md object-cover" />
        {m.status === "sending" && <span className="mt-1 block text-xs opacity-80">Uploading {m.progress ? `${Math.round(m.progress)}%` : "…"}</span>}
      </a>
    );
  } else if (m.type === "RC:LBSMsg") {
    const lat = Number(c.latitude);
    const lng = Number(c.longitude);
    body = (
      <a href={osmLink(lat, lng)} target="_blank" rel="noreferrer" className="block w-[220px]" data-testid="location-message">
        {c.thumbnailBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/jpeg;base64,${c.thumbnailBase64}`} alt="" className="h-[120px] w-full rounded-md object-cover" />
        ) : null}
        <span className="mt-1.5 flex items-start gap-1.5 text-[15px] font-semibold">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          {String(c.poi ?? "Shared location")}
        </span>
        <span className="text-xs underline opacity-80">Open in map</span>
      </a>
    );
  } else {
    body = <p className="text-sm italic opacity-80">This message type isn&apos;t supported here.</p>;
  }

  return (
    <div className={cx("flex flex-col", m.mine ? "items-end" : "items-start")} data-testid="chat-message" data-mine={m.mine ? "1" : "0"}>
      {senderName && !m.mine && <span className="mb-0.5 px-1 text-xs font-semibold text-ink-2">{senderName}</span>}
      <div
        className={cx(
          "max-w-[82%] rounded-2xl px-3.5 py-2",
          m.mine ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md border border-line bg-surface text-ink",
          m.status === "failed" && "border border-alert bg-alert-soft text-ink",
        )}
      >
        {body}
      </div>
      <div className="mt-0.5 flex items-center gap-1 px-1 text-[12px] text-ink-3">
        {m.status === "sending" && (
          <>
            <Clock className="size-3" aria-hidden /> Sending
          </>
        )}
        {m.status === "failed" && (
          <span className="flex items-center gap-1 text-alert">
            <AlertCircle className="size-3" aria-hidden />
            {String(m.content._error) === "31009" || String(m.content._error) === "405" ? "Not delivered: you can't message this person" : "Not sent"}
            {m.retry && (
              <button className="ml-1 inline-flex items-center gap-0.5 font-semibold underline" onClick={() => void m.retry?.()}>
                <RotateCw className="size-3" aria-hidden /> Retry
              </button>
            )}
          </span>
        )}
        {m.status === "sent" && (
          <>
            {timeLabel(m.sentTime)}
            {m.mine &&
              (m.read ? (
                <span className="inline-flex items-center gap-0.5 font-semibold text-ink" data-testid="read-receipt">
                  <CheckCheck className="size-3.5" aria-hidden /> Read
                </span>
              ) : (
                <Check className="size-3.5" aria-label="Delivered" />
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function CardShell({ children, tone = "plain", testid }: { children: React.ReactNode; tone?: "plain" | "signal" | "ink"; testid?: string }) {
  return (
    <div className="flex justify-center" data-testid={testid}>
      <div
        className={cx(
          "w-full max-w-sm rounded-xl border-2 p-4",
          tone === "signal" ? "border-signal-deep bg-signal-soft" : tone === "ink" ? "border-ink bg-surface" : "border-line-strong bg-surface",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ClaimCard({ m, content, fallbackStatus }: { m: ChatMessage; content: ClaimCardContent; fallbackStatus?: string }) {
  const status = m.metadata.status ?? fallbackStatus ?? "pending";
  return (
    <CardShell tone="ink" testid="claim-card">
      <div className="flex items-center gap-2">
        <Lock className="size-4" aria-hidden />
        <span className="font-display text-sm font-extrabold">Ownership claim</span>
        <span className="ref-code ml-auto text-xs text-ink-3">{content.itemCode}</span>
      </div>
      <div className="mt-3 flex gap-3">
        {content.itemPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.itemPhoto} alt="" className="size-14 rounded-md border border-line object-cover" />
        )}
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{content.itemTitle}</p>
          <p className="text-sm text-ink-2">
            {content.claimantName} answered {content.questionCount} question{content.questionCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      {content.note && <p className="mt-3 rounded-md bg-wash p-2.5 text-[15px]">&ldquo;{content.note}&rdquo;</p>}
      <div className="mt-3 flex items-center justify-between">
        <StatusPill status={status} />
        <span className="text-xs text-ink-3">{timeLabel(m.sentTime)}</span>
      </div>
    </CardShell>
  );
}

function ResultCard({ content }: { content: ClaimResultContent }) {
  return (
    <CardShell tone={content.approved ? "signal" : "plain"} testid="result-card">
      <div className="flex items-start gap-3">
        {content.approved ? <ShieldCheck className="size-6 shrink-0" aria-hidden /> : <ShieldX className="size-6 shrink-0 text-alert" aria-hidden />}
        <div>
          <p className="font-display text-lg font-extrabold">{content.approved ? "Ownership confirmed" : "Claim declined"}</p>
          <p className="text-[15px] text-ink-2">
            {content.approved ? `The finder confirmed "${content.itemTitle}" is yours. Agree a place and time to meet.` : `The finder didn't recognise the answers for "${content.itemTitle}".`}
          </p>
          {content.note && <p className="mt-2 text-[15px]">&ldquo;{content.note}&rdquo;</p>}
        </div>
      </div>
    </CardShell>
  );
}

function HandoverCard({ m, content, handlers }: { m: ChatMessage; content: HandoverCardContent; handlers: CardHandlers }) {
  const status = m.metadata.status ?? "proposed";
  const at = new Date(content.at);
  const canRespond = status === "proposed" && !m.mine && handlers.onRespondHandover && handlers.activeHandoverMessageId === m.id;
  const label: Record<string, string> = {
    proposed: m.mine ? "Waiting for a reply" : "Proposed",
    accepted: "Confirmed",
    declined: "Declined",
    superseded: "Replaced by a newer plan",
    returned: "Handed over",
  };
  return (
    <CardShell tone={status === "accepted" || status === "returned" ? "signal" : "ink"} testid="handover-card">
      <div className="flex items-center gap-2">
        <Handshake className="size-4" aria-hidden />
        <span className="font-display text-sm font-extrabold">Handover plan from {content.proposedByName}</span>
      </div>
      <a href={osmLink(content.lat, content.lng)} target="_blank" rel="noreferrer" className="mt-3 flex items-start gap-2 font-display text-lg font-bold leading-tight underline-offset-2 hover:underline">
        <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
        {content.label}
      </a>
      <p className="mt-1 flex items-center gap-2 text-[15px] text-ink-2">
        <Clock className="size-4" aria-hidden />
        {at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, {at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className={cx("rounded-full px-2.5 py-0.5 text-[13px] font-semibold", status === "accepted" || status === "returned" ? "bg-ink text-paper" : "bg-wash")} data-testid="handover-status">
          {label[status] ?? status}
        </span>
      </div>
      {canRespond && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="ink" loading={handlers.handoverBusy} onClick={() => void handlers.onRespondHandover?.("accept")} data-testid="handover-accept">
            Accept
          </Button>
          <Button size="sm" variant="outline" disabled={handlers.handoverBusy} onClick={() => void handlers.onRespondHandover?.("decline")}>
            Suggest another
          </Button>
        </div>
      )}
    </CardShell>
  );
}

function DeskNotice({ content, time }: { content: DeskNoticeContent; time: number }) {
  return (
    <div className="flex justify-center">
      <a href={content.href} className="w-full max-w-sm rounded-lg border border-line bg-wash px-3.5 py-2.5 text-left hover:border-ink">
        <span className="block text-[15px] font-semibold">{content.title}</span>
        <span className="block text-sm text-ink-2">{content.body}</span>
        <span className="mt-0.5 block text-xs text-ink-3">LostLink, {timeLabel(time)}</span>
      </a>
    </div>
  );
}
