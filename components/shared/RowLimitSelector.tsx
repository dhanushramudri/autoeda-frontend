"use client";

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Rows3, CheckCircle2 } from "lucide-react";
import { useRowLimitStore, ROW_LIMIT_OPTIONS } from "@/store/rowLimitStore";

export function RowLimitSelector({ datasetId }: { datasetId: string }) {
  const { rowLimit, setRowLimit } = useRowLimitStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const current = ROW_LIMIT_OPTIONS.find((o) => o.value === rowLimit) ?? ROW_LIMIT_OPTIONS[ROW_LIMIT_OPTIONS.length - 1];

  function choose(value: number) {
    setRowLimit(value);
    setOpen(false);
    // Every analysis query keys off datasetId as a literal element — invalidate
    // them all at once instead of threading rowLimit through every page's queryKey.
    qc.invalidateQueries({ predicate: (q) => q.queryKey.includes(datasetId) });
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Rows used for Correlations, Feature Importance, Time Series, Text, Analysis & Transform (Databricks/DB sources)"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-[11px] font-medium text-muted-foreground hover:bg-muted transition"
      >
        <Rows3 className="w-3.5 h-3.5 text-muted-foreground" />
        {current.label}
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-52 bg-card rounded-xl shadow-lg border border-border z-50 py-1.5">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Rows to analyze
          </p>
          {ROW_LIMIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => choose(opt.value)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted transition ${
                opt.value === rowLimit ? "text-brand font-semibold" : "text-muted-foreground"
              }`}
            >
              {opt.label}
              {opt.value === rowLimit && <CheckCircle2 className="w-3.5 h-3.5" />}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1.5 px-3">
            <p className="text-[10px] text-muted-foreground">
              Only affects connector-backed sources (Databricks, SQL DBs, APIs). Profile & Missing always use the full table.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
