"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { CorrelationHeatmap } from "@/components/charts/CorrelationHeatmap";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { InsightList } from "@/components/shared/InsightCard";
import { AskAiButton } from "@/components/ai/AskAiButton";
import { useAiContextStore } from "@/store/aiContextStore";
import { cn } from "@/lib/utils";
import { Search, X, CheckSquare, Square } from "lucide-react";
import type { CorrelationResult } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const METHODS = ["pearson", "spearman", "kendall"] as const;
type Method = typeof METHODS[number];

const METHOD_DESC: Record<Method, string> = {
  pearson:  "Linear relationships between continuous variables",
  spearman: "Monotonic relationships, robust to outliers",
  kendall:  "Rank-based, best for small datasets or ordinal data",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function absVal(v: number | null | undefined): number {
  return v != null ? Math.abs(v) : 0;
}

function corrColor(r: number): string {
  return r > 0.7 ? "text-blue-600" : r > 0.4 ? "text-blue-500" : r < -0.7 ? "text-red-600" : r < -0.4 ? "text-red-500" : "text-gray-600";
}

// ── Column selector sidebar ───────────────────────────────────────────────────

interface SidebarProps {
  allCols: string[];
  deselected: Set<string>;
  onChange: (col: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

function ColumnSidebar({ allCols, deselected, onChange, onSelectAll, onSelectNone }: SidebarProps) {
  const [search, setSearch] = useState("");
  const visible = useMemo(
    () => allCols.filter((c) => !search || c.toLowerCase().includes(search.toLowerCase())),
    [allCols, search],
  );
  const selectedCount = allCols.length - deselected.size;

  return (
    <aside className="w-56 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col max-h-[75vh] sticky top-20">
      <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Columns</span>
          <span className="text-[10px] text-gray-400 tabular-nums">{selectedCount}/{allCols.length}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="w-full pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex gap-1 mt-2">
          <button
            onClick={onSelectAll}
            className="flex-1 text-[10px] py-1 border border-gray-200 rounded text-gray-500 hover:border-brand/60 hover:text-brand transition"
          >
            All
          </button>
          <button
            onClick={onSelectNone}
            className="flex-1 text-[10px] py-1 border border-gray-200 rounded text-gray-500 hover:border-red-200 hover:text-red-500 transition"
          >
            None
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-1 py-1 scrollbar-hide">
        {visible.map((col) => {
          const checked = !deselected.has(col);
          return (
            <button
              key={col}
              onClick={() => onChange(col)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition",
                checked ? "text-gray-700 hover:bg-gray-50" : "text-gray-400 hover:bg-gray-50",
              )}
              title={col}
            >
              {checked
                ? <CheckSquare className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                : <Square className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
              <span className="font-mono truncate">{col}</span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="text-[10px] text-gray-400 px-2 py-3">No columns match.</p>
        )}
      </div>
    </aside>
  );
}

// ── VIF table ─────────────────────────────────────────────────────────────────

function VifTable({ vif, visibleCols }: { vif: Array<{ column: string; vif: number }>; visibleCols: string[] }) {
  const filtered = vif.filter((v) => visibleCols.includes(v.column));
  if (filtered.length === 0) return null;

  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Variance Inflation Factor (VIF)</h3>
          <p className="text-xs text-gray-400 mt-0.5">VIF &gt; 5: moderate concern · VIF &gt; 10: high multicollinearity</p>
        </div>
        <AskAiButton
          question="Looking at these VIF scores, which columns have multicollinearity concerns and what should I do about them?"
          label="What should I do?"
          variant="chip"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
        {[...filtered].sort((a, b) => b.vif - a.vif).map((v) => (
          <div
            key={v.column}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2.5 text-xs border",
              v.vif > 10
                ? "bg-red-50 border-red-100"
                : v.vif > 5
                ? "bg-amber-50 border-amber-100"
                : "bg-gray-50 border-gray-100",
            )}
          >
            <span className="font-mono text-gray-700 truncate mr-2">{v.column}</span>
            <span className={cn("font-bold tabular-nums flex-shrink-0", v.vif > 10 ? "text-red-600" : v.vif > 5 ? "text-amber-600" : "text-emerald-600")}>
              {v.vif.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top pairs table ───────────────────────────────────────────────────────────

function TopPairsTable({ pairs }: { pairs: Array<{ col1: string; col2: string; correlation: number }> }) {
  if (pairs.length === 0) return null;
  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">
        Strongest Pairs <span className="text-gray-400 font-normal">(by absolute value)</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pairs.map((pair, i) => {
          const abs = Math.abs(pair.correlation);
          return (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="text-xs font-mono text-gray-600 truncate flex-1 min-w-0">
                {pair.col1}
                <span className="text-gray-400 mx-1.5">×</span>
                {pair.col2}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", pair.correlation >= 0 ? "bg-blue-400" : "bg-red-400")}
                    style={{ width: `${abs * 100}%` }}
                  />
                </div>
                <span className={cn("text-xs font-semibold tabular-nums w-12 text-right", corrColor(pair.correlation))}>
                  {pair.correlation.toFixed(3)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CorrelationsPage() {
  const { datasetId }  = useParams<{ datasetId: string }>();
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const setPageContext = useAiContextStore((s) => s.setPageContext);

  const method = (searchParams.get("method") as Method) ?? "pearson";
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  const setMethod = (m: Method) =>
    router.replace(`/datasets/${datasetId}/correlations?method=${m}`);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn:  () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.correlations(datasetId, method),
    queryFn:  () => datasetsApi.getCorrelations(datasetId, method).then((r) => r.data as CorrelationResult),
  });

  // All columns available in the matrix
  const allCols = useMemo(() => Object.keys(data?.matrix ?? {}), [data]);

  // When the method changes, clear deselections (fresh slate)
  useEffect(() => { setDeselected(new Set()); }, [method]);

  // Columns actually rendered
  const visibleCols = useMemo(
    () => allCols.filter((c) => !deselected.has(c)),
    [allCols, deselected],
  );

  // Derive top pairs from the filtered matrix (up to 12)
  const topPairs = useMemo(() => {
    if (!data?.matrix || visibleCols.length < 2) return [];
    const pairs: Array<{ col1: string; col2: string; correlation: number }> = [];
    visibleCols.forEach((c1, i) => {
      visibleCols.slice(i + 1).forEach((c2) => {
        const r = data.matrix[c1]?.[c2];
        if (r != null) pairs.push({ col1: c1, col2: c2, correlation: r });
      });
    });
    return pairs.sort((a, b) => absVal(b.correlation) - absVal(a.correlation)).slice(0, 12);
  }, [data, visibleCols]);

  // AI context — top 3 pairs for brevity
  useEffect(() => {
    const top3 = topPairs.slice(0, 3).map((p) => `${p.col1}↔${p.col2}: ${p.correlation.toFixed(2)}`).join(", ");
    setPageContext({
      page: "correlations",
      label: `Correlations (${method})`,
      details: {
        method,
        selected_columns: visibleCols.length,
        total_columns: allCols.length,
        top_pairs: top3 || "none",
      },
      suggestedQuestions: [
        "Which columns are most strongly correlated?",
        "Are any correlations problematic for modeling?",
        "What do the VIF scores indicate?",
      ],
    });
    return () => setPageContext(null);
  }, [method, topPairs, visibleCols.length, allCols.length, setPageContext]);

  // Sidebar handlers
  const toggleCol = useCallback((col: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

  const selectAll  = useCallback(() => setDeselected(new Set()), []);
  const selectNone = useCallback(() => setDeselected(new Set(allCols)), [allCols]);

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-full mx-auto">
        <Breadcrumb items={[
          { label: "Workspaces", href: "/workspaces" },
          { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
          { label: "Correlations" },
        ]} />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mt-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Correlations</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Pairwise relationships between numeric columns
            </p>
          </div>

          {/* Method pills */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition",
                    m === method ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mr-1">{METHOD_DESC[method]}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-5">
            <div className="w-56 flex-shrink-0 h-64 bg-gray-100 rounded-xl animate-pulse" />
            <div className="flex-1 h-64 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : data ? (
          <div className="flex gap-5 items-start">
            {/* Column selector */}
            <ColumnSidebar
              allCols={allCols}
              deselected={deselected}
              onChange={toggleCol}
              onSelectAll={selectAll}
              onSelectNone={selectNone}
            />

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {data.insights && data.insights.length > 0 && (
                <div className="mb-5">
                  <InsightList insights={data.insights} />
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                {/* Selection summary */}
                {deselected.size > 0 && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-xs text-blue-700">
                      Showing <strong>{visibleCols.length}</strong> of <strong>{allCols.length}</strong> columns.
                    </span>
                    <button onClick={selectAll} className="text-xs text-brand hover:underline ml-1">
                      Show all
                    </button>
                  </div>
                )}

                {/* Heatmap */}
                <CorrelationHeatmap data={data} cols={visibleCols} />

                {/* Top pairs */}
                <TopPairsTable pairs={topPairs} />

                {/* VIF */}
                {data.vif && data.vif.length > 0 && (
                  <VifTable vif={data.vif} visibleCols={visibleCols} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
