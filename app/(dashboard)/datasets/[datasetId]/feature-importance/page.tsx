"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, ScatterChart, Scatter, ZAxis, Legend,
} from "recharts";
import {
  TrendingUp, AlertTriangle, Info, CheckCircle2, XCircle,
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  Layers, Table2, BarChart2, Lightbulb, Target,
  RefreshCw, Zap, Shield, FlaskConical, Activity,
  Download, Copy, Eye, EyeOff, GitCompare, Sparkles,
  TriangleAlert, CheckCheck, ArrowUpDown, SlidersHorizontal,
  Network, Sigma, Cpu, Database,
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
  permutation_importance?: number | null;
  shap_value?: number | null;
  stability_score?: number | null;
  interaction_score?: number | null;
}

interface StabilityResult {
  feature: string;
  mean_importance: number;
  std_importance: number;
  cv: number;
  rank_stability: number;
}

interface InteractionPair {
  feature_a: string;
  feature_b: string;
  interaction_score: number;
  a_alone: number;
  b_alone: number;
  combined: number;
}

interface FIResult {
  target: string;
  problem_type: string;
  n_samples: number;
  n_features: number;
  model_score: number | null;
  cv_score_mean: number | null;
  cv_score_std: number | null;
  class_distribution: Record<string, { count: number; pct: number }> | null;
  importances: Array<{ feature: string; importance: number }>;
  permutation_importances: Array<{ feature: string; importance: number; std: number }>;
  mutual_info: Array<{ feature: string; score: number }>;
  correlations: Array<{ feature: string; correlation: number }>;
  anova: Array<{ feature: string; f_score: number }>;
  shap_values: Array<{ feature: string; mean_abs_shap: number }>;
  feature_meta: FeatureMeta[];
  stability: StabilityResult[];
  interactions: InteractionPair[];
  top_features: string[];
  drop_candidates: string[];
  warnings: Array<{ type: string; message: string; level: "danger" | "warning" | "info" }>;
  redundant_groups: Array<{ features: string[]; max_correlation: number }>;
  leakage_suspects: Array<{ feature: string; reason: string; severity: "high" | "medium" }>;
  error?: string;
  computed_methods?: string[];
}

type MethodLoadingState = {
  id: string;
  name: string;
  status: "pending" | "loading" | "done" | "error";
  progress: number;
  estimatedTime: number;
};


const FI_LIST_FIELDS = [
  "importances", "permutation_importances", "mutual_info",
  "correlations", "anova", "shap_values", "stability", "interactions",
] as const;

function mergeFIResult(prev: FIResult, next: FIResult): FIResult {
  const merged: FIResult = { ...prev, ...next };

  for (const key of FI_LIST_FIELDS) {
    if ((next[key]?.length ?? 0) === 0 && (prev[key]?.length ?? 0) > 0) {
      (merged[key] as unknown[]) = prev[key] as unknown[];
    }
  }

  const prevByFeature = new Map(prev.feature_meta.map((f) => [f.feature, f]));
  merged.feature_meta = next.feature_meta.map((f) => {
    const old = prevByFeature.get(f.feature);
    if (!old) return f;
    return {
      ...f,
      rf_importance: f.rf_importance ?? old.rf_importance,
      mi_score: f.mi_score ?? old.mi_score,
      correlation: f.correlation ?? old.correlation,
      anova_f: f.anova_f ?? old.anova_f,
      permutation_importance: f.permutation_importance ?? old.permutation_importance,
      shap_value: f.shap_value ?? old.shap_value,
      stability_score: f.stability_score ?? old.stability_score,
      interaction_score: f.interaction_score ?? old.interaction_score,
    };
  });

  merged.computed_methods = Array.from(
    new Set([...(prev.computed_methods ?? []), ...(next.computed_methods ?? [])])
  );

  return merged;
}

type Tab = "overview" | "rankings" | "charts" | "stability" | "interactions" | "insights";
type SortKey = "combined_rank" | "rf_importance" | "mi_score" | "correlation" | "anova_f" | "missing_pct" | "permutation_importance" | "shap_value" | "stability_score";
type SortDir = "asc" | "desc";
type ChartMethod = "rf" | "permutation" | "shap" | "mi" | "correlation" | "anova";
type VisMode = "bar" | "radar" | "scatter";

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND_PALETTE = [
  "#1D4ED8","#7C3AED","#0891B2","#059669",
  "#D97706","#DC2626","#DB2777","#2563EB",
  "#0D9488","#6366F1","#9333EA","#0284C7",
];

