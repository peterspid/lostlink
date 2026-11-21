import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Minimal typed client for the Nexconn Platform Chat API (server REST).
 * Signature = hex SHA1(appSecret + nonce + timestamp). Secret never leaves the server.
 */

export class NexconnError extends Error {
  constructor(
    message: string,
    public code: number | string,
    public path: string,
  ) {
    super(message);
  }
}

function authHeaders(): Record<string, string> {
  const { NEXCONN_APP_KEY, NEXCONN_APP_SECRET } = env();
  const nonce = randomBytes(8).toString("hex").slice(0, 16);
  const timestamp = Date.now().toString();
  const signature = createHash("sha1")
    .update(NEXCONN_APP_SECRET + nonce + timestamp)
    .digest("hex");
  return {
    "App-Key": NEXCONN_APP_KEY,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: signature,
    "Content-Type": "application/json",
  };
}

const BACKUP_BASE = "https://api-b.sg-light-api.com";

async function call<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  const bases = [env().NEXCONN_API_BASE, BACKUP_BASE];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const base = bases[attempt === 2 ? 1 : 0];
    try {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { code?: number; msg?: string; errorMessage?: string };
      if (json.code === 0 || json.code === 200) return json as T;
      // Rate limited or server error: retry. Business errors: throw immediately.
      if (res.status >= 500 || res.status === 429) {
        lastErr = new NexconnError(json.msg ?? json.errorMessage ?? `HTTP ${res.status}`, json.code ?? res.status, path);
      } else {
        throw new NexconnError(json.msg ?? json.errorMessage ?? `Nexconn error ${json.code}`, json.code ?? res.status, path);
      }
    } catch (err) {
      if (err instanceof NexconnError && !(Number(err.code) >= 500 || err.code === 429)) throw err;
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Nexconn request failed: ${path}`);
}

// ---------- Users ----------

export async function issueAccessToken(userId: string, name: string, avatarUrl?: string) {
  const res = await call<{ result: { userId: string; accessToken: string } }>(
    "/v4/auth/access-token/issue",
    { userId, name: name.slice(0, 64), ...(avatarUrl ? { avatarUrl } : {}) },
  );
  return res.result.accessToken;
}

export async function updateUserInfo(userId: string, name: string) {
  await call("/v4/user/update", { userId, name: name.slice(0, 64) });
}

export async function addToBlocklist(userId: string, targetUserIds: string[]) {
  await call("/v4/user/blocklist/add", { userId, targetUserIds });
}

export async function removeFromBlocklist(userId: string, targetUserIds: string[]) {
  await call("/v4/user/blocklist/remove", { userId, blockedUserIds: targetUserIds });
}

// ---------- Bot (system sender) ----------

let botReady: Promise<void> | null = null;

/** The LostLink notification bot. It must hold a token to be a valid sender. */
export function botUserId(): string {
  return `${env().NEXCONN_ID_PREFIX}lostlinkbot`;
}

export function ensureBot(): Promise<void> {
  if (!botReady) {
    botReady = issueAccessToken(botUserId(), "LostLink")
      .then(() => undefined)
      .catch((err) => {
        botReady = null;
        throw err;
      });
  }
  return botReady;
}

// ---------- Messages ----------

interface SendResult {
  result?: { messageIds?: { userId: string; messageId: string }[] };
}

export interface DirectSendOptions {
  fromUserId: string;
  toUserId: string;
  messageType: string;
  content: Record<string, unknown>;
  pushContent?: string;
  metadata?: Record<string, string>;
}

/** Server-side direct message (used for authoritative cards), echoed to the sender's client. */
export async function sendDirectMessage(opts: DirectSendOptions): Promise<string | null> {
  const res = await call<SendResult>("/v4/direct-channel/message/send", {
    fromUserId: opts.fromUserId,
    toUserIds: [opts.toUserId],
    messageType: opts.messageType,
    content: JSON.stringify(opts.content),
    pushContent: opts.pushContent,
    isEchoToSender: 1,
    verifyBlocklist: 1,
    shouldPersist: 1,
    ...(opts.metadata ? { hasMetadata: true, metadata: opts.metadata } : {}),
  });
  return res.result?.messageIds?.[0]?.messageId ?? null;
}

/** System channel message from the LostLink bot. Recipients cannot reply. */
export async function sendSystemMessage(
  toUserIds: string[],
  messageType: string,
  content: Record<string, unknown>,
  pushContent: string,
) {
  if (toUserIds.length === 0) return;
  await ensureBot();
  for (let i = 0; i < toUserIds.length; i += 100) {
    await call("/v4/system-channel/message/send", {
      fromUserId: botUserId(),
      toUserIds: toUserIds.slice(i, i + 100),
      messageType,
      content: JSON.stringify(content),
      pushContent,
      shouldPersist: 1,
    });
  }
}

/** Group message from the bot into a desk staff group. */
export async function sendGroupMessage(
  channelId: string,
  messageType: string,
  content: Record<string, unknown>,
  pushContent: string,
) {
  await ensureBot();
  await call("/v4/group-channel/message/send", {
    fromUserId: botUserId(),
    toChannelIds: [channelId],
    messageType,
    content: JSON.stringify(content),
    pushContent,
    shouldPersist: 1,
  });
}

/**
 * Set message metadata (expansion) on a direct-channel message.
 * `operatorId` performs the change; `channelId` is the other participant.
 */
export async function setDirectMessageMetadata(
  messageId: string,
  operatorId: string,
  otherUserId: string,
  metadata: Record<string, string>,
) {
  await call("/v4/channel-type/message/metadata/set", {
    messageId,
    userId: operatorId,
    channelType: 1,
    channelId: otherUserId,
    metadata,
    isEchoToSender: 1,
  });
}

// ---------- Groups ----------

export async function createGroup(channelId: string, name: string, owner: string, introduction: string) {
  await call("/v4/group-channel/create", {
    channelId,
    name: name.slice(0, 64),
    owner,
    groupProfile: { introduction: introduction.slice(0, 512) },
    permissions: { joinPerm: 3, memInvitePerm: 0, removePerm: 0, profilePerm: 0 },
  });
}

export async function joinGroup(channelId: string, userIds: string[]) {
  await call("/v4/group-channel/join", { channelId, userIds });
}

export async function leaveGroup(channelId: string, userIds: string[]) {
  await call("/v4/group-channel/leave", { channelId, userIds });
}

export async function dismissGroup(channelId: string) {
  await call("/v4/group-channel/dismiss", { channelId });
}
