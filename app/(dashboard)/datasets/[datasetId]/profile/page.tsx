"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { InsightList } from "@/components/shared/InsightCard";
import { SubNav } from "@/components/layout/SubNav";
import { ColumnDetailPanel } from "@/components/shared/ColumnDetailPanel";
import { MissingHeatmap } from "@/components/charts/MissingHeatmap";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable } from "@/components/shared/DataTable";
import { AskAiButton } from "@/components/ai/AskAiButton";
import { cn } from "@/lib/utils";
import {
  Download, Tag, X, Search, ChevronUp, ChevronDown,
  TableProperties, AlertTriangle, BarChart2, TrendingDown,
  CheckCircle2,
} from "lucide-react";
import type {
  ColumnProfile, ColumnMeta, ProfileResult,
  MissingResult, DistributionResult, OutlierResult,
} from "@/types";

// ── Types & constants ─────────────────────────────────────────────────────────

type ProfileTab = "overview" | "missing" | "distributions" | "outliers";
type OutlierMethod = "iqr" | "zscore" | "isolation_forest";
type SortKey = keyof Pick<ColumnProfile, "missing_pct" | "unique_count" | "mean" | "std" | "skewness" | "min" | "max">;
type SortDir = "asc" | "desc";

const TABS: { id: ProfileTab; label: string; icon: React.ElementType }[] = [
  { id: "overview",      label: "Overview",      icon: TableProperties },
  { id: "missing",       label: "Missing",        icon: AlertTriangle },
  { id: "distributions", label: "Distributions",  icon: BarChart2 },
  { id: "outliers",      label: "Outliers",       icon: TrendingDown },
];

const OUTLIER_METHODS: OutlierMethod[] = ["iqr", "zscore", "isolation_forest"];
const OUTLIER_LABELS: Record<OutlierMethod, string> = {
  iqr: "IQR",
  zscore: "Z-Score",
  isolation_forest: "Isolation Forest",
};

const TYPE_COLOR: Record<string, string> = {
  numeric:     "bg-blue-100 text-brand",
  categorical: "bg-purple-100 text-purple-700",
  datetime:    "bg-green-100 text-green-700",
  boolean:     "bg-amber-100 text-amber-700",
  text:        "bg-rose-100 text-rose-700",
  id_like:     "bg-gray-100 text-gray-600",
  constant:    "bg-red-100 text-red-700",
};

const QUICK_TAGS = ["target", "feature", "id", "sensitive", "drop"] as const;
const TAG_COLORS: Record<string, string> = {
  target:    "bg-emerald-100 text-emerald-700",
  feature:   "bg-blue-100 text-brand",
  id:        "bg-gray-100 text-gray-600",
  sensitive: "bg-red-100 text-red-700",
  drop:      "bg-amber-100 text-amber-700",
};

// ── Shared mini components ────────────────────────────────────────────────────

function MiniBar({ pct }: { pct: number }) {
  const color = pct > 50 ? "bg-red-500" : pct > 20 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={cn("text-xs tabular-nums", pct > 20 ? "text-amber-600 font-medium" : "text-gray-500")}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function renderTopValues(v: ColumnProfile["top_values"]) {
  if (!v || v.length === 0) return <span className="text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {v.slice(0, 3).map((item, i) => (
        <span key={`${item.value}-${i}`} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600 max-w-[100px] truncate">
          {String(item.value).slice(0, 18)}{item.count > 0 ? ` (${item.count})` : ""}
        </span>
      ))}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

interface OverviewTabProps {
  data: ProfileResult;
  allMeta: ColumnMeta[];
  onSelectCol: (col: string) => void;
  onToggleTag: (col: string, tag: string) => void;
  onExport: () => void;
}

