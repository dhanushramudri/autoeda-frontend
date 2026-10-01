"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A name with a pencil: click it, type, press Enter (or the tick) to save, Esc to cancel.
 * Safe inside clickable cards and links — it never triggers their navigation.
 * The pencil appears on hover when an ancestor has the `group` class.
 */
export function InlineRename({
  value, onSave, className,
}: {
  value: string;
  onSave: (name: string) => Promise<unknown>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); };

  const save = async () => {
    const name = draft.trim();
    if (!name) { setError("Name can't be empty"); return; }
    if (name === value) { setEditing(false); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave(name);
      setEditing(false);
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const d = e?.response?.data?.detail;
      setError(typeof d === "string" ? d : "Could not rename");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
        <span className={cn("truncate", className)}>{value}</span>
        <button type="button" title="Rename" onClick={(e) => { stop(e); setDraft(value); setError(null); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }
  return (
    <span className="block" onClick={stop}>
      <span className="flex items-center gap-1">
        <input autoFocus value={draft} disabled={busy} maxLength={250}
          onChange={(e) => setDraft(e.target.value)} onClick={stop} onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="min-w-0 flex-1 px-2 py-1 text-sm font-semibold border border-brand rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-brand" />
        <button type="button" title="Save" onClick={(e) => { stop(e); save(); }} disabled={busy} className="p-1 rounded text-brand hover:bg-brand/10">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button type="button" title="Cancel" onClick={(e) => { stop(e); setEditing(false); }} disabled={busy} className="p-1 rounded text-muted-foreground hover:bg-muted">
          <X className="w-4 h-4" />
        </button>
      </span>
      {error && <span className="block text-[11px] text-red-600 mt-0.5">{error}</span>}
    </span>
  );
}
