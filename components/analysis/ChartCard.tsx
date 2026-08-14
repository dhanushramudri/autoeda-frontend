"use client";

import { useState } from "react";
import { Maximize2, Download, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  isWide?: boolean;
  isLoading?: boolean;
  insight?: string | null;
  insightSeverity?: "info" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}

const SEVERITY_STYLES = {
  info: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400",
  warning: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
  danger: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400",
};

export function ChartCard({
  title,
  description,
  isWide = false,
  isLoading = false,
  insight,
  insightSeverity = "info",
  children,
  className,
}: ChartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      {/* Modal */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">{children}</div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "bg-card rounded-xl border border-border flex flex-col overflow-hidden shadow-sm",
          isWide && "col-span-2",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs font-semibold text-foreground truncate">{title}</h3>
            {description && (
              <div className="relative">
                <button
                  onMouseEnter={() => setShowInfo(true)}
                  onMouseLeave={() => setShowInfo(false)}
                  className="text-muted-foreground/60 hover:text-muted-foreground transition"
                >
                  <Info className="w-3 h-3" />
                </button>
                {showInfo && (
                  <div className="absolute left-5 top-0 z-20 w-56 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl">
                    {description}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-muted-foreground transition flex-shrink-0"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-3 min-h-[260px] flex items-center justify-center">
          {isLoading ? (
            <div className="w-full h-full flex flex-col gap-2 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="flex-1 bg-muted rounded" />
            </div>
          ) : (
            <div className="w-full h-full">{children}</div>
          )}
        </div>

        {/* Insight footer */}
        {insight && (
          <div className={cn("mx-3 mb-3 px-3 py-2 rounded-lg border text-xs", SEVERITY_STYLES[insightSeverity])}>
            {insight}
          </div>
        )}
      </div>
    </>
  );
}

export function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 col-span-2 pt-2">
      <span className="text-sm font-bold text-foreground">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
          {count} chart{count !== 1 ? "s" : ""}
        </span>
      )}
      <div className="flex-1 h-px bg-muted" />
    </div>
  );
}
