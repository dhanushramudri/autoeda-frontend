
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { RefreshCw, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatDistanceToNow, format } from "date-fns";
import type { EDARunRecord } from "@/types";

export default function HistoryPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const qc = useQueryClient();
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.history.list(datasetId),
    queryFn: () => datasetsApi.getHistory(datasetId).then((r) => r.data as { runs: EDARunRecord[] }),
    enabled: !!datasetId,
  });

  const recordMutation = useMutation({
    mutationFn: () => datasetsApi.recordEDArun(datasetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.history.list(datasetId) }),
  });

  const runs = data?.runs ?? [];

  const trendData = [...runs].reverse().map((r) => ({
    date: format(new Date(r.run_at), "MMM d"),
    quality: r.quality_score,
    missing: r.missing_pct ? parseFloat(r.missing_pct.toFixed(1)) : null,
    rows: r.row_count,
  }));

  const runA = compareA != null ? runs.find((r) => r.id === compareA) : null;
  const runB = compareB != null ? runs.find((r) => r.id === compareB) : null;

  const diff = (a: number | null | undefined, b: number | null | undefined, higherIsBetter = true) => {
    if (a == null || b == null) return null;
    const delta = a - b;
    const better = higherIsBetter ? delta > 0 : delta < 0;
    return { delta, better };
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Analysis History</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track EDA runs and compare snapshots over time.</p>
          </div>
          <button
            onClick={() => recordMutation.mutate()}
            disabled={recordMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recordMutation.isPending ? "animate-spin" : ""}`} />
            Record EDA Run
          </button>
        </div>

        {isLoading && <PageSpinner />}

        {!isLoading && runs.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Clock className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No EDA runs recorded yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click Record EDA Run to capture the current state.</p>
          </div>
        )}

        {runs.length > 0 && (
          <>
            {/* Quality trend chart */}
            <div className="bg-card rounded-xl border border-border p-5 mb-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Quality Score Over Time</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [`${v}`, "Quality Score"]} />
                  <Line type="monotone" dataKey="quality" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Compare runs */}
            <div className="bg-card rounded-xl border border-border p-5 mb-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Compare Two Runs</h2>
              <div className="flex gap-4 mb-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Run A (older)</label>
                  <select
                    value={compareA ?? ""}
                    onChange={(e) => setCompareA(e.target.value ? Number(e.target.value) : null)}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 outline-none"
                  >
                    <option value="">Select run...</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>{format(new Date(r.run_at), "MMM d, yyyy HH:mm")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Run B (newer)</label>
                  <select
                    value={compareB ?? ""}
                    onChange={(e) => setCompareB(e.target.value ? Number(e.target.value) : null)}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 outline-none"
                  >
                    <option value="">Select run...</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>{format(new Date(r.run_at), "MMM d, yyyy HH:mm")}</option>
                    ))}
                  </select>
                </div>
              </div>

              {runA && runB && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Quality Score", a: runA.quality_score, b: runB.quality_score, higher: true },
                    { label: "Row Count", a: runA.row_count, b: runB.row_count, higher: true },
                    { label: "Column Count", a: runA.col_count, b: runB.col_count, higher: false },
                    { label: "Missing %", a: runA.missing_pct, b: runB.missing_pct, higher: false, pct: true },
                  ].map((item, i) => {
                    const d = diff(item.b, item.a, item.higher);
                    return (
                      <div key={i} className="bg-muted rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-foreground">
                            {item.b != null ? (item.pct ? `${item.b.toFixed(1)}%` : item.b.toLocaleString()) : "--"}
                          </span>
                          {d != null && d.delta !== 0 && (
                            <span className={`text-xs flex items-center gap-0.5 ${d.better ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                              {d.better ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(d.delta).toFixed(item.pct ? 1 : 0)}{item.pct ? "%" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          vs {item.a != null ? (item.pct ? `${item.a.toFixed(1)}%` : item.a.toLocaleString()) : "--"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Run Timeline</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">When</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Quality</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Rows</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Cols</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Missing %</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Triggered by</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted">
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-foreground">{format(new Date(r.run_at), "MMM d, yyyy HH:mm")}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.run_at), { addSuffix: true })}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-bold ${r.quality_score == null ? "text-muted-foreground" : r.quality_score >= 80 ? "text-emerald-600 dark:text-emerald-400" : r.quality_score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                          {r.quality_score ?? "--"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{r.row_count?.toLocaleString() ?? "--"}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{r.col_count ?? "--"}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{r.missing_pct != null ? `${r.missing_pct.toFixed(1)}%` : "--"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.triggered_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

