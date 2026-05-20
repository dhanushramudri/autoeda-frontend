"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

export interface PresenceUser {
  email: string;
  name: string;
}

// {dataset_id: [PresenceUser, ...]}
export type PresenceMap = Record<string, PresenceUser[]>;

const HEARTBEAT_INTERVAL = 25_000; // 25 s — server stale threshold is 35 s

function buildWsUrl(workspaceId: string, token: string): string {
  const base = API_BASE
    .replace(/^https/, "wss")
    .replace(/^http/, "ws")
    .replace(/\/api\/v1$/, "");
  return `${base}/api/v1/ws/${encodeURIComponent(workspaceId)}?token=${encodeURIComponent(token)}`;
}

export function usePresence(workspaceId?: string, datasetId?: string) {
  const [presence, setPresence] = useState<PresenceMap>({});
  const wsRef        = useRef<WebSocket | null>(null);
  const hbRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const datasetIdRef = useRef(datasetId);

  useEffect(() => { datasetIdRef.current = datasetId; }, [datasetId]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!workspaceId) return;
    const token = sessionStorage.getItem("access_token");
    if (!token) return;

    const ws = new WebSocket(buildWsUrl(workspaceId, token));
    wsRef.current = ws;

    ws.onopen = () => {
      // Announce which dataset this user is currently viewing
      if (datasetIdRef.current) {
        send({ action: "focus", dataset_id: datasetIdRef.current });
      }
      // Start heartbeat
      hbRef.current = setInterval(() => send({ action: "heartbeat" }), HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "snapshot" || msg.type === "presence") {
          setPresence(msg.presence ?? {});
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      if (hbRef.current) clearInterval(hbRef.current);
      wsRef.current = null;
      retryRef.current = setTimeout(connect, 5_000);
    };

    ws.onerror = () => ws.close();
  }, [workspaceId, send]);

  // Connect / disconnect lifecycle
  useEffect(() => {
    connect();
    return () => {
      if (hbRef.current)  clearInterval(hbRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  // Tell the server when the viewed dataset changes
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (datasetId) {
      send({ action: "focus", dataset_id: datasetId });
    } else {
      send({ action: "blur" });
    }
  }, [datasetId, send]);

  return { presence };
}
