"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  X, Tag, FileText, AlertTriangle, TrendingUp,
  BarChart2, Hash, Percent, Loader2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ColumnDetail } from "@/types";

interface ColumnDetailPanelProps {
  datasetId: string;
  columnName: string | null;
  onClose: () => void;
  onQuickAction?: (op: string, column: string) => void;
}

const SEV_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];

export function ColumnDetailPanel({ datasetId, columnName, onClose, onQuickAction }: ColumnDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.columnDetail.get(datasetId, columnName ?? ""),
    queryFn: () => datasetsApi.getColumnDetail(datasetId, columnName!).then((r) => r.data as ColumnDetail),
    enabled: !!columnName,
  });

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const tagMutation = useMutation({
    mutationFn: (tags: string[]) =>
      datasetsApi.upsertColumnMetadata(datasetId, columnName!, {
        tags,
        notes: data?.notes ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.columnDetail.get(datasetId, columnName ?? "") }),
  });

  if (!columnName) return null;

  const stat = data?.stats;
  const missingPct = stat?.missing_pct ?? 0;
  const missColor = missingPct > 50 ? "text-red-600" : missingPct > 20 ? "text-amber-600" : "text-emerald-600";

  const histData = data?.histogram
    ? data.histogram.bins.map((b, i) => ({ bin: b.toFixed(2), count: data.histogram!.counts[i] ?? 0 }))
    : [];

  const topData = (data?.top_values ?? []).map((v) => ({
    value: String(v.value).length > 14 ? String(v.value).slice(0, 14) + "..." : String(v.value),
    count: v.count,
    pct: v.pct,
  }));

  const QUICK_TAGS = ["target", "feature", "id", "sensitive", "drop"];

  const toggleTag = (tag: string) => {
    const current = data?.tags ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    tagMutation.mutate(next);
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-[380px] bg-white border-l border-gray-200 shadow-2xl pointer-events-auto flex flex-col"
        style={{ animation: "slideInRight 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{columnName}</h3>
            {stat && <p className="text-xs text-gray-400 mt-0.5">{stat.dtype}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-4 text-sm text-red-600">Failed to load column details.</div>
          )}

          {data && stat && (
            <div className="p-5 space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total Rows", value: stat.total?.toLocaleString(), icon: Hash },
                  { label: "Missing", value: `${missingPct.toFixed(1)}%`, icon: AlertTriangle, color: missColor },
                  { label: "Unique", value: stat.unique_count?.toLocaleString(), icon: Hash },
                  ...(stat.mean != null ? [{ label: "Mean", value: stat.mean.toFixed(4), icon: TrendingUp }] : []),
                  ...(stat.median != null ? [{ label: "Median", value: stat.median.toFixed(4), icon: BarChart2 }] : []),
                  ...(stat.std != null ? [{ label: "Std Dev", value: stat.std.toFixed(4), icon: TrendingUp }] : []),
                  ...(stat.skewness != null ? [{ label: "Skewness", value: stat.skewness.toFixed(3), icon: TrendingUp }] : []),
                  ...(stat.outlier_count != null ? [{ label: "Outliers", value: stat.outlier_count.toString(), icon: AlertTriangle, color: stat.outlier_count > 0 ? "text-amber-600" : "text-emerald-600" }] : []),
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                    <p className={`text-sm font-semibold ${s.color ?? "text-gray-900"}`}>{s.value ?? " -- "}</p>
                  </div>
                ))}
              </div>

              {/* Missing bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Missing values</span>
                  <span className={`text-xs font-medium ${missColor}`}>{missingPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${missingPct > 50 ? "bg-red-500" : missingPct > 20 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${missingPct}%` }}
                  />
                </div>
              </div>

              {/* Histogram */}
              {histData.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Distribution</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={histData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <XAxis dataKey="bin" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ fontSize: 11, padding: "4px 8px" }}
                        formatter={(v: number) => [v, "count"]}
                      />
                      <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                        {histData.map((_, i) => (
                          <Cell key={i} fill={SEV_COLORS[i % SEV_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top values */}
              {topData.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Top Values</p>
                  <div className="space-y-1.5">
                    {topData.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-28 truncate">{v.value}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${Math.min(v.pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-10 text-right">{v.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested dtype */}
              {data.suggested_dtype && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-brand">Suggested dtype</p>
                  <p className="text-xs text-brand mt-0.5">
                    This column could be cast to <strong>{data.suggested_dtype}</strong>
                  </p>
                </div>
              )}

              {/* Tags */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TAGS.map((tag) => {
                    const active = (data.tags ?? []).includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${
                          active
                            ? "bg-brand text-white border-brand"
                            : "bg-white text-gray-600 border-gray-300 hover:border-brand/60"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        {columnName && onQuickAction && (
          <div className="flex-shrink-0 border-t border-gray-100 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Actions</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Fill Missing", op: "fill_missing" },
                { label: "Drop Column", op: "drop" },
                { label: "Cast Type", op: "cast_type" },
              ].map((action) => (
                <button
                  key={action.op}
                  onClick={() => { onQuickAction(action.op, columnName); onClose(); }}
                  className="text-xs py-2 border border-gray-200 rounded-lg text-gray-600 hover:border-brand/60 hover:text-brand transition"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
