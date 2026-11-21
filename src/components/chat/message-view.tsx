"use client";

import type { ReactNode } from "react";
import { AlertCircle, Check, CheckCheck, Clock, ExternalLink, Handshake, Lock, MapPin, RotateCw, ShieldCheck, ShieldX } from "lucide-react";
import { MSG, type ClaimCardContent, type ClaimResultContent, type DeskNoticeContent, type HandoverCardContent } from "@/lib/nexconn/messages";
import type { ChatMessage } from "@/components/chat/use-conversation";
import { Button, StatusPill, cx } from "@/components/ui";

export function timeLabel(t: number) {
  return new Date(Math.min(t, Date.now())).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(t: number) {
  const d = new Date(Math.min(t, Date.now()));
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

/** Interleave day dividers ("Today", "Yesterday", "Mon 3 Nov") between messages. */
export function withDayDividers<T extends { id: string; sentTime: number }>(list: T[]): ({ kind: "day"; id: string; label: string } | { kind: "msg"; m: T })[] {
  const out: ({ kind: "day"; id: string; label: string } | { kind: "msg"; m: T })[] = [];
  let last = "";
  for (const m of list) {
    const label = dayLabel(m.sentTime);
    if (label !== last) {
      out.push({ kind: "day", id: `day-${m.id}`, label });
      last = label;
    }
    out.push({ kind: "msg", m });
  }
  return out;
}

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-line" />
      <span className="rounded-full bg-wash px-3 py-1 text-[12px] font-bold text-ink-2">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
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
  if (m.type === MSG.RESULT) return <ResultCard content={c as unknown as ClaimResultContent} time={m.sentTime} />;
  if (m.type === MSG.HANDOVER) return <HandoverCard m={m} content={c as unknown as HandoverCardContent} handlers={handlers} />;
  if (m.type === MSG.DESK) return <DeskNotice content={c as unknown as DeskNoticeContent} time={m.sentTime} />;

  let body: ReactNode;
  let flush = false;
  if (m.type === "RC:TxtMsg") {
    body = <p className="whitespace-pre-wrap break-words text-[16px] leading-snug">{String(c.text ?? c.content ?? "")}</p>;
  } else if (m.type === "RC:ImgMsg") {
    flush = true;
    const src = String(c.remoteUrl ?? c.imageUri ?? "");
    const thumb = c.thumbnailBase64 ? `data:image/jpeg;base64,${c.thumbnailBase64}` : src;
    body = (
      <a href={src || undefined} target="_blank" rel="noreferrer" className="relative block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src || thumb} alt="Photo" className="max-h-72 w-full max-w-[260px] object-cover" />
        {m.status === "sending" && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/75 px-2.5 py-1.5 text-xs font-semibold text-paper">
            Uploading {m.progress ? `${Math.round(m.progress)}%` : "…"}
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/20">
              <span className="block h-full bg-signal transition-[width]" style={{ width: `${Math.round(m.progress ?? 5)}%` }} />
            </span>
          </span>
        )}
      </a>
    );
  } else if (m.type === "RC:LBSMsg") {
    flush = true;
    const lat = Number(c.latitude);
    const lng = Number(c.longitude);
    body = (
      <a href={osmLink(lat, lng)} target="_blank" rel="noreferrer" className="block w-[230px]" data-testid="location-message">
        <span className="relative block h-[120px] bg-wash">
          {c.thumbnailBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/jpeg;base64,${c.thumbnailBase64}`} alt="" className="size-full object-cover" />
          ) : null}
          <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none bg-signal text-ink shadow-[var(--shadow-lift)] [transform:translate(-50%,-100%)_rotate(-45deg)]">
            <MapPin className="size-4 rotate-45" aria-hidden />
          </span>
        </span>
        <span className="flex items-start gap-1.5 px-3 pt-2 font-display text-[15px] font-bold leading-snug">{String(c.poi ?? "Shared location")}</span>
        <span className="flex items-center gap-1 px-3 pb-2.5 text-xs font-semibold opacity-75">
          <ExternalLink className="size-3" aria-hidden /> Open in map
        </span>
      </a>
    );
  } else {
    body = <p className="text-sm italic opacity-80">This message type isn&apos;t supported here.</p>;
  }

  const failed = m.status === "failed";
  const blockedCode = String(m.content._error) === "31009" || String(m.content._error) === "405";
  return (
    <div className={cx("animate-rise flex flex-col", m.mine ? "items-end" : "items-start")} data-testid="chat-message" data-mine={m.mine ? "1" : "0"}>
      {senderName && !m.mine && <span className="mb-1 px-1 font-display text-[12px] font-bold text-ink-2">{senderName}</span>}
      <div
        className={cx(
          "max-w-[82%] overflow-hidden rounded-[20px]",
          !flush && "px-3.5 py-2.5",
          m.mine ? "rounded-br-[6px] bg-ink text-paper" : "rounded-bl-[6px] border border-line bg-surface text-ink",
          m.status === "sending" && "opacity-80",
          failed && "border border-alert bg-alert-soft text-ink",
        )}
      >
        {body}
      </div>
      <div className="mt-1 flex items-center gap-1 px-1 text-[12px] text-ink-3">
        {m.status === "sending" && (
          <>
            <Clock className="size-3" aria-hidden /> Sending
          </>
        )}
        {failed && (
          <span className="flex items-center gap-1 font-semibold text-alert">
            <AlertCircle className="size-3" aria-hidden />
            {blockedCode ? "Not delivered: you can't message this person" : "Not sent"}
            {m.retry && (
              <button className="ml-1 inline-flex items-center gap-0.5 underline" onClick={() => void m.retry?.()}>
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
                <span className="inline-flex items-center gap-0.5 font-bold text-go" data-testid="read-receipt">
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

/** Cards are tickets: a header band, a body, and a perforated footer with notches. */
function Ticket({
  children,
  header,
  footer,
  tone = "plain",
  testid,
}: {
  children: ReactNode;
  header: ReactNode;
  footer?: ReactNode;
  tone?: "plain" | "go" | "signal" | "alert";
  testid?: string;
}) {
  const band = { plain: "bg-ink text-paper", go: "bg-go text-white", signal: "bg-signal text-ink", alert: "bg-alert text-white" }[tone];
  return (
    <div className="animate-rise flex justify-center" data-testid={testid}>
      <div className="w-full max-w-sm rounded-2xl border border-line-strong bg-surface shadow-[var(--shadow-lift)]">
        <div className={cx("flex items-center gap-2 rounded-t-[15px] px-4 py-2.5 font-display text-[13px] font-extrabold", band)}>{header}</div>
        <div className="p-4">{children}</div>
        {footer && (
          <>
            <div className="ticket-notch perforation-x relative h-px" aria-hidden />
            <div className="flex items-center justify-between gap-2 px-4 py-3">{footer}</div>
          </>
        )}
      </div>
    </div>
  );
}

function ClaimCard({ m, content, fallbackStatus }: { m: ChatMessage; content: ClaimCardContent; fallbackStatus?: string }) {
  const status = m.metadata.status ?? fallbackStatus ?? "pending";
  return (
    <Ticket
      testid="claim-card"
      header={
        <>
          <Lock className="size-3.5" aria-hidden /> Ownership claim
          <span className="ref-code ml-auto text-[12px] opacity-80">{content.itemCode}</span>
        </>
      }
      footer={
        <>
          <StatusPill status={status} />
          <span className="text-xs text-ink-3">{timeLabel(m.sentTime)}</span>
        </>
      }
    >
      <div className="flex gap-3">
        {content.itemPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.itemPhoto} alt="" className="size-14 shrink-0 rounded-xl border border-line object-cover" />
        )}
        <div className="min-w-0">
          <p className="font-display text-[18px] font-extrabold leading-tight">{content.itemTitle}</p>
          <p className="mt-0.5 text-sm text-ink-2">
            {content.claimantName} answered {content.questionCount} question{content.questionCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      {content.note && <p className="mt-3 rounded-xl bg-wash p-3 text-[15px]">&ldquo;{content.note}&rdquo;</p>}
    </Ticket>
  );
}

function ResultCard({ content, time }: { content: ClaimResultContent; time: number }) {
  return (
    <Ticket
      testid="result-card"
      tone={content.approved ? "go" : "alert"}
      header={
        <>
          {content.approved ? <ShieldCheck className="size-4" aria-hidden /> : <ShieldX className="size-4" aria-hidden />}
          {content.approved ? "Ownership confirmed" : "Claim declined"}
          <span className="ml-auto font-sans text-xs font-semibold opacity-80">{timeLabel(time)}</span>
        </>
      }
    >
      <p className="text-[15px] text-ink-2">
        {content.approved ? `The finder confirmed "${content.itemTitle}" is yours. Agree a place and time to meet.` : `The finder didn't recognise the answers for "${content.itemTitle}".`}
      </p>
      {content.note && <p className="mt-2 rounded-xl bg-wash p-3 text-[15px]">&ldquo;{content.note}&rdquo;</p>}
    </Ticket>
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
  const done = status === "accepted" || status === "returned";
  return (
    <Ticket
      testid="handover-card"
      tone={done ? "signal" : "plain"}
      header={
        <>
          <Handshake className="size-4" aria-hidden /> Meeting plan from {content.proposedByName}
        </>
      }
      footer={
        <>
          <span
            className={cx(
              "rounded-full px-2.5 py-0.5 text-[13px] font-bold",
              done ? "bg-go text-white" : status === "declined" ? "bg-alert-soft text-alert" : status === "superseded" ? "bg-wash text-ink-3 line-through" : "bg-signal-soft",
            )}
            data-testid="handover-status"
          >
            {label[status] ?? status}
          </span>
          <span className="ref-code text-[12px] text-ink-3">{content.itemCode}</span>
        </>
      }
    >
      <a href={osmLink(content.lat, content.lng)} target="_blank" rel="noreferrer" className="group flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink text-signal">
          <MapPin className="size-4" aria-hidden />
        </span>
        <span className="font-display text-[18px] font-extrabold leading-tight group-hover:underline group-hover:decoration-signal group-hover:decoration-2">{content.label}</span>
      </a>
      <p className="mt-2.5 flex items-center gap-2 pl-0.5 text-[15px] text-ink-2">
        <Clock className="size-4" aria-hidden />
        {at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, {at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
      {canRespond && (
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="ink" loading={handlers.handoverBusy} onClick={() => void handlers.onRespondHandover?.("accept")} data-testid="handover-accept">
            Accept
          </Button>
          <Button size="sm" variant="outline" disabled={handlers.handoverBusy} onClick={() => void handlers.onRespondHandover?.("decline")}>
            Suggest another
          </Button>
        </div>
      )}
    </Ticket>
  );
}

function DeskNotice({ content, time }: { content: DeskNoticeContent; time: number }) {
  return (
    <div className="animate-rise flex justify-center">
      <a href={content.href} className="group flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-wash px-3.5 py-3 text-left transition-colors hover:border-ink/50">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-signal font-display text-[13px] font-black text-ink" aria-hidden>
          LL
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-bold leading-snug">{content.title}</span>
          <span className="block text-sm text-ink-2">{content.body}</span>
          <span className="mt-0.5 block text-xs text-ink-3">LostLink, {timeLabel(time)}</span>
        </span>
      </a>
    </div>
  );
}
