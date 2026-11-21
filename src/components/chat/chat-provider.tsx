"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type * as NC from "@nexconn/chat";
import { CUSTOM_MESSAGE_REGISTRATIONS, MSG, type NoticeContent } from "@/lib/nexconn/messages";

/**
 * Nexconn Web Chat SDK integration. One engine per tab: initialise once, register
 * custom message types and handlers before connecting, connect once (the SDK reconnects
 * on its own), refresh the token on 31004, and fan events out to subscribers.
 */

export type ChatStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline" | "kicked" | "error";

export type ChatEvent =
  | { type: "message"; message: NC.Message }
  | { type: "updated"; message: NC.Message }
  | { type: "metadata"; messageId: string; channelId: string; metadata: Record<string, string> }
  | { type: "receipt"; messageId: string; channelId: string; readCount: number }
  | { type: "typing"; channelId: string; userId: string }
  | { type: "notice"; notice: NoticeContent }
  | { type: "synced" };

interface ChatContextValue {
  status: ChatStatus;
  userId: string | null;
  totalUnread: number;
  sdk: typeof NC | null;
  subscribe: (fn: (e: ChatEvent) => void) => () => void;
  refreshUnread: () => void;
  retry: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

let sdkPromise: Promise<typeof NC> | null = null;
let engineInitialised = false;
let connectedUser: string | null = null;

function loadSdk() {
  if (!sdkPromise) sdkPromise = import("@nexconn/chat");
  return sdkPromise;
}

interface TokenResponse {
  appKey: string;
  userId: string;
  token: string;
}

async function fetchToken(refresh = false): Promise<TokenResponse> {
  const res = await fetch("/api/nexconn/token", { method: refresh ? "POST" : "GET", credentials: "same-origin" });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return res.json();
}

export function ChatProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [userId, setUserId] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [sdk, setSdk] = useState<typeof NC | null>(null);
  const [attempt, setAttempt] = useState(0);
  const listeners = useRef(new Set<(e: ChatEvent) => void>());
  const unreadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emit = useCallback((e: ChatEvent) => {
    for (const fn of listeners.current) {
      try {
        fn(e);
      } catch (err) {
        console.error("[chat] listener failed", err);
      }
    }
  }, []);

