"use client";

import { useState, useCallback } from "react";
import { Filter, X, Plus, Save, ChevronDown } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import type { FilterConfig, FilterOperator, NamedSegment } from "@/types";

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

interface FilterBarProps {
  datasetId: string;
  columns: string[];
  onFilterChange?: (filters: FilterConfig[], totalMatching: number | null) => void;
}

let nextId = 1;

export function FilterBar({ datasetId, columns, onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<FilterConfig>>({ operator: "equals" });
  const [totalMatching, setTotalMatching] = useState<number | null>(null);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [segmentName, setSegmentName] = useState("");
  const [showSegmentInput, setShowSegmentInput] = useState(false);
  const [showSegments, setShowSegments] = useState(false);

  const { data: segmentsData, refetch: refetchSegments } = useQuery({
    queryKey: queryKeys.segments.list(datasetId),
    queryFn: () => datasetsApi.getSegments(datasetId).then((r) => r.data as NamedSegment[]),
    enabled: showSegments,
  });

  const previewMutation = useMutation({
    mutationFn: (fs: FilterConfig[]) =>
      datasetsApi.filterPreview(datasetId, fs, 0).then((r) => r.data),
    onSuccess: (data: { total_matching: number; total_rows: number }) => {
      setTotalMatching(data.total_matching);
      setTotalRows(data.total_rows);
      onFilterChange?.(filters, data.total_matching);
    },
  });

  const saveSegmentMutation = useMutation({
    mutationFn: () => datasetsApi.createSegment(datasetId, { name: segmentName, filters }),
    onSuccess: () => { setShowSegmentInput(false); setSegmentName(""); refetchSegments(); },
  });

  const addFilter = useCallback(() => {
    if (!draft.column || !draft.operator) return;
    const newFilter: FilterConfig = {
      id: String(nextId++),
      column: draft.column,
      operator: draft.operator as FilterOperator,
      value: draft.value ?? "",
    };
    const next = [...filters, newFilter];
    setFilters(next);
    setAdding(false);
    setDraft({ operator: "equals" });
    previewMutation.mutate(next);
  }, [draft, filters, previewMutation]);

  const removeFilter = useCallback((id: string) => {
    const next = filters.filter((f) => f.id !== id);
    setFilters(next);
    if (next.length === 0) { setTotalMatching(null); setTotalRows(null); onFilterChange?.([], null); }
    else previewMutation.mutate(next);
  }, [filters, onFilterChange, previewMutation]);

  const needsValue = draft.operator !== "is_null" && draft.operator !== "is_not_null";

  return (
    <div className="bg-card border-b border-border px-4 py-2 flex flex-wrap items-center gap-2 min-h-[44px]">
      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
        <Filter className="w-3.5 h-3.5" />
        Filters
      </div>

      {/* Active filter chips */}
      {filters.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-1 text-xs text-brand"
        >
          <span className="font-medium">{f.column}</span>
          <span className="text-blue-400 dark:text-blue-400">{OPERATORS.find((o) => o.value === f.operator)?.label}</span>
          {f.value && <span>{f.value}</span>}
          <button onClick={() => removeFilter(f.id)} className="hover:text-blue-900 dark:text-blue-200 ml-0.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Add filter inline form */}
      {adding && (
        <div className="flex items-center gap-1 bg-muted border border-border rounded-lg px-2 py-1">
          <select
            className="text-xs border-0 bg-transparent outline-none text-foreground max-w-[120px]"
            value={draft.column ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, column: e.target.value }))}
          >
            <option value="">Column...</option>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="text-xs border-0 bg-transparent outline-none text-foreground"
            value={draft.operator ?? "equals"}
            onChange={(e) => setDraft((d) => ({ ...d, operator: e.target.value as FilterOperator }))}
          >
            {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {needsValue && (
            <input
              className="text-xs border-0 bg-transparent outline-none text-foreground w-24 placeholder-muted-foreground"
              placeholder="value"
              value={draft.value ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") addFilter(); }}
              autoFocus
            />
          )}
          <button onClick={addFilter} className="text-xs bg-brand text-white px-2 py-0.5 rounded-md">Add</button>
          <button onClick={() => { setAdding(false); setDraft({ operator: "equals" }); }}>
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand border border-dashed border-border hover:border-brand/60 rounded-full px-2.5 py-1 transition"
        >
          <Plus className="w-3 h-3" /> Add Filter
        </button>
      )}

      {/* Segments dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowSegments((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1"
        >
          Segments <ChevronDown className="w-3 h-3" />
        </button>
        {showSegments && (
          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-30 min-w-[180px] py-1">
            {(!segmentsData || segmentsData.length === 0) ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No saved segments</p>
            ) : (
              segmentsData.map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => {
                    setFilters(seg.filters as FilterConfig[]);
                    setShowSegments(false);
                    previewMutation.mutate(seg.filters as FilterConfig[]);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  {seg.name}
                </button>
              ))
            )}
            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={() => { setShowSegmentInput(true); setShowSegments(false); }}
                disabled={filters.length === 0}
                className="w-full text-left px-3 py-1.5 text-xs text-brand hover:bg-brand/10 disabled:opacity-40"
              >
                Save current filters as segment...
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save segment inline */}
      {showSegmentInput && (
        <div className="flex items-center gap-1">
          <input
            className="text-xs border border-border rounded-md px-2 py-1 w-36 outline-none focus:ring-1 focus:ring-brand"
            placeholder="Segment name"
            value={segmentName}
            onChange={(e) => setSegmentName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && segmentName) saveSegmentMutation.mutate(); }}
          />
          <button
            onClick={() => saveSegmentMutation.mutate()}
            disabled={!segmentName}
            className="text-xs bg-brand text-white px-2 py-1 rounded-md disabled:opacity-40 flex items-center gap-1"
          >
            <Save className="w-3 h-3" /> Save
          </button>
          <button onClick={() => setShowSegmentInput(false)}>
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Row count badge */}
      {totalMatching !== null && totalRows !== null && (
        <span className={cn(
          "ml-auto text-xs font-medium px-2.5 py-1 rounded-full",
          totalMatching < totalRows ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
        )}>
          Showing {totalMatching.toLocaleString()} of {totalRows.toLocaleString()} rows
        </span>
      )}

      {filters.length > 0 && (
        <button
          onClick={() => { setFilters([]); setTotalMatching(null); setTotalRows(null); onFilterChange?.([], null); }}
          className="text-xs text-red-500 dark:text-red-400 hover:text-red-700"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
