"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  timestamp: number; // ms epoch
  read: boolean;
  raw: Record<string, unknown>;
}

// ── Message formatting ────────────────────────────────────────────────────────

function formatMessage(evt: Record<string, unknown>): string {
  const actor = (evt.actor as string) || "Someone";
  switch (evt.type) {
    case "dataset_created":
      return `${actor} uploaded "${evt.name}"`;
    case "dataset_deleted":
      return `${actor} deleted "${evt.name}"`;
    case "feedback_submitted": {
      const sub = evt.subject ? `: "${evt.subject}"` : "";
      return `${actor} submitted ${evt.feedback_type} feedback${sub}`;
    }
    case "comment_mention": {
      const sub = evt.subject ? ` in "${evt.subject}"` : "";
      return `${actor} mentioned you${sub}`;
    }
    default:
      return String(evt.type ?? "Unknown event");
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const MAX_NOTIFS = 50;
const REALTIME_ENABLED = false;

export function useNotifications(workspaceId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const retryRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!REALTIME_ENABLED || !workspaceId) return;
    const token = sessionStorage.getItem("access_token");
    if (!token) return;

    const url = `${API_BASE}/events?workspace_id=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    sourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as Record<string, unknown>;
        if (evt.type === "connected") return;

        const notif: AppNotification = {
          id: crypto.randomUUID(),
          type: String(evt.type ?? ""),
          message: formatMessage(evt),
          timestamp: Date.now(),
          read: false,
          raw: evt,
        };

        setNotifications((prev) => [notif, ...prev].slice(0, MAX_NOTIFS));
        setUnreadCount((c) => c + 1);
      } catch {
        // malformed event — ignore
      }
    };

    es.onerror = () => {
      es.close();
      sourceRef.current = null;
      // Exponential back-off: retry after 5 s
      retryRef.current = setTimeout(connect, 5_000);
    };
  }, [workspaceId]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  return { notifications, unreadCount, markAllRead, markRead };
}
