"use client";

/**
 * DISABLED: Realtime/Presence functionality not in use.
 * WebSocket connections don't work through HTTP proxy.
 * 
 * This hook is disabled but kept for reference.
 * To re-enable: uncomment realtime router in backend main.py
 * and restore WebSocket connection logic here.
 */

export interface PresenceUser {
  email: string;
  name: string;
}

export type PresenceMap = Record<string, PresenceUser[]>;

export function usePresence(workspaceId?: string, datasetId?: string) {
  // Disabled — return empty presence
  return { presence: {} as PresenceMap };
}