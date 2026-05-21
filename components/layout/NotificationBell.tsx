"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Upload, Trash2, MessageSquare, AtSign, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";

const TYPE_ICON: Record<string, React.ElementType> = {
  dataset_created:    Upload,
  dataset_deleted:    Trash2,
  feedback_submitted: MessageSquare,
  comment_mention:    AtSign,
};

const TYPE_COLOR: Record<string, string> = {
  dataset_created:    "text-emerald-500 bg-emerald-50",
  dataset_deleted:    "text-red-400 bg-red-50",
  feedback_submitted: "text-amber-500 bg-amber-50",
  comment_mention:    "text-brand bg-brand/10",
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function NotifRow({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  const Icon  = TYPE_ICON[n.type] ?? Bell;
  const color = TYPE_COLOR[n.type] ?? "text-gray-400 bg-gray-100";

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-default",
        !n.read && "bg-brand/[0.03]"
      )}
      onClick={() => onRead(n.id)}
    >
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs leading-snug text-gray-700", !n.read && "font-medium")}>
          {n.message}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">{relativeTime(n.timestamp)}</p>
      </div>
      {!n.read && (
        <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0 mt-1.5" />
      )}
    </div>
  );
}

interface Props {
  workspaceId?: string;
}

export function NotificationBell({ workspaceId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(workspaceId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-700">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-brand hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                No notifications yet.
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <NotifRow key={n.id} n={n} onRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