const REC_CONFIG = {
  keep_strong:   { label: "Strong",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800", dot: "bg-emerald-500" },
  keep:          { label: "Keep",         cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",          dot: "bg-blue-400"  },
  consider_drop: { label: "Weak",         cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",    dot: "bg-amber-400" },
  drop:          { label: "Drop",         cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800",              dot: "bg-red-400"   },
};

const WARN_CFG = {
  danger:  { cls: "bg-red-50 border-red-200 text-red-800",    icon: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" /> },
  warning: { cls: "bg-amber-50 border-amber-200 text-amber-800", icon: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" /> },
  info:    { cls: "bg-blue-50 border-blue-200 text-blue-800",  icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" /> },
};

const METHOD_CONFIG: Record<ChartMethod, { label: string; desc: string; color: string; icon: React.ReactNode; new?: boolean }> = {
  rf:          { label: "Random Forest",   desc: "Impurity-based feature importance from 100 trees", color: "#1D4ED8", icon: <Cpu className="w-3.5 h-3.5" /> },
  permutation: { label: "Permutation",     desc: "Feature shuffle impact on held-out performance",   color: "#7C3AED", icon: <ArrowUpDown className="w-3.5 h-3.5" />, new: true },
  shap:        { label: "SHAP Values",     desc: "Unified Shapley value attribution (model-agnostic)", color: "#059669", icon: <Sparkles className="w-3.5 h-3.5" />, new: true },
  mi:          { label: "Mutual Info",     desc: "Non-linear statistical dependency with target",    color: "#0891B2", icon: <Activity className="w-3.5 h-3.5" /> },
  correlation: { label: "Correlation",     desc: "Absolute Pearson r with the target variable",      color: "#D97706", icon: <Sigma className="w-3.5 h-3.5" /> },
  anova:       { label: "ANOVA F",         desc: "F-statistic testing group mean differences",       color: "#DC2626", icon: <FlaskConical className="w-3.5 h-3.5" /> },
};

function MethodLoadingIndicator({ loadingMethods, initialLoadTime }: { loadingMethods: MethodLoadingState[]; initialLoadTime: number }) {
  const allDone = loadingMethods.every(m => m.status === "done" || m.status === "error");
  const totalComplete = loadingMethods.filter(m => m.status === "done").length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-gray-600">Loading Additional Methods</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {totalComplete}/{loadingMethods.length} loaded
            {!allDone && (
              <span className="ml-2 inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Computing...
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {loadingMethods.map(method => (
          <div key={method.id} className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{method.name}</span>
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    method.status === "done"
                      ? "text-emerald-600"
                      : method.status === "error"
                      ? "text-red-600"
                      : method.status === "loading"
                      ? "text-blue-600"
                      : "text-gray-400"
                  )}
                >
                  {method.status === "done"
                    ? "✓ Done"
                    : method.status === "error"
                    ? "✗ Error"
                    : method.status === "loading"
                    ? `~${method.estimatedTime}s`
                    : "Pending"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    method.status === "done"
                      ? "bg-emerald-500"
                      : method.status === "error"
                      ? "bg-red-500"
                      : method.status === "loading"
                      ? "bg-blue-500"
                      : "bg-gray-300"
                  )}
                  style={{
                    width: method.status === "loading" ? "66%" : method.status === "done" ? "100%" : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!allDone && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
          <Zap className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Initial results loaded in ~{(initialLoadTime / 1000).toFixed(1)}s. Additional methods loading in background. Check back in a moment!
          </p>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(decimals);
}

function ScoreBar({ value, max, color, showValue = true }: { value: number; max: number; color: string; showValue?: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {showValue && <span className="text-xs tabular-nums text-gray-600 font-mono">{fmt(value, 4)}</span>}
    </div>
  );
}

function Badge({ rec }: { rec: FeatureMeta["recommendation"] }) {
  const cfg = REC_CONFIG[rec];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function DTypeChip({ dtype }: { dtype: string }) {
  const isNum = dtype.includes("int") || dtype.includes("float");
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold",
      isNum ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
    )}>
      {dtype.replace("64", "").replace("32", "")}
    </span>
  );
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 48, h = 16, pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScoreGauge({ value, max = 1, color, size = 48 }: { value: number; max?: number; color: string; size?: number }) {
  const pct = Math.min(value / max, 1);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { key: "overview",      label: "Overview",      icon: <Layers className="w-3.5 h-3.5" /> },
  { key: "rankings",      label: "Rankings",      icon: <Table2 className="w-3.5 h-3.5" /> },
  { key: "charts",        label: "Charts",        icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { key: "stability",     label: "Stability",     icon: <Shield className="w-3.5 h-3.5" />, badge: "New" },
  { key: "interactions",  label: "Interactions",  icon: <Network className="w-3.5 h-3.5" />, badge: "New" },
  { key: "insights",      label: "Insights",      icon: <Lightbulb className="w-3.5 h-3.5" /> },
];

// ── Model Score Card ──────────────────────────────────────────────────────────

function ModelScoreCard({ data }: { data: FIResult }) {
  const score = data.model_score ?? 0;
  const cvMean = data.cv_score_mean;
  const cvStd = data.cv_score_std;
  const metric = data.problem_type === "classification" ? "Accuracy" : "R²";
  const color = score > 0.85 ? "#059669" : score > 0.65 ? "#D97706" : "#DC2626";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
      <div className="relative flex-shrink-0">
        <ScoreGauge value={score} color={color} size={56} />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums" style={{ color }}>
          {(score * 100).toFixed(0)}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">RF OOB {metric}</p>
        <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color }}>
          {data.model_score != null ? `${(score * 100).toFixed(1)}%` : "—"}
        </p>
        {cvMean != null && (
          <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
            CV: {(cvMean * 100).toFixed(1)}% ± {cvStd != null ? (cvStd * 100).toFixed(1) : "?"}%
          </p>
        )}
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: FIResult }) {
    const leakageSuspects = data.leakage_suspects ?? [];  
  const redundantGroups = data.redundant_groups ?? []; 
const featureMeta = data.feature_meta ?? [];
const topMeta = featureMeta.slice(0, 8);
const importances = data.importances ?? [];

const maxRF = Math.max(
  ...importances.map(i => i.importance),
  0.0001
);
const shapValues = data.shap_values ?? [];

const maxSHAP = shapValues.length
  ? Math.max(...shapValues.map(s => s.mean_abs_shap), 0.0001)
  : 0;
  return (
    <div className="space-y-6">
      {/* Leakage alert */}
      {leakageSuspects.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex gap-3">
          <Zap className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">Possible Data Leakage Detected</p>
            <div className="mt-1.5 space-y-1">
              {leakageSuspects.map(s => (
                <div key={s.feature} className="flex items-start gap-2">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 mt-0.5",
                    s.severity === "high" ? "bg-red-200 text-red-700" : "bg-amber-100 text-amber-700"
                  )}>{s.severity}</span>
                  <span className="text-xs text-red-700"><span className="font-mono">{s.feature}</span> — {s.reason}</span>
                </div>
              ))}
            </div>
            <AskAiButton
              question={`I found possible data leakage in features: ${leakageSuspects.map(s => s.feature).join(", ")}. How do I verify and fix this before training?`}
              label="How to fix leakage?"
              variant="chip"
            />
          </div>
        </div>
      )}

      {/* Redundant feature groups */}
      {redundantGroups.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <GitCompare className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              {redundantGroups.length} Redundant Feature Group{redundantGroups.length > 1 ? "s" : ""} (high inter-correlation)
            </p>
            <div className="flex flex-wrap gap-2">
              {redundantGroups.slice(0, 4).map((g, i) => (
                <div key={i} className="flex items-center gap-1 bg-white border border-amber-200 rounded-lg px-2 py-1">
                  {g.features.map((f, j) => (
                    <span key={f} className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-amber-700">{f}</span>
                      {j < g.features.length - 1 && <span className="text-amber-300 text-[10px]">↔</span>}
                    </span>
                  ))}
                  <span className="ml-1 text-[9px] text-amber-500 font-semibold">r={g.max_correlation.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ModelScoreCard data={data} />
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
            sub: `${data.drop_candidates.length} weak · ${leakageSuspects.length} leaky`,
            color: "#1D4ED8",
          },
          {
            label: "Top Feature",
            value: data.top_features[0] ?? "—",
            sub: (data.shap_values ?? [])[0]
              ? `SHAP: ${fmt((data.shap_values ?? [])[0].mean_abs_shap, 3)}`
              : (data.importances ?? [])[0]
              ? `RF: ${fmt((data.importances ?? [])[0].importance, 3)}`
              : "",
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
        {/* Top features — RF vs SHAP comparison */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Top Features</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">RF importance vs SHAP</p>
            </div>
            <AskAiButton
              question={`The top features are: ${data.top_features.slice(0, 5).join(", ")}. Explain why these might be important predictors for ${data.target}.`}
              label="Explain"
              variant="chip"
            />
          </div>
          <div className="space-y-3">
            {topMeta.map((fm, i) => {
              const rfImp = fm.rf_importance ?? 0;
              const rfPct = maxRF > 0 ? (rfImp / maxRF) * 100 : 0;
              const shapImp = fm.shap_value ?? 0;
              const shapPct = maxSHAP > 0 ? (shapImp / maxSHAP) * 100 : 0;
              return (
                <div key={fm.feature} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-300 w-4 flex-shrink-0 tabular-nums">{i + 1}</span>
                  <span className="font-mono text-xs text-gray-700 truncate w-28 flex-shrink-0" title={fm.feature}>
                    {fm.feature}
                  </span>
                  <div className="flex-1 space-y-0.5">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${rfPct}%`, backgroundColor: BRAND_PALETTE[i % BRAND_PALETTE.length] }} />
                    </div>
                    {maxSHAP > 0 && (
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden opacity-60">
                        <div className="h-full rounded-full" style={{ width: `${shapPct}%`, backgroundColor: "#059669" }} />
                      </div>
                    )}
                  </div>
                  <Badge rec={fm.recommendation} />
                </div>
              );
            })}
          </div>
          {maxSHAP > 0 && (
            <div className="flex gap-3 mt-3">
              <span className="flex items-center gap-1 text-[9px] text-gray-400">
                <span className="w-2.5 h-1.5 rounded-sm bg-blue-500" />RF
              </span>
              <span className="flex items-center gap-1 text-[9px] text-gray-400">
                <span className="w-2.5 h-1 rounded-sm bg-emerald-500" />SHAP
              </span>
            </div>
          )}
        </div>

        {/* Class distribution or correlation */}
        {data.class_distribution ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-1">
              Target Distribution
              <span className="ml-2 font-mono text-xs font-normal text-gray-400">{data.target}</span>
            </h3>
            <p className="text-[10px] text-gray-400 mb-4">{Object.keys(data.class_distribution).length} classes</p>
            <div className="space-y-2">
              {Object.entries(data.class_distribution).map(([cls, stats], i) => (
                <div key={cls} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24 truncate flex-shrink-0 font-mono" title={cls}>{cls}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${stats.pct}%`, backgroundColor: BRAND_PALETTE[i % BRAND_PALETTE.length] }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-500 w-24 text-right flex-shrink-0">
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
              {(data.correlations ?? []).slice(0, 8).map((item, i) => {
                const abs = Math.abs(item.correlation);
                const isPos = item.correlation >= 0;
                return (
                  <div key={item.feature} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-600 w-28 truncate flex-shrink-0">{item.feature}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${abs * 100}%`, backgroundColor: isPos ? "#1D4ED8" : "#DC2626" }} />
                    </div>
                    <span className={cn("text-[10px] tabular-nums w-14 text-right flex-shrink-0 font-semibold", isPos ? "text-blue-600" : "text-red-600")}>
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
          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
            {data.drop_candidates.map(f => (
              <span key={f} className="px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-mono text-amber-700">{f}</span>
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
  const [hideDrop, setHideDrop] = useState(false);
  const [selectedRec, setSelectedRec] = useState<string>("all");

  const maxRF   = useMemo(() => Math.max(...data.feature_meta.map(f => f.rf_importance ?? 0), 0.0001), [data]);
  const maxMI   = useMemo(() => Math.max(...data.feature_meta.map(f => f.mi_score ?? 0), 0.0001), [data]);
  const maxAnova= useMemo(() => Math.max(...data.feature_meta.map(f => f.anova_f ?? 0), 0.0001), [data]);
const featureMeta = data.feature_meta ?? [];

const maxPerm = useMemo(() =>
  Math.max(...featureMeta.map(f => f.permutation_importance ?? 0), 0.0001),
[featureMeta]); 
 const maxShap = useMemo(() => Math.max(...data.feature_meta.map(f => f.shap_value ?? 0), 0.0001), [data]);

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = data.feature_meta.filter(f => !q || f.feature.toLowerCase().includes(q));
    if (hideDrop) filtered = filtered.filter(f => f.recommendation !== "drop");
    if (selectedRec !== "all") filtered = filtered.filter(f => f.recommendation === selectedRec);
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? (sortKey === "combined_rank" ? 9999 : -1);
      const bv = (b[sortKey] as number | null) ?? (sortKey === "combined_rank" ? 9999 : -1);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data.feature_meta, search, sortKey, sortDir, hideDrop, selectedRec]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "combined_rank" ? "asc" : "desc"); }
  }, [sortKey]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-blue-600" />
      : <ChevronDown className="w-3 h-3 text-blue-600" />;
  }

  const TH = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 transition whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      <span className="flex items-center gap-1">{label}<SortIcon col={col} /></span>
    </th>
  );

  const exportCSV = () => {
    const header = "Feature,RF Importance,Permutation,SHAP,Mutual Info,ANOVA F,Correlation,Missing %,Unique,Type,Status";
    const rows = sorted.map(f =>
      [f.feature, f.rf_importance ?? "", f.permutation_importance ?? "", f.shap_value ?? "",
       f.mi_score ?? "", f.anova_f ?? "", f.correlation ?? "",
       f.missing_pct, f.unique_count, f.dtype, f.recommendation].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `feature_importance_${data.target}.csv`; a.click();
  };

  const recCounts = useMemo(() => {
    const c: Record<string, number> = { all: data.feature_meta.length };
    data.feature_meta.forEach(f => { c[f.recommendation] = (c[f.recommendation] ?? 0) + 1; });
    return c;
  }, [data]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter features…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Rec filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "keep_strong", "keep", "consider_drop", "drop"] as const).map(rec => (
            <button
              key={rec}
              onClick={() => setSelectedRec(rec)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-semibold border transition",
                selectedRec === rec
                  ? "bg-gray-900 text-white border-gray-900"
                  : "text-gray-500 border-gray-200 hover:border-gray-400"
              )}
            >
              {rec === "all" ? "All" : REC_CONFIG[rec].label} ({recCounts[rec] ?? 0})
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={hideDrop} onChange={e => setHideDrop(e.target.checked)} className="rounded" />
          Hide drop
        </label>

        <span className="text-xs text-gray-400 tabular-nums ml-auto">{sorted.length}/{data.feature_meta.length}</span>

        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>

        <AskAiButton
          question={`Feature importance rankings for target "${data.target}". Which features should I definitely keep and which ones can I drop?`}
          label="Get recommendation"
          variant="chip"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Feature</th>
                <TH col="rf_importance"        label="RF" />
                <TH col="permutation_importance" label="Perm." />
                <TH col="shap_value"           label="SHAP" />
                <TH col="mi_score"             label="MI" />
                <TH col="anova_f"              label="ANOVA" />
                <TH col="correlation"          label="Corr." />
                <TH col="missing_pct"          label="Missing" />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((fm, idx) => (
                <tr key={fm.feature} className={cn(
                  "border-b border-gray-50 hover:bg-blue-50/30 transition-colors",
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/40",
                  fm.recommendation === "drop" && "opacity-50"
                )}>
                  <td className="px-3 py-2 text-gray-300 tabular-nums font-mono text-[10px]">{idx + 1}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-gray-800 max-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      {(data.leakage_suspects ?? []).find(s => s.feature === fm.feature) && (
                        <span title="Possible leakage">
                          <Zap className="w-3 h-3 text-red-500 flex-shrink-0" />
                        </span>
                      )}
                      <span className="truncate" title={fm.feature}>{fm.feature}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {fm.rf_importance != null
                      ? <ScoreBar value={fm.rf_importance} max={maxRF} color="#1D4ED8" />
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {fm.permutation_importance != null
                      ? <ScoreBar value={Math.max(fm.permutation_importance, 0)} max={maxPerm} color="#7C3AED" />
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {fm.shap_value != null
                      ? <ScoreBar value={fm.shap_value} max={maxShap} color="#059669" />
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {fm.mi_score != null
                      ? <ScoreBar value={fm.mi_score} max={maxMI} color="#0891B2" />
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {fm.anova_f != null
                      ? <ScoreBar value={fm.anova_f} max={maxAnova} color="#DC2626" />
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
                  <td className="px-3 py-2"><DTypeChip dtype={fm.dtype} /></td>
                  <td className="px-3 py-2"><Badge rec={fm.recommendation} /></td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-sm text-gray-400">No features match your filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Charts Tab ────────────────────────────────────────────────────────────────

function ChartsTab({ data }: { data: FIResult }) {
  const [method, setMethod] = useState<ChartMethod>("rf");
  const [visMode, setVisMode] = useState<VisMode>("bar");
  const [topN, setTopN] = useState(20);

  const chartData = useMemo(() => {
    const raw = (() => {
      switch (method) {
        case "rf":          return data.importances.map(d => ({ name: d.feature, value: d.importance }));
        case "permutation":   return (data.permutation_importances ?? []).map(d => ({ name: d.feature, value: d.importance, std: d.std }));
        case "shap":        return (data.shap_values ?? []).map(d => ({ name: d.feature, value: d.mean_abs_shap }));
        case "mi":          return (data.mutual_info ?? []).map(d => ({ name: d.feature, value: d.score }));
        case "correlation": return (data.correlations ?? []).map(d => ({ name: d.feature, value: Math.abs(d.correlation), raw: d.correlation }));
        case "anova":       return (data.anova ?? []).map(d => ({ name: d.feature, value: d.f_score }));
        default:            return [];
      }
    })();
    return raw.slice(0, topN).map((d, i) => ({ ...d, idx: i }));
  }, [data, method, topN]);

  // Build radar data from top 10 features across all methods
  const radarData = useMemo(() => {
    const top10 = data.feature_meta.slice(0, 10);
    const maxRF    = Math.max(...data.feature_meta.map(x => x.rf_importance ?? 0), 0.0001);
    const maxMI    = Math.max(...data.feature_meta.map(x => x.mi_score ?? 0), 0.0001);
    const maxAnova = Math.max(...data.feature_meta.map(x => x.anova_f ?? 0), 0.0001);
    const maxPerm  = Math.max(...data.feature_meta.map(x => x.permutation_importance ?? 0), 0.0001);
    const maxShap  = Math.max(...data.feature_meta.map(x => x.shap_value ?? 0), 0.0001);
    return top10.slice(0, 6).map(f => ({
      feature: f.feature.length > 12 ? f.feature.slice(0, 12) + "…" : f.feature,
      RF:   parseFloat(((f.rf_importance ?? 0) / maxRF * 100).toFixed(1)),
      SHAP: parseFloat(((f.shap_value ?? 0) / maxShap * 100).toFixed(1)),
      MI:   parseFloat(((f.mi_score ?? 0) / maxMI * 100).toFixed(1)),
      ANOVA: parseFloat(((f.anova_f ?? 0) / maxAnova * 100).toFixed(1)),
      Perm: parseFloat(((Math.max(f.permutation_importance ?? 0, 0)) / maxPerm * 100).toFixed(1)),
    }));
  }, [data]);

  const active = METHOD_CONFIG[method];
  const chartHeight = Math.max(300, chartData.length * 28);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-xs shadow-sm">
        <p className="font-mono font-semibold text-gray-800 mb-1">{d.name}</p>
        <p className="text-gray-600">{active.label}: <span className="font-mono font-semibold" style={{ color: active.color }}>{Number(d.value).toFixed(6)}</span></p>
        {d.std != null && <p className="text-gray-400">±{Number(d.std).toFixed(6)}</p>}
        {method === "correlation" && d.raw != null && (
          <p className="text-gray-400">raw r = {Number(d.raw).toFixed(4)}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Method selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-600">Importance Method</p>
          <div className="flex gap-1">
            {(["bar", "radar"] as const).map(m => (
              <button
                key={m}
                onClick={() => setVisMode(m)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition",
                  visMode === m ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:border-gray-400"
                )}
              >
                {m === "bar" ? "Bar" : "Radar"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {(Object.entries(METHOD_CONFIG) as [ChartMethod, typeof METHOD_CONFIG[ChartMethod]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setMethod(key)}
              className={cn(
                "text-left px-3 py-2.5 rounded-lg border text-xs transition",
                method === key
                  ? "border-current shadow-sm text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              )}
              style={method === key ? { backgroundColor: cfg.color, borderColor: cfg.color } : {}}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span style={method === key ? { color: "rgba(255,255,255,0.9)" } : { color: cfg.color }}>{cfg.icon}</span>
                {cfg.new && (
                  <span className={cn("text-[8px] font-bold px-1 rounded", method === key ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700")}>
                    NEW
                  </span>
                )}
              </div>
              <p className="font-semibold text-[11px]">{cfg.label}</p>
              <p className={cn("mt-0.5 text-[9px] leading-tight", method === key ? "text-white/70" : "text-gray-400")}>
                {cfg.desc.slice(0, 38)}…
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Top N slider */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs text-gray-500 flex-shrink-0">Show top</span>
        <input type="range" min={5} max={Math.min(data.n_features, 30)} value={topN}
          onChange={e => setTopN(Number(e.target.value))} className="flex-1 max-w-xs" />
        <span className="text-xs font-semibold text-gray-700 w-8 tabular-nums">{topN}</span>
        <span className="text-xs text-gray-400">features</span>
      </div>

      {/* Chart */}
      {visMode === "bar" ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span style={{ color: active.color }}>{active.icon}</span>
                {active.label} — Feature Scores
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{active.desc}</p>
            </div>
            <AskAiButton
              question={`Looking at the ${active.label} feature importance scores for target "${data.target}", which features stand out and why?`}
              label="Explain scores"
              variant="chip"
            />
          </div>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">No data available for this method.</div>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 80, bottom: 4, left: 150 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category" dataKey="name"
                  tick={{ fontSize: 10, fontFamily: "monospace" }}
                  tickLine={false} axisLine={false} width={145}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={`${active.color}${Math.round(255 - i * (130 / Math.max(chartData.length, 1))).toString(16).padStart(2, "0")}`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        /* Radar */
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800">All-Method Radar — Top 6 Features</h3>
              <p className="text-xs text-gray-400 mt-0.5">Normalised 0–100 across RF, SHAP, MI, ANOVA, Permutation</p>
            </div>
            <AskAiButton
              question={`Compare the top features across all importance methods for target "${data.target}". Which features are consistently important?`}
              label="Compare methods"
              variant="chip"
            />
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="feature" tick={{ fontSize: 10, fontFamily: "monospace" }} />
              <Radar name="RF"   dataKey="RF"   stroke="#1D4ED8" fill="#1D4ED8" fillOpacity={0.08} strokeWidth={1.5} />
              <Radar name="SHAP" dataKey="SHAP" stroke="#059669" fill="#059669" fillOpacity={0.08} strokeWidth={1.5} />
              <Radar name="MI"   dataKey="MI"   stroke="#0891B2" fill="#0891B2" fillOpacity={0.08} strokeWidth={1.5} />
              <Radar name="Perm" dataKey="Perm" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.08} strokeWidth={1.5} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* All-method comparison mini-grid */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-1">6-Method Comparison</h3>
        <p className="text-xs text-gray-400 mb-4">Top 12 features across all methods (normalised 0–1 per method)</p>
        <div className="space-y-2">
          {data.feature_meta.slice(0, 12).map(fm => {
            const rfN  = fm.rf_importance  != null ? fm.rf_importance  / Math.max(...data.feature_meta.map(x => x.rf_importance  ?? 0), 0.0001) : 0;
            const miN  = fm.mi_score       != null ? fm.mi_score       / Math.max(...data.feature_meta.map(x => x.mi_score       ?? 0), 0.0001) : 0;
            const anN  = fm.anova_f        != null ? fm.anova_f        / Math.max(...data.feature_meta.map(x => x.anova_f        ?? 0), 0.0001) : 0;
            const crN  = fm.correlation    != null ? Math.abs(fm.correlation) / Math.max(...data.feature_meta.map(x => Math.abs(x.correlation ?? 0)), 0.0001) : 0;
            const pmN  = fm.permutation_importance != null && fm.permutation_importance > 0
              ? fm.permutation_importance / Math.max(...data.feature_meta.map(x => Math.max(x.permutation_importance ?? 0, 0)), 0.0001) : 0;
            const shN  = fm.shap_value     != null ? fm.shap_value     / Math.max(...data.feature_meta.map(x => x.shap_value ?? 0), 0.0001) : 0;
            const total = rfN + miN + anN + crN + pmN + shN;
            const segW = (v: number) => `${(v / 6) * 100}%`;
            return (
              <div key={fm.feature} className="flex items-center gap-3">
                <span className="font-mono text-xs text-gray-700 w-28 truncate flex-shrink-0">{fm.feature}</span>
                <div className="flex-1 flex h-3 rounded overflow-hidden gap-px bg-gray-100">
                  {[
                    { v: rfN, c: "#1D4ED8" }, { v: pmN, c: "#7C3AED" },
                    { v: shN, c: "#059669" }, { v: miN, c: "#0891B2" },
                    { v: anN, c: "#DC2626" }, { v: crN, c: "#D97706" },
                  ].map(({ v, c }, j) => (
                    <div key={j} style={{ width: `calc(${segW(v)} - 1px)`, backgroundColor: v > 0.01 ? c : "transparent" }}
                      className="transition-all duration-500" title={`${(v * 100).toFixed(0)}%`} />
                  ))}
                </div>
                <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">{(total / 6 * 100).toFixed(0)}%</span>
                <Badge rec={fm.recommendation} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 flex-wrap">
          {[["#1D4ED8","RF"], ["#7C3AED","Perm"], ["#059669","SHAP"], ["#0891B2","MI"], ["#DC2626","ANOVA"], ["#D97706","|r|"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c }} />{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Stability Tab ─────────────────────────────────────────────────────────────

function StabilityTab({ data }: { data: FIResult }) {
  if (!data.stability || data.stability.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
        <Shield className="w-10 h-10" />
        <p className="text-sm">Stability analysis not available for this dataset.</p>
        <p className="text-xs text-gray-300">Requires at least 50 samples.</p>
      </div>
    );
  }

  const maxMean = Math.max(...data.stability.map(s => s.mean_importance), 0.0001);

  return (
    <div className="space-y-5">
      {/* What is stability */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">What is Stability?</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            Stability measures how consistently a feature's importance ranks across 10 bootstrap samples.
            A CV (coefficient of variation) near 0 means the feature's importance is reliable;
            a high CV means it fluctuates — potentially unreliable for production use.
          </p>
          <AskAiButton
            question={`Explain feature stability in the context of predicting ${data.target}. Which unstable features should I be cautious about?`}
            label="Explain stability"
            variant="chip"
          />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Stable Features",
            value: data.stability.filter(s => s.cv < 0.3).length,
            sub: "CV < 0.3",
            color: "#059669",
          },
          {
            label: "Unstable Features",
            value: data.stability.filter(s => s.cv >= 0.5).length,
            sub: "CV ≥ 0.5",
            color: "#DC2626",
          },
          {
            label: "Avg CV",
            value: (data.stability.reduce((s, x) => s + x.cv, 0) / data.stability.length).toFixed(2),
            sub: "Lower is better",
            color: "#1D4ED8",
          },
          {
            label: "Most Stable",
            value: data.stability.sort((a, b) => a.cv - b.cv)[0]?.feature ?? "—",
            sub: `CV: ${data.stability.sort((a, b) => a.cv - b.cv)[0]?.cv.toFixed(3) ?? "—"}`,
            color: "#059669",
            mono: true,
          },
        ].map(({ label, value, sub, color, mono }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={cn("text-lg font-bold truncate", mono && "font-mono text-sm")} style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Stability table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Bootstrap Stability Rankings</h3>
          <p className="text-xs text-gray-400 mt-0.5">Sorted by coefficient of variation (CV = std/mean)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {["Feature", "Mean Importance", "Std Dev", "CV", "Rank Stability", "Verdict"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.stability].sort((a, b) => a.cv - b.cv).map((s, idx) => {
                const isStable = s.cv < 0.3;
                const isUnstable = s.cv >= 0.5;
                return (
                  <tr key={s.feature} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{s.feature}</td>
                    <td className="px-4 py-2.5">
                      <ScoreBar value={s.mean_importance} max={maxMean} color="#1D4ED8" />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-500 font-mono text-[10px]">{s.std_importance.toFixed(4)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "font-mono font-bold tabular-nums",
                        isStable ? "text-emerald-600" : isUnstable ? "text-red-600" : "text-amber-600"
                      )}>
                        {s.cv.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.rank_stability * 100}%`, backgroundColor: s.rank_stability > 0.8 ? "#059669" : "#D97706" }} />
                        </div>
                        <span className="tabular-nums text-[10px] text-gray-500">{(s.rank_stability * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        isStable ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        isUnstable ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {isStable ? "Stable" : isUnstable ? "Unstable" : "Moderate"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Interactions Tab ──────────────────────────────────────────────────────────

function InteractionsTab({ data }: { data: FIResult }) {
  if (!data.interactions || data.interactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
        <Network className="w-10 h-10" />
        <p className="text-sm">Feature interaction analysis not available.</p>
        <p className="text-xs text-gray-300">Requires at least 3 features and 100 samples.</p>
      </div>
    );
  }

  const top = [...data.interactions].sort((a, b) => b.interaction_score - a.interaction_score).slice(0, 15);
  const maxScore = Math.max(...top.map(t => t.interaction_score), 0.0001);

  // Build matrix data
  const features = Array.from(new Set(top.flatMap(t => [t.feature_a, t.feature_b]))).slice(0, 8);
  const matrixMap: Record<string, number> = {};
        (data.interactions ?? []).forEach(t => {
    matrixMap[`${t.feature_a}|${t.feature_b}`] = t.interaction_score;
    matrixMap[`${t.feature_b}|${t.feature_a}`] = t.interaction_score;
  });

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">What are Feature Interactions?</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            Interaction score measures how much more predictive two features are <em>together</em> compared to each individually.
            High interaction = synergy. Pairs with high combined importance but low individual importance may benefit from an engineered cross-feature.
          </p>
          <AskAiButton
            question={`For target "${data.target}", which feature interactions are most synergistic and should I engineer cross-features from them?`}
            label="Should I engineer features?"
            variant="chip"
          />
        </div>
      </div>

      {/* Top interaction pairs */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Top Interaction Pairs</h3>
        <div className="space-y-3">
          {top.map((pair, i) => {
            const pct = (pair.interaction_score / maxScore) * 100;
            const synergy = pair.combined - pair.a_alone - pair.b_alone;
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-blue-50/50 transition-colors">
                <span className="text-[10px] font-bold text-gray-300 w-4 flex-shrink-0 mt-1 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-gray-800 bg-blue-100 px-2 py-0.5 rounded">{pair.feature_a}</span>
                    <span className="text-gray-400 text-xs">×</span>
                    <span className="font-mono text-xs font-semibold text-gray-800 bg-purple-100 px-2 py-0.5 rounded">{pair.feature_b}</span>
                    {synergy > 0.01 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                        +{(synergy * 100).toFixed(1)}% synergy
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 tabular-nums">{pair.interaction_score.toFixed(4)}</span>
                  </div>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[10px] text-gray-400">{pair.feature_a}: {pair.a_alone.toFixed(3)}</span>
                    <span className="text-[10px] text-gray-400">{pair.feature_b}: {pair.b_alone.toFixed(3)}</span>
                    <span className="text-[10px] text-gray-600 font-semibold">Combined: {pair.combined.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interaction heatmap */}
      {features.length >= 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Interaction Matrix (top {features.length} features)</h3>
          <div className="overflow-x-auto">
            <table className="text-[10px] font-mono">
              <thead>
                <tr>
                  <th className="w-28" />
                  {features.map(f => (
                    <th key={f} className="pb-2 text-gray-500 font-normal text-center rotate-45 origin-bottom-left" style={{ minWidth: 56 }}>
                      <span className="block truncate max-w-[52px]" title={f}>{f.length > 7 ? f.slice(0, 7) + "…" : f}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map(fa => (
                  <tr key={fa}>
                    <td className="pr-2 text-gray-600 text-right truncate max-w-[100px] py-0.5">{fa}</td>
                    {features.map(fb => {
                      const score = matrixMap[`${fa}|${fb}`] ?? (fa === fb ? null : 0);
                      const pct = score != null && maxScore > 0 ? score / maxScore : 0;
                      return (
                        <td key={fb} className="px-0.5 py-0.5">
                          <div
                            className="w-12 h-8 rounded flex items-center justify-center text-[9px] font-bold"
                            style={{
                              backgroundColor: fa === fb ? "#F3F4F6" :
                                score != null && score > 0 ? `rgba(29, 78, 216, ${0.1 + pct * 0.7})` : "#F9FAFB",
                              color: pct > 0.5 ? "white" : "#374151",
                            }}
                          >
                            {fa === fb ? "—" : score != null ? score.toFixed(2) : "0"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-3">Darker = stronger interaction. Diagonal = self (n/a).</p>
        </div>
      )}
    </div>
  );
}

// ── Insights Tab ──────────────────────────────────────────────────────────────

function InsightsTab({ data }: { data: FIResult }) {
  const insights = useMemo(() => {
    const items: Array<{ level: "success" | "warning" | "danger" | "info"; title: string; body: string }> = [];

    if (data.model_score != null) {
      const score = data.model_score;
      const cvM = data.cv_score_mean;
      const metric = data.problem_type === "classification" ? "OOB accuracy" : "OOB R²";
      if (score > 0.85) {
        items.push({ level: "success", title: "Strong predictive signal", body: `${metric} = ${(score * 100).toFixed(1)}%${cvM != null ? `, CV: ${(cvM * 100).toFixed(1)}%` : ""}. Features collectively predict ${data.target} very well.` });
      } else if (score > 0.65) {
        items.push({ level: "info", title: "Moderate predictive signal", body: `${metric} = ${(score * 100).toFixed(1)}%. Reasonable signal — feature engineering or more data may help.` });
      } else {
        items.push({ level: "warning", title: "Low predictive signal", body: `${metric} = ${(score * 100).toFixed(1)}%. Consider adding domain-relevant columns or transforming existing ones.` });
      }
    }

    if ((data.leakage_suspects ?? []).length > 0) {
      const high = (data.leakage_suspects ?? []).filter(s => s.severity === "high");
      items.push({ level: "danger", title: `${(data.leakage_suspects ?? []).length} possible leakage suspect(s)`, body: `${high.length > 0 ? `High-risk: ${high.map(s => s.feature).join(", ")}. ` : ""}These features may cause inflated scores in testing but fail in production. Verify carefully.` });
    }

    if (data.importances.length >= 2) {
      const top = data.importances[0].importance;
      const total = data.importances.reduce((s, x) => s + x.importance, 0);
      const topShare = top / total;
      if (topShare > 0.5) {
        items.push({ level: "warning", title: `"${data.importances[0].feature}" dominates (${(topShare * 100).toFixed(1)}%)`, body: "One feature explains the majority of RF variance. This may indicate leakage or a trivially predictive column. Validate with held-out data." });
      }
    }

    const agreed = data.feature_meta.filter(f => {
      const hasRF = f.rf_importance != null && f.rf_importance > 0.01;
      const hasMI = f.mi_score != null && f.mi_score > 0.01;
      const hasSHAP = f.shap_value != null && f.shap_value > 0.001;
      return (hasRF && hasMI) || (hasRF && hasSHAP) || (hasMI && hasSHAP);
    }).filter(f => f.recommendation === "keep_strong");
    if (agreed.length > 0) {
      items.push({ level: "success", title: `${agreed.length} feature(s) confirmed important by multiple methods`, body: `${agreed.slice(0, 4).map(f => f.feature).join(", ")}${agreed.length > 4 ? "…" : ""} — high confidence, prioritise in model.` });
    }

    if ((data.redundant_groups ?? []).length > 0) {
      const allRedundant = (data.redundant_groups ?? []).flatMap(g => g.features);
      items.push({ level: "warning", title: `${(data.redundant_groups ?? []).length} redundant feature group(s) detected`, body: `${allRedundant.slice(0, 4).join(", ")} are highly correlated with each other. Keep the best one per group; drop the rest to reduce multicollinearity.` });
    }

    if (data.drop_candidates.length > 0) {
      const pct = Math.round((data.drop_candidates.length / data.n_features) * 100);
      items.push({ level: "warning", title: `${data.drop_candidates.length} features (${pct}%) score near-zero on all methods`, body: `Dropping ${data.drop_candidates.slice(0, 3).join(", ")}${data.drop_candidates.length > 3 ? "…" : ""} may simplify without sacrificing accuracy. Validate first.` });
    }

    const highMissing = data.feature_meta.filter(f => f.missing_pct > 20);
    if (highMissing.length > 0) {
      items.push({ level: "warning", title: `${highMissing.length} feature(s) have >20% missing values`, body: `${highMissing.slice(0, 3).map(f => `${f.feature} (${f.missing_pct.toFixed(1)}%)`).join(", ")}. Use median/KNN/model-based imputation before training.` });
    }

    if (data.problem_type === "classification" && data.class_distribution) {
      const dominant = Math.max(...Object.values(data.class_distribution).map(v => v.pct));
      if (dominant > 75) {
        items.push({ level: "danger", title: "Severe class imbalance", body: `Dominant class = ${dominant.toFixed(1)}%. Use stratified K-fold, SMOTE, class_weight="balanced", or AUC/F1 metrics instead of accuracy.` });
      }
    }

    if (data.stability?.filter(s => s.cv >= 0.5).length > 0) {
      const unstable = data.stability.filter(s => s.cv >= 0.5);
      items.push({ level: "warning", title: `${unstable.length} feature(s) have unstable importance (CV ≥ 0.5)`, body: `${unstable.slice(0, 3).map(s => s.feature).join(", ")} fluctuate significantly across bootstrap samples. Be cautious relying on these for production feature selection.` });
    }

    if (data.interactions?.length > 0) {
      const topPair = [...data.interactions].sort((a, b) => b.interaction_score - a.interaction_score)[0];
      const synergy = topPair.combined - topPair.a_alone - topPair.b_alone;
      if (synergy > 0.05) {
        items.push({ level: "info", title: `Feature engineering opportunity: ${topPair.feature_a} × ${topPair.feature_b}`, body: `These two features together provide ${(synergy * 100).toFixed(1)}% more predictive power than individually. Consider creating an interaction feature (product, ratio, or concatenation).` });
      }
    }

    const ratio = data.n_features / Math.max(data.n_samples, 1);
    if (ratio > 0.1) {
      items.push({ level: "warning", title: "High feature-to-sample ratio", body: `${data.n_features} features / ${data.n_samples} rows (${(ratio * 100).toFixed(1)}%). Risk of overfitting. Use L1/L2 regularisation or aggressive feature selection.` });
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400">{insights.length} auto-generated insights based on all methods</p>
        <AskAiButton
          question={`Based on the feature importance analysis for target "${data.target}" (problem type: ${data.problem_type}, OOB score: ${data.model_score != null ? (data.model_score * 100).toFixed(1) + "%" : "N/A"}, top features: ${data.top_features.slice(0, 3).join(", ")}, leakage suspects: ${(data.leakage_suspects ?? []).map(s => s.feature).join(", ") || "none"}, redundant groups: ${(data.redundant_groups ?? []).length}), give me a comprehensive feature selection strategy with code examples.`}
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
          <Target className="w-4 h-4 text-blue-600" />
          Feature Selection Checklist
        </h3>
        <div className="space-y-2.5">
          {[
            { done: data.top_features.length > 0,                                   text: `Identify strong predictors: ${data.top_features.slice(0, 3).join(", ") || "—"}` },
            { done: data.drop_candidates.length > 0,                                text: `Remove low-importance features (${data.drop_candidates.length} candidates found)` },
            { done: data.model_score != null,                                        text: `Baseline score established: ${data.model_score != null ? (data.model_score * 100).toFixed(1) + "%" : "run model"}` },
            { done: (data.leakage_suspects ?? []).length === 0, text: `Verify no data leakage (${(data.leakage_suspects ?? []).length} suspects found)` },
            { done: (data.redundant_groups ?? []).length === 0, text: `Resolve redundant feature groups (${(data.redundant_groups ?? []).length} found)` },
            { done: data.feature_meta.every(f => f.missing_pct < 5),               text: "Handle missing values in features" },
            { done: data.stability?.length > 0 && data.stability.every(s => s.cv < 0.5), text: "Verify feature importance stability across samples" },
            { done: false,                                                           text: "Validate selected features with cross-validation" },
            { done: false,                                                           text: "Test model performance with and without weak features" },
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
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const setPageContext = useAiContextStore(s => s.setPageContext);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const targetCol  = searchParams.get("target") ?? "";

  // ── NEW: State for progressive data loading ────────────────────────────────
  const [progressiveData, setProgressiveData] = useState<FIResult | null>(null);
  const [loadingMethods, setLoadingMethods] = useState<MethodLoadingState[]>([]);
  const loadingRef = useRef<NodeJS.Timeout | null>(null);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then(r => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then(r => r.data),
  });

  const allCols: string[] = useMemo(
    () => profile?.columns.map((c: { name: string }) => c.name) ?? [],
    [profile]
  );
  const activeTarget = targetCol || allCols[allCols.length - 1] || "";

  const { data: initialData, isLoading: initialLoading, error: initialError } = useQuery({
    queryKey: queryKeys.eda.featureImportance(datasetId, activeTarget),
    queryFn: async () => {
      const startTime = performance.now();
      const response = await datasetsApi.getFeatureImportance(datasetId, activeTarget, "rf");
      const loadTime = performance.now() - startTime;
      return { ...response.data, _initialLoadTime: loadTime };
    },
    enabled: !!activeTarget,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (!initialData || !activeTarget) return;

    setProgressiveData(initialData as FIResult);

    // Initialize loading methods
    const methodLoadOrder = ["correlation", "mi", "anova", "permutation", "shap","stability","interactions"] as const;
    const methodNames: Record<typeof methodLoadOrder[number], string> = {
      correlation: "Correlation",
      mi: "Mutual Info",
      anova: "ANOVA",
      permutation: "Permutation",
      shap: "SHAP",
      stability: "Stability",
      interactions: "Interactions",
    };
    const methodTimes: Record<typeof methodLoadOrder[number], number> = {
      correlation: 5,
      mi: 20,
      anova: 15,
      permutation: 60,
      shap: 120,
      stability: 90,
      interactions: 30,
    };
    const methodsState: MethodLoadingState[] = methodLoadOrder.map(id => ({
      id,
      name: methodNames[id],
      status: "pending" as const,
      progress: 0,
      estimatedTime: methodTimes[id],
    }));
    setLoadingMethods(methodsState);

    // Start loading additional methods
    const loadNextMethod = (index: number) => {
      if (index >= methodLoadOrder.length) return;

      const method = methodLoadOrder[index];

      setLoadingMethods(prev =>
        prev.map(m => (m.id === method ? { ...m, status: "loading" as const } : m))
      );

      datasetsApi
        .getFeatureImportance(datasetId, activeTarget, method)
        .then(response => {
          setProgressiveData(prev => {
            if (!prev) return prev;
            return mergeFIResult(prev, response.data as FIResult);
          });

          setLoadingMethods(prev =>
            prev.map(m => (m.id === method ? { ...m, status: "done" as const, progress: 100 } : m))
          );

          if (loadingRef.current) clearTimeout(loadingRef.current);
          loadingRef.current = setTimeout(() => loadNextMethod(index + 1), 500);
        })
        .catch(error => {
          console.error(`Failed to load ${method}:`, error);
          setLoadingMethods(prev =>
            prev.map(m => (m.id === method ? { ...m, status: "error" as const } : m))
          );

          if (loadingRef.current) clearTimeout(loadingRef.current);
          loadingRef.current = setTimeout(() => loadNextMethod(index + 1), 1000);
        });
    };

    loadNextMethod(0);

    return () => {
      if (loadingRef.current) clearTimeout(loadingRef.current);
    };
  }, [initialData, activeTarget, datasetId]);

  const data = progressiveData || (initialData as FIResult | undefined);

  const setTarget = useCallback(
    (col: string) => router.replace(`/datasets/${datasetId}/feature-importance?target=${encodeURIComponent(col)}`),
    [datasetId, router]
  );

  useEffect(() => {
    if (!data) return;
    setPageContext({
      page: "feature-importance",
      label: `Feature Importance — ${data.target}`,
      details: {
        target: data.target,
        problem_type: data.problem_type,
        model_score: data.model_score,
        cv_score: data.cv_score_mean,
        top_features: data.top_features.join(", "),
        drop_candidates: data.drop_candidates.join(", "),
        leakage_suspects: (data.leakage_suspects ?? []).map(s => s.feature).join(", "),
        redundant_groups: (data.redundant_groups ?? []).length,
        n_features: data.n_features,
        n_samples: data.n_samples,
      },
      suggestedQuestions: [
        "Which features should I keep for modeling?",
        "Are there any signs of data leakage?",
        "Which feature interactions should I engineer?",
        "How can I improve the model score?",
        "Which features are unstable and unreliable?",
      ],
    });
    return () => setPageContext(null);
  }, [data, setPageContext]);

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-full mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mt-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Feature Importance
              {!initialData && initialLoading && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              6-method analysis: RF · Permutation · SHAP · Mutual Info · ANOVA · Correlation — with stability & interaction detection
            </p>
          </div>

          {/* Target selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-gray-400" />
              <label className="text-xs font-semibold text-gray-600">Target column</label>
            </div>
            <select
              value={activeTarget}
              onChange={e => setTarget(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
            >
              {allCols.map(c => <option key={c} value={c}>{c}</option>)}
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

        {initialData && loadingMethods.length > 0 && (
          <MethodLoadingIndicator
            loadingMethods={loadingMethods}
            initialLoadTime={(initialData as any)._initialLoadTime || 0}
          />
        )}

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

        {!activeTarget ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
            <TrendingUp className="w-10 h-10" />
            <p className="text-sm">Select a target column above to run feature importance analysis</p>
          </div>
        ) : initialLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Loading Random Forest importance (~10s)…
            </div>
          </div>
        ) : initialError ? (
          <div className="flex flex-col items-center gap-3 py-20 text-red-500">
            <AlertTriangle className="w-8 h-8" />
            <p className="text-sm font-semibold">Analysis failed</p>
            <p className="text-xs text-gray-400">{(initialError as Error).message}</p>
          </div>
        ) : data && data.feature_meta.length > 0 ? (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5 flex-wrap">
              {TABS.map(t => (
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
                  {t.badge && (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-bold">
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === "overview" && <OverviewTab data={data} />}
            {activeTab === "rankings" && <RankingsTab data={data} />}
            {activeTab === "charts" && <ChartsTab data={data} />}
            {activeTab === "stability" && <StabilityTab data={data} />}
            {activeTab === "interactions" && <InteractionsTab data={data} />}
            {activeTab === "insights" && <InsightsTab data={data} />}
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