function OverviewTab({ data, allMeta, onSelectCol, onToggleTag, onExport }: OverviewTabProps) {
  const [search, setSearch]           = useState("");
  const [sortKey, setSortKey]         = useState<SortKey | null>(null);
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [editingTagCol, setEditingTagCol] = useState<string | null>(null);

  const metaMap = useMemo(() => {
    const m: Record<string, ColumnMeta> = {};
    allMeta.forEach((meta) => { m[meta.column] = meta; });
    return m;
  }, [allMeta]);

  const columns = useMemo(() => {
    let cols = [...data.columns];
    if (search) cols = cols.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    if (sortKey) {
      cols.sort((a, b) => {
        const av = (a[sortKey] as number | null) ?? null;
        const bv = (b[sortKey] as number | null) ?? null;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
      });
    }
    return cols;
  }, [data.columns, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  function SortIcon({ colKey }: { colKey: SortKey }) {
    if (sortKey !== colKey) return <ChevronDown className="w-3 h-3 text-gray-300 ml-0.5 flex-shrink-0" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-brand ml-0.5 flex-shrink-0" />
      : <ChevronDown className="w-3 h-3 text-brand ml-0.5 flex-shrink-0" />;
  }

  const numericCount  = data.columns.filter((c) => c.semantic_type === "numeric").length;
  const missingColCnt = data.columns.filter((c) => c.missing_pct > 0).length;

  const SORT_HEADERS: { label: string; key: SortKey }[] = [
    { label: "Missing",  key: "missing_pct" },
    { label: "Unique",   key: "unique_count" },
    { label: "Mean",     key: "mean" },
    { label: "Std Dev",  key: "std" },
    { label: "Skewness", key: "skewness" },
    { label: "Min",      key: "min" },
    { label: "Max",      key: "max" },
  ];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Columns</p>
          <p className="text-2xl font-bold text-gray-900">{data.total_columns}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Rows</p>
          <p className="text-2xl font-bold text-gray-900">{data.total_rows?.toLocaleString()}</p>
          {data.sampled && <p className="text-[10px] text-amber-600 mt-0.5">Sampled · {data.sample_size?.toLocaleString()}</p>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Numeric Columns</p>
          <p className="text-2xl font-bold text-gray-900">{numericCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">of {data.total_columns} total</p>
        </div>
        <div className={cn("border rounded-xl p-4", missingColCnt > 0 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100")}>
          <p className="text-xs text-gray-400 mb-1">Columns w/ Missing</p>
          <p className={cn("text-2xl font-bold", missingColCnt > 0 ? "text-amber-600" : "text-emerald-600")}>
            {missingColCnt}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{(data.duplicate_pct ?? 0).toFixed(1)}% duplicates</p>
        </div>
      </div>

      {data.insights && data.insights.length > 0 && <InsightList insights={data.insights} />}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns…"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400">{columns.length} of {data.total_columns} columns</span>
        <button
          onClick={onExport}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Column</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Type</th>
              {SORT_HEADERS.map(({ label, key }) => (
                <th
                  key={key}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap cursor-pointer select-none hover:text-gray-800 transition-colors"
                  onClick={() => toggleSort(key)}
                >
                  <span className="inline-flex items-center">{label}<SortIcon colKey={key} /></span>
                </th>
              ))}
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Top Values</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Tags</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => {
              const meta  = metaMap[col.name];
              const tags  = meta?.tags ?? [];
              const isSensitive = tags.includes("sensitive");
              return (
                <tr key={col.name} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {isSensitive && <span title="Sensitive" className="text-sm">🔒</span>}
                      <button
                        onClick={() => onSelectCol(col.name)}
                        className="font-mono text-xs text-brand hover:underline text-left"
                      >
                        {col.name}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", TYPE_COLOR[col.semantic_type] ?? "bg-gray-100 text-gray-600")}>
                      {col.semantic_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><MiniBar pct={col.missing_pct} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 tabular-nums">{col.unique_count?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{col.mean != null ? col.mean.toFixed(3) : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{col.std != null ? col.std.toFixed(3) : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {col.skewness != null ? (
                      <span className={Math.abs(col.skewness) > 1 ? "text-amber-600 font-medium" : "text-gray-600"}>
                        {col.skewness.toFixed(3)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{col.min != null ? String(col.min) : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{col.max != null ? String(col.max) : "—"}</td>
                  <td className="px-4 py-2.5">{renderTopValues(col.top_values)}</td>
                  <td className="px-4 py-2.5">
                    <div className="relative flex flex-wrap gap-1 items-center">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5", TAG_COLORS[tag] ?? "bg-gray-100 text-gray-600")}
                        >
                          {tag}
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleTag(col.name, tag); }}
                            className="ml-0.5 hover:opacity-60 transition"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingTagCol(editingTagCol === col.name ? null : col.name); }}
                        className="text-[10px] text-gray-400 hover:text-brand transition flex items-center gap-0.5"
                      >
                        <Tag className="w-2.5 h-2.5" />
                      </button>
                      {editingTagCol === col.name && (
                        <div className="absolute z-30 top-6 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex gap-1 flex-wrap min-w-[170px]">
                          {QUICK_TAGS.map((t) => (
                            <button
                              key={t}
                              onClick={() => { onToggleTag(col.name, t); setEditingTagCol(null); }}
                              className={cn(
                                "text-[10px] px-2.5 py-1 rounded-full border transition",
                                tags.includes(t)
                                  ? "bg-brand text-white border-brand"
                                  : "border-gray-200 text-gray-600 hover:border-brand/60 hover:text-brand",
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {columns.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400">No columns match your search.</div>
        )}
      </div>
    </div>
  );
}

// ── Missing tab ───────────────────────────────────────────────────────────────

function MissingTab({ datasetId, totalColumns }: { datasetId: string; totalColumns: number }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.missing(datasetId),
    queryFn: () => datasetsApi.getMissing(datasetId).then((r) => r.data as MissingResult),
  });

  if (isLoading) return <div className="py-16"><PageSpinner /></div>;
  if (!data) return null;

  const missingCols = data.columns.filter((c) => c.count > 0);
  const tableRows = [...missingCols]
    .sort((a, b) => b.pct - a.pct)
    .map((col) => ({
      column:     col.name,
      count:      col.count,
      pct:        col.pct,
      dtype:      col.dtype ?? "—",
      suggestion: (data.imputation_suggestions as Record<string, string> | undefined)?.[col.name] ?? null,
    }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Missing Cells"
          value={data.total_missing?.toLocaleString() ?? "0"}
          color={data.missing_pct > 20 ? "red" : data.missing_pct > 5 ? "amber" : "green"}
        />
        <StatCard
          label="Overall Missing %"
          value={`${(data.missing_pct ?? 0).toFixed(2)}%`}
          color={data.missing_pct > 20 ? "red" : "default"}
        />
        <StatCard
          label="Affected Columns"
          value={missingCols.length}
          sub={`of ${totalColumns} total`}
        />
      </div>

      {missingCols.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">No missing values</p>
            <p className="text-xs text-emerald-600 mt-0.5">This dataset has complete data in all columns.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Missing by Column</h2>
            <MissingHeatmap data={data} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Column Breakdown</h3>
              <AskAiButton
                question="Looking at these missing values, which columns should I drop vs impute? What's the best strategy?"
                label="How to fix?"
                variant="chip"
              />
            </div>
            <DataTable
              columns={[
                {
                  key: "column",
                  label: "Column",
                  render: (v) => <span className="font-mono text-xs">{String(v)}</span>,
                },
                {
                  key: "count",
                  label: "Count",
                  align: "right" as const,
                  sortable: true,
                  render: (v) => <span className="tabular-nums text-xs">{Number(v).toLocaleString()}</span>,
                },
                {
                  key: "pct",
                  label: "Missing %",
                  align: "right" as const,
                  sortable: true,
                  render: (v) => {
                    const pct = Number(v);
                    const color = pct > 50 ? "bg-red-500" : pct > 20 ? "bg-amber-400" : "bg-blue-400";
                    return (
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={cn("text-xs tabular-nums", pct > 50 ? "text-red-600 font-semibold" : pct > 20 ? "text-amber-600" : "text-gray-600")}>
                          {pct.toFixed(2)}%
                        </span>
                      </div>
                    );
                  },
                },
                {
                  key: "dtype",
                  label: "Type",
                  render: (v) => <span className="text-xs text-gray-500">{String(v)}</span>,
                },
                {
                  key: "suggestion",
                  label: "Suggested Strategy",
                  render: (v) => v ? (
                    <span className="text-xs text-brand bg-blue-50 px-2 py-0.5 rounded-full font-medium">{String(v)}</span>
                  ) : <span className="text-xs text-gray-300">—</span>,
                },
              ]}
              data={tableRows as unknown as Record<string, unknown>[]}
              rowKey={(r) => String(r.column)}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Distributions tab ─────────────────────────────────────────────────────────

function DistributionsTab({ datasetId, numericCols }: { datasetId: string; numericCols: string[] }) {
  const [selectedCol, setSelectedCol] = useState<string>(numericCols[0] ?? "");
  const [colSearch, setColSearch]     = useState("");

  const filtered = useMemo(
    () => numericCols.filter((c) => !colSearch || c.toLowerCase().includes(colSearch.toLowerCase())),
    [numericCols, colSearch],
  );

  const activeCol = filtered.includes(selectedCol) ? selectedCol : (filtered[0] ?? "");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.distributions(datasetId, activeCol),
    queryFn: () => datasetsApi.getDistributions(datasetId, activeCol).then((r) => r.data as DistributionResult),
    enabled: !!activeCol,
  });

  if (numericCols.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <BarChart2 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
        <p className="text-sm text-gray-400">No numeric columns in this dataset.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-5 items-start">
      {/* Column sidebar */}
      <div className="w-52 flex-shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            value={colSearch}
            onChange={(e) => setColSearch(e.target.value)}
            placeholder="Filter columns…"
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand transition"
          />
        </div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1">
          {filtered.length} numeric columns
        </p>
        <div className="space-y-0.5 max-h-[65vh] overflow-y-auto scrollbar-hide pr-1">
          {filtered.map((col) => (
            <button
              key={col}
              onClick={() => setSelectedCol(col)}
              title={col}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-xs transition truncate",
                col === activeCol
                  ? "bg-blue-50 text-brand font-semibold"
                  : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {col}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 px-2 py-3">No columns match.</p>
          )}
        </div>
      </div>

      {/* Chart panel */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6 min-h-[420px]">
        {!activeCol ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Select a column on the left.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <PageSpinner />
          </div>
        ) : data ? (
          <>
            {/* Stat chips */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {data.skewness != null && (
                <span className={cn(
                  "text-xs px-2.5 py-1 rounded-full font-medium",
                  Math.abs(data.skewness) > 1 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700",
                )}>
                  Skewness: {data.skewness.toFixed(3)}
                </span>
              )}
              {data.kurtosis != null && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
                  Kurtosis: {data.kurtosis.toFixed(3)}
                </span>
              )}
              {data.normality?.is_normal != null && (
                <span className={cn(
                  "text-xs px-2.5 py-1 rounded-full font-medium",
                  data.normality.is_normal ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                )}>
                  {data.normality.is_normal ? "Normal distribution" : "Non-normal distribution"}
                </span>
              )}
            </div>
            <DistributionChart data={data} column={activeCol} />
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Outliers tab ──────────────────────────────────────────────────────────────

function OutliersTab({ datasetId, numericCols }: { datasetId: string; numericCols: string[] }) {
  const [method, setMethod] = useState<OutlierMethod>("iqr");
  const [colSel, setColSel] = useState<string | null>(null);

  const activeCol = method !== "isolation_forest" ? (colSel ?? numericCols[0] ?? "") : undefined;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.outliers(datasetId, method, activeCol),
    queryFn: () => datasetsApi.getOutliers(datasetId, method, activeCol).then((r) => r.data as OutlierResult),
    enabled: !!activeCol || method === "isolation_forest",
  });

  const avgPct =
    data?.columns && data.columns.length > 0
      ? data.columns.reduce((s, c) => s + c.outlier_pct, 0) / data.columns.length
      : 0;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {OUTLIER_METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition",
                m === method ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
              )}
            >
              {OUTLIER_LABELS[m]}
            </button>
          ))}
        </div>

        {method !== "isolation_forest" && numericCols.length > 0 && (
          <select
            value={activeCol ?? ""}
            onChange={(e) => setColSel(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white"
          >
            {numericCols.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <div className="ml-auto">
          <AskAiButton
            question={`I'm looking at outlier detection using ${OUTLIER_LABELS[method]}. Should I remove, cap, or keep these outliers?`}
            label="What should I do?"
            variant="chip"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-16"><PageSpinner /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Total Outliers"
              value={data.total_outliers?.toLocaleString() ?? "0"}
              color={data.total_outliers > 0 ? "amber" : "green"}
            />
            <StatCard
              label="Avg Outlier %"
              value={`${avgPct.toFixed(2)}%`}
              color={avgPct > 5 ? "red" : "default"}
            />
            <StatCard label="Detection Method" value={OUTLIER_LABELS[method]} />
          </div>

          {data.total_outliers === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">No outliers detected</p>
                <p className="text-xs text-emerald-600 mt-0.5">Using {OUTLIER_LABELS[method]} method.</p>
              </div>
            </div>
          ) : data.columns && data.columns.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Outliers by Column</h3>
              </div>
              <DataTable
                columns={[
                  {
                    key: "column",
                    label: "Column",
                    render: (v) => <span className="font-mono text-xs">{String(v)}</span>,
                  },
                  {
                    key: "count",
                    label: "Outliers",
                    align: "right" as const,
                    sortable: true,
                    render: (v) => <span className="tabular-nums text-xs">{Number(v).toLocaleString()}</span>,
                  },
                  {
                    key: "pct",
                    label: "% of rows",
                    align: "right" as const,
                    sortable: true,
                    render: (v) => {
                      const pct = Number(v);
                      const barColor = pct > 10 ? "bg-red-500" : pct > 5 ? "bg-amber-400" : "bg-blue-400";
                      return (
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(pct * 5, 100)}%` }} />
                          </div>
                          <span className={cn("text-xs tabular-nums", pct > 5 ? "text-amber-600 font-medium" : "text-gray-600")}>
                            {pct.toFixed(2)}%
                          </span>
                        </div>
                      );
                    },
                  },
                  {
                    key: "lower_bound",
                    label: "Lower Bound",
                    align: "right" as const,
                    render: (v) => v != null
                      ? <span className="font-mono text-xs text-gray-600">{Number(v).toFixed(3)}</span>
                      : <span className="text-gray-300">—</span>,
                  },
                  {
                    key: "upper_bound",
                    label: "Upper Bound",
                    align: "right" as const,
                    render: (v) => v != null
                      ? <span className="font-mono text-xs text-gray-600">{Number(v).toFixed(3)}</span>
                      : <span className="text-gray-300">—</span>,
                  },
                ]}
                data={data.columns.map((col) => ({
                  column:      col.name,
                  count:       col.outlier_count,
                  pct:         col.outlier_pct,
                  lower_bound: col.bounds?.lower ?? (col.bounds as Record<string, number | null>)?.lower_bound ?? null,
                  upper_bound: col.bounds?.upper ?? (col.bounds as Record<string, number | null>)?.upper_bound ?? null,
                }))}
                rowKey={(r) => String(r.column)}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const qc            = useQueryClient();

  const activeTab = (searchParams.get("tab") as ProfileTab) ?? "overview";
  const [selectedCol, setSelectedCol] = useState<string | null>(null);

  const setTab = (tab: ProfileTab) => {
    router.replace(`/datasets/${datasetId}/profile?tab=${tab}`);
  };

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn:  () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profileData, isLoading } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn:  () => datasetsApi.getProfile(datasetId).then((r) => r.data as ProfileResult),
  });

  const { data: allMeta } = useQuery({
    queryKey: queryKeys.columnMeta.all(datasetId),
    queryFn:  () => datasetsApi.getAllColumnMetadata(datasetId).then((r) => r.data as ColumnMeta[]),
  });

  const tagMutation = useMutation({
    mutationFn: ({ column, tags, notes }: { column: string; tags: string[]; notes?: string }) =>
      datasetsApi.upsertColumnMetadata(datasetId, column, { tags, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.columnMeta.all(datasetId) }),
  });

  const metaMap = useMemo(() => {
    const m: Record<string, ColumnMeta> = {};
    (allMeta ?? []).forEach((meta) => { m[meta.column] = meta; });
    return m;
  }, [allMeta]);

  const toggleTag = useCallback((colName: string, tag: string) => {
    const current = metaMap[colName]?.tags ?? [];
    const next    = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    tagMutation.mutate({ column: colName, tags: next, notes: metaMap[colName]?.notes ?? undefined });
  }, [metaMap, tagMutation]);

  const numericCols = useMemo(
    () => (profileData?.columns ?? [])
      .filter((c) => ["numeric", "boolean"].includes(c.semantic_type))
      .map((c) => c.name),
    [profileData],
  );

  const exportCsv = useCallback(() => {
    if (!profileData?.columns) return;
    const headers = ["name", "dtype", "semantic_type", "missing_pct", "unique_count", "mean", "std", "min", "max", "skewness"];
    const rows = profileData.columns.map((c) =>
      headers.map((h) => {
        const v = (c as unknown as Record<string, unknown>)[h];
        return v != null ? String(v) : "";
      }).join(","),
    );
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `${dataset?.name ?? "profile"}_profile.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [profileData, dataset]);

  if (isLoading) return <><SubNav datasetId={datasetId} /><PageSpinner /></>;
  if (!profileData) return null;

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-full mx-auto">
        <Breadcrumb items={[
          { label: "Workspaces", href: "/workspaces" },
          { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
          { label: "Profile" },
        ]} />

        <div className="mt-4 mb-5">
          <h1 className="text-xl font-bold text-gray-900">Data Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profileData.total_columns} columns · {profileData.total_rows?.toLocaleString()} rows
            {profileData.sampled && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Sampled</span>
            )}
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-gray-100 mb-6 -mx-0 gap-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === id
                  ? "border-brand text-brand"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <OverviewTab
            data={profileData}
            allMeta={allMeta ?? []}
            onSelectCol={setSelectedCol}
            onToggleTag={toggleTag}
            onExport={exportCsv}
          />
        )}
        {activeTab === "missing" && (
          <MissingTab datasetId={datasetId} totalColumns={profileData.total_columns} />
        )}
        {activeTab === "distributions" && (
          <DistributionsTab datasetId={datasetId} numericCols={numericCols} />
        )}
        {activeTab === "outliers" && (
          <OutliersTab datasetId={datasetId} numericCols={numericCols} />
        )}
      </div>

      {selectedCol && (
        <ColumnDetailPanel
          datasetId={datasetId}
          columnName={selectedCol}
          onClose={() => setSelectedCol(null)}
        />
      )}
    </>
  );
}