  const refreshUnread = useCallback(() => {
    if (unreadTimer.current) clearTimeout(unreadTimer.current);
    unreadTimer.current = setTimeout(async () => {
      const mod = await loadSdk();
      const res = await mod.BaseChannel.getTotalUnreadCount().catch(() => null);
      if (res && res.code === 0 && typeof res.data === "number") setTotalUnread(res.data);
    }, 250);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (connectedUser) {
        loadSdk().then((m) => m.NCEngine.disconnect());
        connectedUser = null;
      }
      return;
    }
    let cancelled = false;

    (async () => {
      setStatus("connecting");
      try {
        const mod = await loadSdk();
        let creds = await fetchToken();
        if (cancelled) return;
        if (!engineInitialised) {
          mod.NCEngine.initialize({ appKey: creds.appKey, areaCode: mod.AreaCode.SG, logLevel: mod.LogLevel.ERROR });
          mod.NCEngine.registerCustomMessages(CUSTOM_MESSAGE_REGISTRATIONS.map((r) => ({ ...r })));
          engineInitialised = true;
        }
        mod.NCEngine.addConnectionStatusHandler(
          "llk-conn",
          new mod.ConnectionStatusHandler({
            onConnectionStatusChanged({ status: s, code }) {
              const S = mod.ConnectionStatus;
              if (s === S.CONNECTED) {
                setStatus("connected");
                refreshUnread();
              } else if (s === S.CONNECTING) setStatus((prev) => (prev === "connected" ? "reconnecting" : prev === "idle" ? "connecting" : prev));
              else if (s === S.DISCONNECTED && code === 31010) setStatus("kicked");
              else if (s === S.SUSPENDED || s === S.DISCONNECTED) setStatus(navigator.onLine ? "reconnecting" : "offline");
            },
          }),
        );
        mod.NCEngine.addMessageHandler(
          "llk-msg",
          new mod.MessageHandler({
            onMessageReceived({ messages }) {
              for (const m of messages) {
                if (process.env.NODE_ENV !== "production") console.info("[chat] received", m.messageType, m.channelIdentifier?.channelType, m.channelIdentifier?.channelId);
                if (m.channelIdentifier.channelType === mod.ChannelType.SYSTEM && m.messageType === MSG.NOTICE) {
                  emit({ type: "notice", notice: m.content as NoticeContent });
                }
                emit({ type: "message", message: m });
              }
              refreshUnread();
            },
            onMessagesUpdated({ messages }) {
              for (const m of messages) emit({ type: "updated", message: m });
            },
            onMessageMetadataUpdated(e) {
              emit({ type: "metadata", messageId: e.messageId, channelId: e.channelIdentifier.channelId, metadata: e.metadata });
            },
            onMessageReceiptResponse({ responses }) {
              for (const r of responses) emit({ type: "receipt", messageId: r.messageId, channelId: r.channelIdentifier.channelId, readCount: r.readCount });
            },
            onOfflineMessageSyncCompleted() {
              emit({ type: "synced" });
              refreshUnread();
            },
          }),
        );
        mod.NCEngine.addChannelHandler(
          "llk-channel",
          new mod.ChannelHandler({
            onTypingStatusChanged({ channelIdentifier, userTypingStatus }) {
              for (const t of userTypingStatus) emit({ type: "typing", channelId: channelIdentifier.channelId, userId: t.userId });
            },
            onChannelStatusSyncCompleted() {
              refreshUnread();
            },
          }),
        );

        if (connectedUser === creds.userId && mod.NCEngine.getConnectionStatus() === mod.ConnectionStatus.CONNECTED) {
          setUserId(creds.userId);
          setSdk(mod);
          setStatus("connected");
          refreshUnread();
          return;
        }
        // Connect once; the SDK then reconnects by itself. Transient failures (navigation
        // server unreachable, timeouts on flaky mobile networks) are retried with backoff.
        const FATAL = new Set([31005, 31009, 31010, 34006]);
        const delays = [1500, 3000, 6000, 10000, 15000];
        let res = await mod.NCEngine.connect({ token: creds.token });
        for (let i = 0; !cancelled && res.code !== 0; i++) {
          if (FATAL.has(res.code) || i >= delays.length) break;
          if (res.code === 31004) {
            // Token invalid or expired: ask our server for a fresh one.
            creds = await fetchToken(true);
          } else {
            setStatus("reconnecting");
            await new Promise((r) => setTimeout(r, delays[i]));
          }
          if (cancelled) return;
          res = await mod.NCEngine.connect({ token: creds.token });
        }
        if (cancelled) return;
        if (res.code === 0) {
          connectedUser = creds.userId;
          setUserId(creds.userId);
          setSdk(mod);
          setStatus("connected");
          refreshUnread();
        } else {
          console.warn("[chat] connect failed", res.code);
          setStatus(res.code === 31010 ? "kicked" : "error");
        }
      } catch (err) {
        console.error("[chat] init failed", err);
        if (!cancelled) setStatus(navigator.onLine ? "error" : "offline");
      }
    })();

    const onOnline = () => setStatus((s) => (s === "offline" ? "reconnecting" : s));
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [enabled, attempt, emit, refreshUnread]);

  const subscribe = useCallback((fn: (e: ChatEvent) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const effectiveStatus: ChatStatus = enabled ? status : "idle";
  const value = useMemo(
    () => ({ status: effectiveStatus, userId, totalUnread, sdk, subscribe, refreshUnread, retry }),
    [effectiveStatus, userId, totalUnread, sdk, subscribe, refreshUnread, retry],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat outside ChatProvider");
  return ctx;
}

export function useChatEvents(fn: (e: ChatEvent) => void) {
  const { subscribe } = useChat();
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}

/** Disconnect from Nexconn (used on sign-out). */
export async function disconnectChat() {
  if (!connectedUser) return;
  const m = await loadSdk();
  await m.NCEngine.disconnect();
  connectedUser = null;
}
