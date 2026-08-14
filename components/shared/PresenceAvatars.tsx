"use client";

import { useState } from "react";
import type { PresenceUser } from "@/hooks/usePresence";

const PALETTE = [
  "#2563eb", "#7c3aed", "#db2777", "#d97706",
  "#059669", "#0891b2", "#dc2626", "#65a30d",
];

function colorFor(email: string): string {
  let h = 0;
  for (const c of email) h = c.charCodeAt(0) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(user: PresenceUser): string {
  const parts = (user.name || user.email).split(/[\s@.]+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

interface Props {
  users: PresenceUser[];
  max?: number;
}

/** Topbar variant — larger avatars, green online dot, no label */
export function OnlineAvatars({ users, max = 5 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (!users.length) return null;

  const visible  = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex items-center gap-2">
      {/* subtle divider */}
      <div className="h-5 w-px bg-muted" />

      <div className="flex items-center -space-x-2">
        {visible.map((u, i) => (
          <div
            key={u.email}
            className="relative"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-semibold cursor-default shadow-sm"
              style={{ backgroundColor: colorFor(u.email) }}
            >
              {initials(u)}
            </div>
            {/* Green online dot */}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border-[1.5px] border-white" />

            {/* Tooltip */}
            {hoveredIdx === i && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-gray-900 text-white rounded-lg whitespace-nowrap z-[999] pointer-events-none shadow-xl">
                <p className="text-[11px] font-medium">{u.name || u.email}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Online</p>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
              </div>
            )}
          </div>
        ))}

        {overflow > 0 && (
          <div className="w-7 h-7 rounded-full border-2 border-white bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-semibold shadow-sm">
            +{overflow}
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-muted" />
    </div>
  );
}

/** Inline variant (kept for any future use) */
export function PresenceAvatars({ users, max = 4 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (!users.length) return null;

  const visible  = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex items-center">
      <div className="flex items-center -space-x-1.5">
        {visible.map((u, i) => (
          <div
            key={u.email}
            className="relative"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div
              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0 cursor-default"
              style={{ backgroundColor: colorFor(u.email) }}
            >
              {initials(u)}
            </div>
            {hoveredIdx === i && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md whitespace-nowrap z-[999] pointer-events-none shadow-lg">
                {u.name || u.email}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
              </div>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-muted flex items-center justify-center text-muted-foreground text-[9px] font-semibold flex-shrink-0">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
