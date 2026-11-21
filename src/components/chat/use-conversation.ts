"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as NC from "@nexconn/chat";
import { useChat, useChatEvents } from "@/components/chat/chat-provider";

export interface ChatMessage {
  /** Server message id, or a local temp id while sending. */
  id: string;
  type: string;
  content: Record<string, unknown>;
  senderId: string;
  sentTime: number;
  mine: boolean;
  status: "sending" | "sent" | "failed";
  progress?: number;
  read?: boolean;
  needReceipt?: boolean;
  metadata: Record<string, string>;
  /** Kept so a failed send can be retried. */
  retry?: () => Promise<void>;
}

const PAGE = 30;

function toChatMessage(m: NC.Message, me: string | null): ChatMessage {
  const meta: Record<string, string> = {};
  if (m.metadata && typeof (m.metadata as Map<string, string>).forEach === "function") {
    (m.metadata as Map<string, string>).forEach((v, k) => (meta[k] = v));
  } else if (m.metadata && typeof m.metadata === "object") {
    Object.assign(meta, m.metadata as unknown as Record<string, string>);
  }
  return {
    id: m.messageId,
    type: m.messageType,
    content: (m.content ?? {}) as Record<string, unknown>,
    senderId: m.senderUserId,
    sentTime: m.sentTime,
    mine: !!me && m.senderUserId === me,
    status: "sent",
    needReceipt: m.needReceipt,
    metadata: meta,
  };
}

function sortMerge(list: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of list) {
    const prev = byId.get(m.id);
    byId.set(m.id, prev ? { ...prev, ...m, metadata: { ...prev.metadata, ...m.metadata }, read: prev.read || m.read } : m);
  }
  return [...byId.values()].sort((a, b) => a.sentTime - b.sentTime);
}

export type ConversationKind = "direct" | "group";

/**
 * One Nexconn conversation: paginated history (newest first, "load earlier"), live
 * messages via the shared handlers, metadata/receipt updates, typing, optimistic sends
 * with retry, read receipts and unread clearing.
 */
