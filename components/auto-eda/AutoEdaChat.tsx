"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { autoEdaApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import type { AutoEdaChatMessage } from "@/types";
import { Loader2, MessageSquare, Send } from "lucide-react";

const POLL_MS = 3000;

export function AutoEdaChat({
  workspaceId, runId, active,
}: {
  workspaceId: string;
  runId: number;
  /** Whether this run can currently accept a steering instruction
   * (pending/running/pausing/paused) — a finished run only shows history. */
  active: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: queryKeys.autoEda.chat(workspaceId, runId),
    queryFn: () => autoEdaApi.listChatMessages(workspaceId, runId).then((r) => r.data as AutoEdaChatMessage[]),
    refetchInterval: active ? POLL_MS : false,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages?.length]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    try {
      await autoEdaApi.sendChatMessage(workspaceId, runId, content);
      qc.invalidateQueries({ queryKey: queryKeys.autoEda.chat(workspaceId, runId) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/40">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40">
        <MessageSquare className="w-3.5 h-3.5 text-brand flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">Steer this run</span>
      </div>

      <div className="max-h-52 overflow-y-auto scrollbar-thin px-3 py-2.5 space-y-2">
        {messages && messages.length > 0 ? (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                  m.role === "user" ? "bg-brand text-white" : "bg-muted text-foreground"
                )}
              >
                {m.content}
              </div>
            </div>
          ))
        ) : (
          <p className="text-[11px] text-muted-foreground text-center py-3 leading-relaxed">
            {active
              ? "Tell it to skip something, focus more on a topic, or dig deeper somewhere — it'll adjust the remaining worklist."
              : "No messages on this run."}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {active && (
        <div className="flex items-center gap-2 px-2.5 py-2 border-t border-border">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="e.g. Skip the categorical breakdowns"
            className="flex-1 min-w-0 text-xs bg-transparent focus:outline-none placeholder-muted-foreground/70"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand text-white disabled:opacity-40 transition hover:opacity-90 flex-shrink-0"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
