"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Loader2, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlowStage {
  key: string;
  title: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  summary: string | null;
  logs: string[];
  seconds: number | null;
}

function StageIcon({ status }: { status: FlowStage["status"] }) {
  if (status === "running") return <Loader2 className="w-4 h-4 text-brand animate-spin" />;
  if (status === "done") return <CheckCircle2 className="w-4 h-4 text-brand" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "skipped") return <MinusCircle className="w-4 h-4 text-muted-foreground/50" />;
  return <Circle className="w-4 h-4 text-muted-foreground/40" />;
}

export function StageTimeline({ stages, compact = false }: { stages: FlowStage[]; compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const finished = stages.filter((s) => ["done", "error", "skipped"].includes(s.status)).length;
  const pct = stages.length ? Math.round((finished / stages.length) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-foreground">Flow progress</span>
            <span className="text-muted-foreground">{finished} of {stages.length} stages</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <ol className={cn("divide-y divide-border", compact && "max-h-80 overflow-y-auto")}>
        {stages.map((s, i) => {
          const expandable = s.logs.length > 0 && s.status !== "pending";
          const isOpen = open === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!expandable}
                onClick={() => setOpen(isOpen ? null : s.key)}
                className={cn("w-full flex items-start gap-3 px-4 py-2.5 text-left", expandable && "hover:bg-muted/50")}
              >
                <div className="mt-0.5"><StageIcon status={s.status} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={cn("text-sm font-medium", s.status === "pending" ? "text-muted-foreground" : "text-foreground")}>
                      {i + 1}. {s.title}
                    </span>
                    {s.seconds != null && <span className="text-[11px] text-muted-foreground">{s.seconds}s</span>}
                  </div>
                  {s.summary && (
                    <p className={cn("text-xs mt-0.5", s.status === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                      {s.summary}
                    </p>
                  )}
                </div>
                {expandable && <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />}
              </button>
              {isOpen && (
                <ul className="px-11 pb-3 space-y-1">
                  {s.logs.map((l, j) => (
                    <li key={j} className="text-xs text-muted-foreground leading-relaxed">• {l}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
