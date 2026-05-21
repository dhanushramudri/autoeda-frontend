"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AskAiButton } from "@/components/ai/AskAiButton";
import { useAiContextStore } from "@/store/aiContextStore";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import {
  TrendingUp, AlertTriangle, Info, CheckCircle2, XCircle,
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  Layers, Table2, BarChart2, Lightbulb, Target,
  ArrowUpRight, Minus, RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureMeta {
  feature: string;
  rf_importance: number | null;
  mi_score: number | null;
  correlation: number | null;
  anova_f: number | null;
  combined_rank: number;
  missing_pct: number;
  unique_count: number;
  dtype: string;
  recommendation: "keep_strong" | "keep" | "consider_drop" | "drop";
}

interface FIResult {
  target: string;
  problem_type: string;
  n_samples: number;
  n_features: number;
  model_score: number | null;
  class_distribution: Record<string, { count: number; pct: number }> | null;
  importances: Array<{ feature: string; importance: number }>;
  mutual_info: Array<{ feature: string; score: number }>;
  correlations: Array<{ feature: string; correlation: number }>;
  anova: Array<{ feature: string; f_score: number }>;
  feature_meta: FeatureMeta[];
  top_features: string[];
  drop_candidates: string[];
  warnings: Array<{ type: string; message: string; level: "danger" | "warning" | "info" }>;
  error?: string;
}

type Tab = "overview" | "rankings" | "charts" | "insights";
type SortKey = "combined_rank" | "rf_importance" | "mi_score" | "correlation" | "anova_f" | "missing_pct";
type SortDir = "asc" | "desc";
type ChartMethod = "rf" | "mi" | "correlation" | "anova";

// ── Constants ─────────────────────────────────────────────────────────────────

const PALETTE = [
  "#1D4ED8","#7C3AED","#0891B2","#059669",
  "#D97706","#DC2626","#DB2777","#2563EB",
  "#0D9488","#6366F1",
];

const REC_CONFIG = {
  keep_strong:  { label: "Strong",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  keep:         { label: "Keep",         cls: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-400" },
  consider_drop:{ label: "Weak",         cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400" },
  drop:         { label: "Drop",         cls: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400" },
};

const WARN_CFG = {
  danger:  { cls: "bg-red-50 border-red-200 text-red-800",    icon: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" /> },
  warning: { cls: "bg-amber-50 border-amber-200 text-amber-800", icon: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" /> },
  info:    { cls: "bg-blue-50 border-blue-200 text-blue-800",  icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" /> },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(decimals);
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums text-gray-600 font-mono">{fmt(value, 4)}</span>
    </div>
  );
}

function Badge({ rec }: { rec: FeatureMeta["recommendation"] }) {
  const cfg = REC_CONFIG[rec];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview",  label: "Overview",   icon: <Layers className="w-3.5 h-3.5" /> },
  { key: "rankings",  label: "Rankings",   icon: <Table2 className="w-3.5 h-3.5" /> },
  { key: "charts",    label: "Charts",     icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { key: "insights",  label: "Insights",   icon: <Lightbulb className="w-3.5 h-3.5" /> },
];

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: FIResult }) {
  const topMeta = data.feature_meta.slice(0, 5);
  const maxRF = Math.max(...(data.importances.map((i) => i.importance)), 0.0001);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Problem Type",
            value: data.problem_type === "classification" ? "Classification" : "Regression",
            sub: `${data.n_samples.toLocaleString()} rows`,
            color: data.problem_type === "classification" ? "#7C3AED" : "#0891B2",
          },
          {
            label: "Features Analysed",
            value: data.n_features,
            sub: `${data.drop_candidates.length} weak`,
            color: "#1D4ED8",
          },
          {
            label: data.problem_type === "classification" ? "OOB Accuracy" : "OOB R²",
            value: data.model_score != null ? `${(data.model_score * 100).toFixed(1)}%` : "—",
            sub: "Random Forest",
            color: data.model_score != null && data.model_score > 0.8 ? "#059669" : data.model_score != null && data.model_score > 0.6 ? "#D97706" : "#DC2626",
          },
          {
            label: "Top Feature",
            value: data.top_features[0] ?? "—",
            sub: data.importances[0] ? `RF: ${fmt(data.importances[0].importance, 3)}` : "",
            color: "#059669",
            mono: true,
          },
        ].map(({ label, value, sub, color, mono }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={cn("text-lg font-bold truncate", mono && "font-mono text-sm")} style={{ color }}>
              {value}
            </p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top 5 features */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">Top Features</h3>
            <AskAiButton
              question={`The top 5 features are: ${data.top_features.slice(0, 5).join(", ")}. Explain why these might be important predictors for ${data.target}.`}
              label="Explain"
              variant="chip"
            />
          </div>
          <div className="space-y-3">
            {topMeta.map((fm, i) => {
              const imp = fm.rf_importance ?? 0;
              const pct = maxRF > 0 ? (imp / maxRF) * 100 : 0;
              return (
                <div key={fm.feature} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-300 w-4 flex-shrink-0 tabular-nums">{i + 1}</span>
                  <span className="font-mono text-xs text-gray-700 truncate w-32 flex-shrink-0" title={fm.feature}>
                    {fm.feature}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: PALETTE[i % PALETTE.length],
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-500 w-12 text-right flex-shrink-0">
                    {fmt(imp, 3)}
                  </span>
                  <Badge rec={fm.recommendation} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Class distribution or correlation quick view */}
        {data.class_distribution ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              Target Distribution
              <span className="ml-2 font-mono text-xs font-normal text-gray-400">{data.target}</span>
            </h3>
            <div className="space-y-2">
              {Object.entries(data.class_distribution).map(([cls, stats], i) => (
                <div key={cls} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24 truncate flex-shrink-0 font-mono" title={cls}>{cls}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${stats.pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-500 w-20 text-right flex-shrink-0">
                    {stats.pct.toFixed(1)}% ({stats.count.toLocaleString()})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Correlation with Target</h3>
            <div className="space-y-2">
              {data.correlations.slice(0, 8).map((item, i) => {
                const abs = Math.abs(item.correlation);
                const isPos = item.correlation >= 0;
                return (
                  <div key={item.feature} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-600 w-28 truncate flex-shrink-0">{item.feature}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${abs * 100}%`,
                          backgroundColor: isPos ? "#1D4ED8" : "#DC2626",
                        }}
                      />
                    </div>
                    <span className={cn("text-[10px] tabular-nums w-14 text-right flex-shrink-0 font-semibold",
                      isPos ? "text-blue-600" : "text-red-600")}>
                      {item.correlation.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Drop candidates */}
      {data.drop_candidates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-800">
              {data.drop_candidates.length} Low-Importance Feature{data.drop_candidates.length > 1 ? "s" : ""} to Consider Dropping
            </h3>
            <AskAiButton
              question={`These features score low on all importance methods: ${data.drop_candidates.join(", ")}. Should I drop them, and what's the risk of doing so for predicting ${data.target}?`}
              label="Should I drop them?"
              variant="chip"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.drop_candidates.map((f) => (
              <span key={f} className="px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-mono text-amber-700">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rankings Tab ──────────────────────────────────────────────────────────────

function RankingsTab({ data }: { data: FIResult }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("combined_rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const maxRF   = useMemo(() => Math.max(...data.feature_meta.map((f) => f.rf_importance ?? 0), 0.0001), [data]);
  const maxMI   = useMemo(() => Math.max(...data.feature_meta.map((f) => f.mi_score ?? 0), 0.0001), [data]);
  const maxAnova= useMemo(() => Math.max(...data.feature_meta.map((f) => f.anova_f ?? 0), 0.0001), [data]);

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = data.feature_meta.filter((f) =>
      !q || f.feature.toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? (sortKey === "combined_rank" ? 9999 : -1);
      const bv = (b[sortKey] as number | null) ?? (sortKey === "combined_rank" ? 9999 : -1);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data.feature_meta, search, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "combined_rank" ? "asc" : "desc"); }
  }, [sortKey]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-brand" />
      : <ChevronDown className="w-3 h-3 text-brand" />;
  }

  const TH = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 transition whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      <span className="flex items-center gap-1">{label}<SortIcon col={col} /></span>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Search + count */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter features…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <span className="text-xs text-gray-400 tabular-nums">{sorted.length}/{data.feature_meta.length} features</span>
        <AskAiButton
          question={`Here are the feature importance rankings for target "${data.target}". Which features should I definitely keep and which ones can I drop for a cleaner model?`}
          label="Get recommendation"
          variant="chip"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">#</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Feature</th>
              <TH col="rf_importance"  label="RF Importance" />
              <TH col="mi_score"       label="Mutual Info" />
              <TH col="anova_f"        label="ANOVA F" />
              <TH col="correlation"    label="Correlation" />
              <TH col="missing_pct"    label="Missing %" />
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((fm, idx) => (
              <tr key={fm.feature} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                <td className="px-3 py-2 text-gray-300 tabular-nums font-mono">{idx + 1}</td>
                <td className="px-3 py-2 font-mono font-semibold text-gray-800 max-w-[160px]">
                  <span className="truncate block" title={fm.feature}>{fm.feature}</span>
                </td>
                <td className="px-3 py-2">
                  {fm.rf_importance != null
                    ? <ScoreBar value={fm.rf_importance} max={maxRF} color="#1D4ED8" />
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2">
                  {fm.mi_score != null
                    ? <ScoreBar value={fm.mi_score} max={maxMI} color="#7C3AED" />
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2">
                  {fm.anova_f != null
                    ? <ScoreBar value={fm.anova_f} max={maxAnova} color="#0891B2" />
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2">
                  {fm.correlation != null ? (
                    <span className={cn("font-semibold tabular-nums",
                      fm.correlation > 0.5 ? "text-blue-600" :
                      fm.correlation < -0.5 ? "text-red-600" : "text-gray-500")}>
                      {fm.correlation.toFixed(3)}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("font-semibold tabular-nums",
                    fm.missing_pct > 30 ? "text-red-500" :
                    fm.missing_pct > 10 ? "text-amber-500" : "text-gray-400")}>
                    {fm.missing_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-2"><Badge rec={fm.recommendation} /></td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-400">
                  No features match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Charts Tab ────────────────────────────────────────────────────────────────

function ChartsTab({ data }: { data: FIResult }) {
  const [method, setMethod] = useState<ChartMethod>("rf");

  const chartData = useMemo(() => {
    switch (method) {
      case "rf":
        return data.importances.map((d, i) => ({ name: d.feature, value: d.importance, idx: i }));
      case "mi":
        return data.mutual_info.map((d, i) => ({ name: d.feature, value: d.score, idx: i }));
      case "correlation":
        return data.correlations.map((d, i) => ({ name: d.feature, value: Math.abs(d.correlation), raw: d.correlation, idx: i }));
      case "anova":
        return data.anova.map((d, i) => ({ name: d.feature, value: d.f_score, idx: i }));
      default:
        return [];
    }
  }, [data, method]);

  const METHODS: { key: ChartMethod; label: string; desc: string; color: string }[] = [
    { key: "rf",          label: "Random Forest",   desc: "Impurity-based feature importance from 100 trees", color: "#1D4ED8" },
    { key: "mi",          label: "Mutual Info",      desc: "Non-linear statistical dependency with target",    color: "#7C3AED" },
    { key: "correlation", label: "Correlation",      desc: "Absolute Pearson r with the target variable",      color: "#0891B2" },
    { key: "anova",       label: data.problem_type === "classification" ? "ANOVA F" : "F-Regression",
      desc: data.problem_type === "classification" ? "F-statistic testing group mean differences" : "F-statistic from linear regression",
      color: "#059669" },
  ];

  const active = METHODS.find((m) => m.key === method)!;
  const chartHeight = Math.max(280, chartData.length * 26);

  return (
    <div className="space-y-5">
      {/* Method selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">Importance Method</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={cn(
                "text-left px-3 py-2.5 rounded-lg border text-xs transition",
                method === m.key
                  ? "border-current shadow-sm text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              )}
              style={method === m.key ? { backgroundColor: m.color, borderColor: m.color } : {}}
            >
              <p className="font-semibold">{m.label}</p>
              <p className={cn("mt-0.5 text-[10px] leading-tight", method === m.key ? "text-white/70" : "text-gray-400")}>
                {m.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">{active.label} — Feature Scores</h3>
            <p className="text-xs text-gray-400 mt-0.5">{active.desc}</p>
          </div>
          <AskAiButton
            question={`Looking at the ${active.label} feature importance scores for target "${data.target}", which features stand out and why?`}
            label="Explain scores"
            variant="chip"
          />
        </div>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            No data available for this method.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 80, bottom: 4, left: 140 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                width={135}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }}
                formatter={(v: number, _, entry) => {
                  const label = method === "correlation" && entry.payload.raw != null
                    ? `${entry.payload.raw.toFixed(4)} (|r|=${v.toFixed(4)})`
                    : v.toFixed(6);
                  return [label, active.label];
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={`${active.color}${Math.round(255 - i * (150 / Math.max(chartData.length, 1))).toString(16).padStart(2, "0")}`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Comparison mini-grid */}
      {data.feature_meta.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-1">All-Method Comparison</h3>
          <p className="text-xs text-gray-400 mb-4">Top 10 features across all methods (normalised 0–1)</p>
          <div className="space-y-2">
            {data.feature_meta.slice(0, 10).map((fm) => {
              const rfN  = fm.rf_importance  != null ? fm.rf_importance  / Math.max(...data.feature_meta.map((x) => x.rf_importance  ?? 0), 0.0001) : 0;
              const miN  = fm.mi_score       != null ? fm.mi_score       / Math.max(...data.feature_meta.map((x) => x.mi_score       ?? 0), 0.0001) : 0;
              const anN  = fm.anova_f        != null ? fm.anova_f        / Math.max(...data.feature_meta.map((x) => x.anova_f        ?? 0), 0.0001) : 0;
              const crN  = fm.correlation    != null ? Math.abs(fm.correlation) / Math.max(...data.feature_meta.map((x) => Math.abs(x.correlation ?? 0)), 0.0001) : 0;
              return (
                <div key={fm.feature} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-gray-700 w-28 truncate flex-shrink-0">{fm.feature}</span>
                  <div className="flex-1 flex gap-0.5 h-3 rounded overflow-hidden">
                    <div style={{ width: `${rfN * 25}%`, backgroundColor: "#1D4ED8" }} title={`RF: ${fmt(fm.rf_importance, 4)}`} />
                    <div style={{ width: `${miN * 25}%`, backgroundColor: "#7C3AED" }} title={`MI: ${fmt(fm.mi_score, 4)}`} />
                    <div style={{ width: `${anN * 25}%`, backgroundColor: "#0891B2" }} title={`ANOVA: ${fmt(fm.anova_f, 2)}`} />
                    <div style={{ width: `${crN * 25}%`, backgroundColor: "#059669" }} title={`|r|: ${fmt(fm.correlation != null ? Math.abs(fm.correlation) : null, 3)}`} />
                  </div>
                  <Badge rec={fm.recommendation} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 flex-wrap">
            {[["#1D4ED8","RF"], ["#7C3AED","MI"], ["#0891B2","ANOVA"], ["#059669","|r|"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c }} />{l}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Insights Tab ──────────────────────────────────────────────────────────────

function InsightsTab({ data }: { data: FIResult }) {
  const insights = useMemo(() => {
    const items: Array<{ level: "success" | "warning" | "danger" | "info"; title: string; body: string }> = [];

    // Model quality
    if (data.model_score != null) {
      const score = data.model_score;
      const metric = data.problem_type === "classification" ? "OOB accuracy" : "OOB R²";
      if (score > 0.85) {
        items.push({ level: "success", title: "Strong predictive signal", body: `${metric} = ${(score * 100).toFixed(1)}%. The features collectively predict ${data.target} very well.` });
      } else if (score > 0.65) {
        items.push({ level: "info",    title: "Moderate predictive signal", body: `${metric} = ${(score * 100).toFixed(1)}%. Reasonable signal — feature engineering or more data may help.` });
      } else {
        items.push({ level: "warning", title: "Low predictive signal",  body: `${metric} = ${(score * 100).toFixed(1)}%. Current features predict ${data.target} poorly. Consider adding domain-relevant columns.` });
      }
    }

    // Top feature domination
    if (data.importances.length >= 2) {
      const top = data.importances[0].importance;
      const total = data.importances.reduce((s, x) => s + x.importance, 0);
      const topShare = top / total;
      if (topShare > 0.5) {
        items.push({ level: "warning", title: `"${data.importances[0].feature}" dominates (${(topShare * 100).toFixed(1)}%)`, body: "One feature explains the majority of variance. This may indicate data leakage or a trivially predictive column. Double-check this feature." });
      }
    }

    // Features with agreement across methods
    const agreed = data.feature_meta.filter((f) => {
      const hasRF = f.rf_importance != null && f.rf_importance > 0.01;
      const hasMI = f.mi_score != null && f.mi_score > 0.01;
      return hasRF && hasMI && f.recommendation === "keep_strong";
    });
    if (agreed.length > 0) {
      items.push({ level: "success", title: `${agreed.length} feature(s) confirmed important by multiple methods`, body: `${agreed.slice(0,4).map((f) => f.feature).join(", ")}${agreed.length > 4 ? "…" : ""} — high confidence, prioritise these in your model.` });
    }

    // Drop candidates
    if (data.drop_candidates.length > 0) {
      const pct = Math.round((data.drop_candidates.length / data.n_features) * 100);
      items.push({ level: "warning", title: `${data.drop_candidates.length} features (${pct}%) score near-zero on all methods`, body: `Dropping ${data.drop_candidates.slice(0, 3).join(", ")}${data.drop_candidates.length > 3 ? "…" : ""} may simplify the model without sacrificing much accuracy. Validate with a train/test split.` });
    }

    // High missing
    const highMissing = data.feature_meta.filter((f) => f.missing_pct > 20);
    if (highMissing.length > 0) {
      items.push({ level: "warning", title: `${highMissing.length} feature(s) have >20% missing values`, body: `${highMissing.slice(0,3).map((f) => `${f.feature} (${f.missing_pct.toFixed(1)}%)`).join(", ")}. Impute (median/mean/model-based) before training or the model will lose rows.` });
    }

    // Class imbalance
    if (data.problem_type === "classification" && data.class_distribution) {
      const pcts = Object.values(data.class_distribution).map((v) => v.pct);
      const dominant = Math.max(...pcts);
      if (dominant > 75) {
        items.push({ level: "danger", title: "Severe class imbalance", body: `Dominant class = ${dominant.toFixed(1)}%. Use stratified K-fold, SMOTE, class_weight="balanced", or F1/AUC metrics instead of accuracy.` });
      }
    }

    // Negative correlations
    const negCorr = data.correlations.filter((c) => c.correlation < -0.4);
    if (negCorr.length > 0) {
      items.push({ level: "info", title: `${negCorr.length} feature(s) negatively correlated with target`, body: `${negCorr.slice(0, 3).map((c) => `${c.feature} (r=${c.correlation.toFixed(2)})`).join(", ")}. These are inverse predictors — they still carry useful signal.` });
    }

    // Feature count vs sample size
    const ratio = data.n_features / Math.max(data.n_samples, 1);
    if (ratio > 0.1) {
      items.push({ level: "warning", title: "High feature-to-sample ratio", body: `${data.n_features} features / ${data.n_samples} rows (${(ratio * 100).toFixed(1)}%). Risk of overfitting. Use regularisation (L1/L2) or aggressive feature selection.` });
    }

    return items;
  }, [data]);

  const LEVEL_CFG = {
    success: { cls: "border-emerald-200 bg-emerald-50", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />, title: "text-emerald-800", body: "text-emerald-700" },
    info:    { cls: "border-blue-200 bg-blue-50",       icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />,          title: "text-blue-800",    body: "text-blue-700" },
    warning: { cls: "border-amber-200 bg-amber-50",     icon: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />, title: "text-amber-800",   body: "text-amber-700" },
    danger:  { cls: "border-red-200 bg-red-50",         icon: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />,        title: "text-red-800",     body: "text-red-700" },
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{insights.length} auto-generated insight{insights.length !== 1 ? "s" : ""} based on all methods</p>
        <AskAiButton
          question={`Based on the feature importance analysis for target "${data.target}" (problem type: ${data.problem_type}, OOB score: ${data.model_score != null ? (data.model_score * 100).toFixed(1) + "%" : "N/A"}, top features: ${data.top_features.slice(0, 3).join(", ")}), give me a concrete feature selection strategy and next steps.`}
          label="Full AI analysis"
          variant="chip"
        />
      </div>

      {insights.map((item, i) => {
        const cfg = LEVEL_CFG[item.level];
        return (
          <div key={i} className={cn("border rounded-xl p-4 flex gap-3", cfg.cls)}>
            {cfg.icon}
            <div>
              <p className={cn("text-sm font-semibold", cfg.title)}>{item.title}</p>
              <p className={cn("text-xs mt-0.5 leading-relaxed", cfg.body)}>{item.body}</p>
            </div>
          </div>
        );
      })}

      {/* Action checklist */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mt-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-brand" />
          Feature Selection Checklist
        </h3>
        <div className="space-y-2.5">
          {[
            { done: data.top_features.length > 0,           text: `Identify strong predictors: ${data.top_features.slice(0, 3).join(", ") || "—"}` },
            { done: data.drop_candidates.length > 0,        text: `Remove low-importance features (${data.drop_candidates.length} candidates found)` },
            { done: data.model_score != null,                text: `Baseline model score established: ${data.model_score != null ? (data.model_score * 100).toFixed(1) + "%" : "run model"}` },
            { done: data.feature_meta.some((f) => f.missing_pct === 0), text: "Handle missing values in features" },
            { done: false,                                   text: "Validate selected features with cross-validation" },
            { done: false,                                   text: "Check for feature leakage (suspiciously high importance)" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {item.done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                : <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0 mt-0.5" />}
              <span className={cn("text-xs", item.done ? "text-gray-700" : "text-gray-400")}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FeatureImportancePage() {
  const { datasetId }  = useParams<{ datasetId: string }>();
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const setPageContext = useAiContextStore((s) => s.setPageContext);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const targetCol = searchParams.get("target") ?? "";

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const allCols: string[] = useMemo(
    () => profile?.columns.map((c: { name: string }) => c.name) ?? [],
    [profile]
  );
  const activeTarget = targetCol || allCols[allCols.length - 1] || "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.eda.featureImportance(datasetId, activeTarget),
    queryFn: () => datasetsApi.getFeatureImportance(datasetId, activeTarget).then((r) => r.data as FIResult),
    enabled: !!activeTarget,
    staleTime: 1000 * 60 * 10,
  });

  const setTarget = useCallback(
    (col: string) => router.replace(`/datasets/${datasetId}/feature-importance?target=${encodeURIComponent(col)}`),
    [datasetId, router]
  );

  // AI context
  useEffect(() => {
    if (!data) return;
    setPageContext({
      page: "feature-importance",
      label: `Feature Importance — ${data.target}`,
      details: {
        target: data.target,
        problem_type: data.problem_type,
        model_score: data.model_score,
        top_features: data.top_features.join(", "),
        drop_candidates: data.drop_candidates.join(", "),
        n_features: data.n_features,
        n_samples: data.n_samples,
      },
      suggestedQuestions: [
        "Which features should I keep for modeling?",
        "Are there any signs of data leakage?",
        "How can I improve the model score?",
      ],
    });
    return () => setPageContext(null);
  }, [data, setPageContext]);

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-full mx-auto">
        <Breadcrumb items={[
          { label: "Workspaces", href: "/workspaces" },
          { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
          { label: "Feature Importance" },
        ]} />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mt-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand" />
              Feature Importance
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Understand which features drive predictions — RF, Mutual Information, ANOVA, and Correlation
            </p>
          </div>

          {/* Target selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-gray-400" />
              <label className="text-xs font-semibold text-gray-600">Target column</label>
            </div>
            <select
              value={activeTarget}
              onChange={(e) => setTarget(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white min-w-[160px]"
            >
              {allCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {data && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                data.problem_type === "classification"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-cyan-100 text-cyan-700"
              )}>
                {data.problem_type}
              </span>
            )}
          </div>
        </div>

        {/* Warnings */}
        {data?.warnings && data.warnings.length > 0 && (
          <div className="space-y-2 mb-5">
            {data.warnings.map((w, i) => {
              const cfg = WARN_CFG[w.level] ?? WARN_CFG.info;
              return (
                <div key={i} className={cn("flex items-start gap-2.5 px-4 py-3 rounded-xl border text-xs", cfg.cls)}>
                  {cfg.icon}
                  <span className="leading-relaxed">{w.message}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading / error */}
        {!activeTarget ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
            <TrendingUp className="w-10 h-10" />
            <p className="text-sm">Select a target column above to run feature importance analysis</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[1,2,3,4].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
            <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Computing Random Forest + Mutual Information + ANOVA…
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-red-500">
            <AlertTriangle className="w-8 h-8" />
            <p className="text-sm font-semibold">Analysis failed</p>
            <p className="text-xs text-gray-400">{(error as Error).message}</p>
            <button onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:opacity-90">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        ) : data && data.feature_meta.length > 0 ? (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition",
                    activeTab === t.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === "overview"  && <OverviewTab  data={data} />}
            {activeTab === "rankings"  && <RankingsTab  data={data} />}
            {activeTab === "charts"    && <ChartsTab    data={data} />}
            {activeTab === "insights"  && <InsightsTab  data={data} />}
          </>
        ) : data?.error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-amber-500">
            <AlertTriangle className="w-8 h-8" />
            <p className="text-sm font-semibold">{data.error}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <TrendingUp className="w-10 h-10" />
            <p className="text-sm">No feature importance data available for this target.</p>
          </div>
        )}
      </div>
    </>
  );
}
