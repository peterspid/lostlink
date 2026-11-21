/**
 * Custom Nexconn message types shared by client and server.
 * Types must not start with RC:/NC: and must be <= 32 characters.
 */
export const MSG = {
  /** Claim card: claimant -> finder, in their direct channel. State lives in message metadata. */
  CLAIM: "LLK:ClaimCard",
  /** Verification result card: finder -> claimant after approve/reject. */
  RESULT: "LLK:ClaimResult",
  /** Handover card: proposed meeting time + place. State lives in message metadata. */
  HANDOVER: "LLK:Handover",
  /** System notice (match / alert / reminders) sent through the system channel. */
  NOTICE: "LLK:Notice",
  /** Desk staff group notice (new item logged, new claim) sent by the LostLink bot. */
  DESK: "LLK:DeskNotice",
} as const;

export type CustomMessageType = (typeof MSG)[keyof typeof MSG];

export interface ClaimCardContent {
  claimId: string;
  itemId: string;
  itemCode: string;
  itemTitle: string;
  itemPhoto?: string;
  claimantName: string;
  questionCount: number;
  note?: string;
}

export interface ClaimResultContent {
  claimId: string;
  itemCode: string;
  itemTitle: string;
  approved: boolean;
  note?: string;
}

export interface HandoverCardContent {
  claimId: string;
  itemCode: string;
  label: string;
  lat: number;
  lng: number;
  at: string;
  proposedByName: string;
}

export interface NoticeContent {
  kind: "match" | "alert" | "claim" | "decision" | "handover" | "returned" | "expiry" | "desk";
  title: string;
  body: string;
  href: string;
}

export interface DeskNoticeContent {
  deskId: string;
  title: string;
  body: string;
  href: string;
}

/** Metadata keys (message expansion) used for card state. */
export type ClaimCardMeta = { status: "pending" | "approved" | "rejected" | "returned" | "cancelled" };
export type HandoverMeta = {
  status: "proposed" | "accepted" | "declined" | "superseded" | "returned";
};

export const CUSTOM_MESSAGE_REGISTRATIONS = [
  { messageType: MSG.CLAIM, isPersisted: true, isCounted: true },
  { messageType: MSG.RESULT, isPersisted: true, isCounted: true },
  { messageType: MSG.HANDOVER, isPersisted: true, isCounted: true },
  { messageType: MSG.NOTICE, isPersisted: true, isCounted: true },
  { messageType: MSG.DESK, isPersisted: true, isCounted: true },
] as const;