export function useConversation(kind: ConversationKind, targetId: string | null) {
  const { sdk, status, userId, refreshUnread } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const queryRef = useRef<NC.MessagesQuery | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const receiptSent = useRef(new Set<string>());

  const channel = useMemo(() => {
    if (!sdk || !targetId) return null;
    return kind === "direct" ? new sdk.DirectChannel(targetId) : new sdk.GroupChannel(targetId);
  }, [sdk, targetId, kind]);

  const markRead = useCallback(
    async (list: ChatMessage[]) => {
      if (!channel || document.visibilityState !== "visible") return;
      const ids = list.filter((m) => !m.mine && m.needReceipt && !receiptSent.current.has(m.id) && !m.id.startsWith("local-")).map((m) => m.id);
      if (ids.length && kind === "direct") {
        ids.forEach((id) => receiptSent.current.add(id));
        await channel.sendReadReceiptResponse(ids).catch(() => undefined);
      }
      await channel.clearUnreadCount().catch(() => undefined);
      refreshUnread();
    },
    [channel, kind, refreshUnread],
  );

  const loadReceipts = useCallback(
    async (list: ChatMessage[]) => {
      if (!channel || kind !== "direct") return;
      const mineIds = list.filter((m) => m.mine && m.needReceipt && !m.read && !m.id.startsWith("local-")).map((m) => m.id);
      if (mineIds.length === 0) return;
      const res = await channel.getMessageReadReceiptInfo(mineIds).catch(() => null);
      if (res?.code === 0 && res.data) {
        const read = new Set(res.data.filter((r) => r.readCount > 0).map((r) => r.messageId));
        if (read.size) setMessages((prev) => prev.map((m) => (read.has(m.id) ? { ...m, read: true } : m)));
      }
    },
    [channel, kind],
  );

  // Initial history.
  useEffect(() => {
    if (!sdk || !channel || status !== "connected") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const q = sdk.BaseChannel.createMessagesQuery({
        channelIdentifier: channel.identifier,
        startTime: 0,
        pageSize: PAGE,
        isAscending: false,
      });
      queryRef.current = q;
      const res = await q.loadNextPage();
      if (cancelled) return;
      if (res.code !== 0) {
        setError("Couldn't load messages. Check your connection.");
        setLoading(false);
        return;
      }
      const list = (res.data?.data ?? []).map((m) => toChatMessage(m, userId));
      setMessages((prev) => sortMerge([...list, ...prev]));
      setHasMore(q.hasNext && list.length >= PAGE);
      setLoading(false);
      void markRead(list);
      void loadReceipts(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, channel, status, userId, markRead, loadReceipts]);

  const loadEarlier = useCallback(async () => {
    const q = queryRef.current;
    if (!q || q.isLoading) return;
    const res = await q.loadNextPage();
    if (res.code !== 0) return;
    const list = (res.data?.data ?? []).map((m) => toChatMessage(m, userId));
    setMessages((prev) => sortMerge([...list, ...prev]));
    setHasMore(q.hasNext && list.length > 0);
    void loadReceipts(list);
  }, [userId, loadReceipts]);

  const isThisChannel = useCallback(
    (id: NC.ChannelIdentifier | undefined, channelId?: string) => {
      if (!sdk || !targetId) return false;
      if (id) {
        const want = kind === "direct" ? sdk.ChannelType.DIRECT : sdk.ChannelType.GROUP;
        return id.channelType === want && id.channelId === targetId;
      }
      return channelId === targetId;
    },
    [sdk, targetId, kind],
  );

  useChatEvents((e) => {
    if (e.type === "message" && isThisChannel(e.message.channelIdentifier)) {
      const m = toChatMessage(e.message, userId);
      setMessages((prev) => sortMerge([...prev, m]));
      if (!m.mine) {
        setTyping(false);
        void markRead([m]);
      }
    } else if (e.type === "updated" && isThisChannel(e.message.channelIdentifier)) {
      const m = toChatMessage(e.message, userId);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: m.content } : x)));
    } else if (e.type === "metadata") {
      setMessages((prev) => prev.map((x) => (x.id === e.messageId ? { ...x, metadata: { ...x.metadata, ...e.metadata } } : x)));
    } else if (e.type === "receipt" && kind === "direct") {
      if (e.readCount > 0) setMessages((prev) => prev.map((x) => (x.id === e.messageId ? { ...x, read: true } : x)));
    } else if (e.type === "typing" && kind === "direct" && e.channelId === targetId && e.userId !== userId) {
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 6000);
    } else if (e.type === "synced" && channel) {
      // After an offline period, refresh the newest page to catch anything missed.
      void (async () => {
        if (!sdk) return;
        const q = sdk.BaseChannel.createMessagesQuery({ channelIdentifier: channel.identifier, startTime: 0, pageSize: PAGE, isAscending: false });
        const res = await q.loadNextPage();
        if (res.code === 0) setMessages((prev) => sortMerge([...prev, ...(res.data?.data ?? []).map((m) => toChatMessage(m, userId))]));
      })();
    }
  });

  // Re-send read receipts when the tab becomes visible again.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void markRead(messages);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [messages, markRead]);

  const notifyTyping = useCallback(() => {
    if (!channel || kind !== "direct") return;
    const now = Date.now();
    if (now - lastTypingSent.current < 3000) return;
    lastTypingSent.current = now;
    void (channel as NC.DirectChannel).sendTypingStatus("RC:TxtMsg").catch(() => undefined);
  }, [channel, kind]);

  /** Send with an optimistic bubble; failures stay visible with a retry action. */
  const sendParams = useCallback(
    async (
      build: () => Promise<NC.SendMessageParams | NC.SendMediaMessageParams<Record<string, unknown>>>,
      preview: { type: string; content: Record<string, unknown> },
      media = false,
    ) => {
      if (!channel || !userId) return;
      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const attempt = async (): Promise<void> => {
        setMessages((prev) =>
          sortMerge([
            ...prev.filter((m) => m.id !== tempId),
            { id: tempId, type: preview.type, content: preview.content, senderId: userId, sentTime: Date.now() + 10_000_000, mine: true, status: "sending", metadata: {}, needReceipt: true },
          ]),
        );
        try {
          const params = await build();
          params.needReceipt = kind === "direct";
          if (media) {
            (params as NC.SendMediaMessageParams<Record<string, unknown>>).onUploadProgress = (p: number) =>
              setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, progress: p } : m)));
          }
          const res = media
            ? await channel.sendMediaMessage(params as NC.SendMediaMessageParams<Record<string, unknown>>)
            : await channel.sendMessage(params as NC.SendMessageParams);
          if (res.code !== 0 || !res.data) throw new Error(String(res.code));
          const sent = toChatMessage(res.data, userId);
          setMessages((prev) => sortMerge([...prev.filter((m) => m.id !== tempId), sent]));
        } catch (err) {
          const code = (err as Error).message;
          console.warn("[chat] send failed", code);
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed", retry: attempt, content: { ...m.content, _error: code } } : m)));
        }
      };
      await attempt();
    },
    [channel, userId, kind],
  );

  const sendText = useCallback(
    (text: string) => {
      if (!sdk) return Promise.resolve();
      return sendParams(async () => new sdk.SendTextMessageParams({ text }), { type: "RC:TxtMsg", content: { text } });
    },
    [sdk, sendParams],
  );

  const sendImage = useCallback(
    (file: File) => {
      if (!sdk) return Promise.resolve();
      const preview = URL.createObjectURL(file);
      return sendParams(
        async () => {
          const r = await sdk.Helper.createSendImageMessageParams(file);
          if (!r.isOk || !r.data) throw new Error(String(r.code));
          return r.data as unknown as NC.SendMediaMessageParams<Record<string, unknown>>;
        },
        { type: "RC:ImgMsg", content: { remoteUrl: preview } },
        true,
      );
    },
    [sdk, sendParams],
  );

  const sendLocation = useCallback(
    (loc: { latitude: number; longitude: number; poi: string; thumbnailBase64: string }) => {
      if (!sdk) return Promise.resolve();
      return sendParams(async () => new sdk.SendLocationMessageParams(loc), { type: "RC:LBSMsg", content: loc });
    },
    [sdk, sendParams],
  );

  return { messages, loading, hasMore, error, typing, loadEarlier, sendText, sendImage, sendLocation, notifyTyping, ready: !!channel && status === "connected", me: userId };
}
