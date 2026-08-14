"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Activity,
  BarChart2, Zap, GitBranch, Clock, CheckCircle, XCircle,
  Info, ChevronDown, ChevronUp, Download, RefreshCw,
  Eye, Filter, Layers, FlaskConical, Target,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, BarChart, Bar, ScatterChart, Scatter,
  ComposedChart, Area, Brush, Legend,
} from "recharts";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TSData {
  time_col: string;
  value_col: string;
  n_points: number;
  start_date: string;
  end_date: string;
  has_trend: boolean;
  line_data: { dates: string[]; values: (number | null)[] };
  rolling: { window: number; mean: (number | null)[]; std: (number | null)[] };
  decomposition?: {
    method: string; period: number;
    trend: (number | null)[]; seasonal: (number | null)[]; residual: (number | null)[];
    dates: string[]; trend_strength_pct?: number; seasonal_strength_pct?: number;
  };
  acf?: { values: number[]; ci_upper?: number[]; ci_lower?: number[]; significant_lags?: number[] };
  pacf?: { values: number[]; ci_upper?: number[]; ci_lower?: number[]; significant_lags?: number[] };
  anomalies: { index: number; date: string; value: number; z_score?: number }[];
  data_quality?: {
    n_total: number; n_missing: number; missing_pct: number; n_duplicates: number;
    n_zeros: number; n_const_runs?: number; irregular_pct?: number; inferred_freq?: string; gaps: any[];
  };
  descriptive_stats?: {
    count: number; mean?: number; median?: number; std?: number;
    min?: number; max?: number; q1?: number; q3?: number;
    skewness?: number; kurtosis?: number; cv?: number; iqr?: number; range?: number;
  };
  adf_pvalue?: number;
  normality_tests?: Record<string, { statistic?: number; pvalue?: number; is_normal?: boolean }>;
  stationarity?: {
    adf?: { statistic?: number; pvalue?: number; is_stationary?: boolean; interpretation?: string };
    kpss?: { statistic?: number; pvalue?: number; is_stationary?: boolean; interpretation?: string };
    zivot_andrews?: { statistic?: number; pvalue?: number; break_index?: number; interpretation?: string };
    verdict?: "stationary" | "non_stationary" | "mixed" | "unknown";
  };
  differencing_suggestions?: { regular_diff_order?: number; suggested_seasonal_period?: number };
  acf_pacf_full?: {
    acf?: { values: number[]; ci_upper?: number[]; ci_lower?: number[]; significant_lags?: number[]; conf_threshold?: number };
    pacf?: { values: number[]; ci_upper?: number[]; ci_lower?: number[]; significant_lags?: number[] };
    arima_hints?: { suggested_p?: number; suggested_q?: number; note?: string };
    n_lags?: number;
  };
  spectral?: { dominant_frequencies?: { frequency?: number; amplitude?: number; period_points?: number; period_label?: string }[] };
  change_points?: { method?: string; change_points?: { index: number; date: string; value: number }[] };
  anomalies_full?: {
    rolling_zscore: any[]; iqr_fence: any[];
    combined: number[]; total_anomalies?: number;
  };
  rolling_full?: {
    windows: Record<string, { mean: number[]; std: number[]; dates: string[] }>;
    ewma?: { alpha: number; values: number[]; dates: string[] };
    volatility?: { window: number; values: number[]; dates: string[] };
  };
  lag_analysis?: { lags: number[]; pearson: (number | null)[]; spearman: (number | null)[] };
  trend_tests?: {
    mann_kendall?: { trend: string; p_value?: number; tau?: number; sen_slope?: number; interpretation?: string };
    linear_trend?: { slope?: number; pvalue?: number; r_squared?: number; interpretation?: string };
    kendall_tau?: { tau?: number; pvalue?: number };
  };
  seasonality_tests?: { has_seasonality?: boolean; dominant_period?: number; acf_seasonal_strength?: number; seasonal_diff_order?: number };
  granger_causality?: Record<string, { min_pvalue?: number; best_lag?: number; granger_causes_target?: boolean }>;
  forecasting_readiness?: {
    issues: string[];
    recommendations: { model: string; params: string; rationale: string; priority: number }[];
    suggested_arima_order?: [number, number, number];
    stationarity_verdict?: string;
    has_trend?: boolean;
    has_seasonality?: boolean;
  };
  computed_methods?: string[];
  error?: string;
}

type TSMethodLoadingState = {
  id: string;
  name: string;
  status: "pending" | "loading" | "done" | "error";
  estimatedTime: number;
};

const TS_METHOD_ORDER = ["stationarity", "decomposition", "acf_pacf", "anomalies", "change_points", "granger", "readiness"] as const;
const TS_METHOD_NAMES: Record<typeof TS_METHOD_ORDER[number], string> = {
  stationarity: "Stationarity & Trend",
  decomposition: "STL Decomposition",
  acf_pacf: "ACF / PACF",
  anomalies: "Anomalies & Rolling Stats",
  change_points: "Change Points",
  granger: "Granger Causality",
  readiness: "Forecasting Readiness",
};
const TS_METHOD_TIMES: Record<typeof TS_METHOD_ORDER[number], number> = {
  stationarity: 10,
  decomposition: 30,
  acf_pacf: 8,
  anomalies: 10,
  change_points: 30,
  granger: 20,
  readiness: 8,
};

function mergeTSResult(prev: TSData, next: TSData): TSData {
  const merged: TSData = { ...prev, ...next };
  if (!next.line_data?.dates?.length && prev.line_data?.dates?.length) {
    merged.line_data = prev.line_data;
  }
  if (!next.rolling?.mean?.length && prev.rolling?.mean?.length) {
    merged.rolling = prev.rolling;
  }
  if (!next.anomalies?.length && prev.anomalies?.length) {
    merged.anomalies = prev.anomalies;
  }
  if (!next.has_trend && prev.has_trend) {
    merged.has_trend = prev.has_trend;
  }
  merged.computed_methods = Array.from(
    new Set([...(prev.computed_methods ?? []), ...(next.computed_methods ?? [])])
  );
  return merged;
}

function TSMethodLoadingIndicator({ methods }: { methods: TSMethodLoadingState[] }) {
  const allDone = methods.every(m => m.status === "done" || m.status === "error");
  const totalComplete = methods.filter(m => m.status === "done").length;

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Loading additional analyses ({totalComplete}/{methods.length})
        </p>
        {!allDone && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <RefreshCw className="w-3 h-3 animate-spin" /> Computing…
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {methods.map(m => (
          <span
            key={m.id}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${
              m.status === "done"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : m.status === "error"
                ? "bg-red-50 text-red-700 border-red-200"
                : m.status === "loading"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {m.status === "loading" && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
            {m.name}
            {m.status === "loading" && <span className="opacity-60">~{m.estimatedTime}s</span>}
          </span>
        ))}
      </div>
    </div>
  );
}


const fmt = (n?: number | null, decimals = 4) => {
  if (n === null || n === undefined) return "—";
  if (!isFinite(n)) return "—";
  return Number(n.toPrecision(4)).toLocaleString(undefined, { maximumFractionDigits: decimals });
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { 
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }); 
  }
  catch { 
    return d; 
  }
};

const shortDate = (d?: string | null) => {
  if (!d) return "—";
  try { 
    return new Date(d).toLocaleDateString(undefined, { month: "short", year: "2-digit" }); 
  }
  catch { 
    return d; 
  }
};

function zipDatesValues(dates?: string[], values?: (number | null)[]) {
  if (!dates?.length || !values?.length || dates.length !== values.length) {
    return [];
  }
  return dates.map((d, i) => ({ date: d, value: values[i] }));
}

function safeLength<T>(arr?: T[]): number {
  return Array.isArray(arr) ? arr.length : 0;
}

// Safe array access
function safeAt<T>(arr?: T[], index?: number): T | null {
  if (!Array.isArray(arr) || index == null || index < 0 || index >= arr.length) {
    return null;
  }
  return arr[index];
}


// --- Section wrapper ---
function Section({ title, icon, defaultOpen = true, children, badge }: {
  title: string; icon: React.ReactNode; defaultOpen?: boolean;
  children: React.ReactNode; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-brand">{icon}</span>
          <span className="font-semibold text-foreground text-sm">{title}</span>
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-border">{children}</div>}
    </div>
  );
}

function Badge({ color, children }: { color: "green" | "red" | "yellow" | "gray" | "blue"; children: React.ReactNode }) {
  const cls = {
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    gray: "bg-muted text-muted-foreground border-border",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  }[color];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{children}</span>;
}

function KVRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 mr-4">{label}</span>
      <span className={`text-xs text-foreground text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-1">{fmtDate(label)}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p?.color }} className="font-mono font-medium">
          {p?.name ?? "Value"}: {p?.value != null && isFinite(p.value) ? Number(p.value).toFixed(4) : "—"}
        </p>
      ))}
    </div>
  );
};

const dateTick = (v?: string) => shortDate(v);


function MainSeriesChart({ data, anomalyIndices, changePointDates }: {
  data: TSData; anomalyIndices: Set<number>; changePointDates: string[];
}) {
  const [showRolling, setShowRolling] = useState(true);
  const [showBands, setShowBands] = useState(false);

  const chartData = useMemo(() => {
    if (!data.line_data?.dates || !Array.isArray(data.line_data.dates)) return [];
    
    const { dates, values } = data.line_data;
    const rollingMean = data.rolling?.mean ?? [];
    const rollingStd = data.rolling?.std ?? [];
    
    if (dates.length === 0) return [];
    
    return dates.map((d, i) => ({
      date: d,
      value: safeAt(values, i),
      rolling_mean: safeAt(rollingMean, i),
      band_upper: safeAt(rollingMean, i) != null && safeAt(rollingStd, i) != null
        ? (safeAt(rollingMean, i)! + 2 * safeAt(rollingStd, i)!) : null,
      band_lower: safeAt(rollingMean, i) != null && safeAt(rollingStd, i) != null
        ? (safeAt(rollingMean, i)! - 2 * safeAt(rollingStd, i)!) : null,
      is_anomaly: anomalyIndices.has(i),
    }));
  }, [data, anomalyIndices]);

  if (chartData.length === 0) {
    return <p className="text-xs text-muted-foreground">No data available for chart</p>;
  }

  const validChangePoints = changePointDates.filter(d => typeof d === "string" && d.length > 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showRolling} onChange={e => setShowRolling(e.target.checked)} className="rounded" />
          Rolling mean
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showBands} onChange={e => setShowBands(e.target.checked)} className="rounded" />
          ±2σ bands
        </label>
        <span className="text-xs text-muted-foreground ml-2">
          {data.n_points?.toLocaleString?.() ?? "?"} points · {fmtDate(data.start_date)} – {fmtDate(data.end_date)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tickFormatter={dateTick} tick={{ fontSize: 10, fill: "#9ca3af" }} minTickGap={60} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={60} tickFormatter={v => {
            if (!isFinite(v)) return "—";
            return Number(v).toPrecision(3);
          }} />
          <Tooltip content={<ChartTooltip />} />
          {showBands && (
            <>
              <Area dataKey="band_upper" fill="#dbeafe" stroke="none" fillOpacity={0.4} name="Upper band" dot={false} connectNulls />
              <Area dataKey="band_lower" fill="#ffffff" stroke="none" fillOpacity={1} name="Lower band" dot={false} connectNulls />
            </>
          )}
          <Line dataKey="value" stroke="#2563eb" strokeWidth={1.5} dot={false} name={data.value_col} connectNulls />
          {showRolling && (
            <Line dataKey="rolling_mean" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Rolling mean" connectNulls />
          )}
          {validChangePoints.slice(0, 10).map((d, idx) => (
            <ReferenceLine key={`cp-${idx}`} x={d} stroke="#ef4444" strokeDasharray="3 2" strokeWidth={1.5} label={{ value: "⚡", fontSize: 10 }} />
          ))}
          <Brush dataKey="date" height={20} stroke="#e5e7eb" travellerWidth={6} tickFormatter={dateTick} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function DecompositionChart({ decomp }: { decomp: NonNullable<TSData["decomposition"]> }) {
  if (!decomp?.dates || !Array.isArray(decomp.dates) || decomp.dates.length === 0) {
    return <p className="text-xs text-muted-foreground">No decomposition data available</p>;
  }

  const series = (key: "trend" | "seasonal" | "residual") => {
    const values = decomp[key];
    if (!Array.isArray(values) || values.length === 0) return [];
    return decomp.dates.map((d, i) => ({ date: d, value: safeAt(values, i) }));
  };

  const panels = [
    { label: "Trend", color: "#2563eb", data: series("trend") },
    { label: "Seasonal", color: "#10b981", data: series("seasonal") },
    { label: "Residual", color: "#f59e0b", data: series("residual") },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span>Method: <strong className="text-foreground">{decomp.method ?? "Unknown"}</strong></span>
        <span>Period: <strong className="text-foreground">{decomp.period ?? "—"}</strong></span>
        {decomp.trend_strength_pct != null && (
          <span>Trend strength: <strong className="text-foreground">{decomp.trend_strength_pct}%</strong></span>
        )}
        {decomp.seasonal_strength_pct != null && (
          <span>Seasonal strength: <strong className="text-foreground">{decomp.seasonal_strength_pct}%</strong></span>
        )}
      </div>
      {panels.map(p => (
        <div key={p.label}>
          <p className="text-xs font-medium text-muted-foreground mb-1">{p.label}</p>
          {p.data.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={p.data} margin={{ top: 2, right: 12, left: 0, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={dateTick} tick={{ fontSize: 9, fill: "#9ca3af" }} minTickGap={80} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={55} tickFormatter={v => {
                  if (!isFinite(v)) return "—";
                  return Number(v).toPrecision(3);
                }} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="value" stroke={p.color} strokeWidth={1.5} dot={false} connectNulls name={p.label} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      ))}
    </div>
  );
}

function CorrelogramChart({ values, ciUpper, ciLower, confThreshold, title, significantLags }: {
  values?: number[]; ciUpper?: number[]; ciLower?: number[];
  confThreshold?: number; title: string; significantLags?: number[];
}) {
  if (!Array.isArray(values) || values.length === 0) {
    return <p className="text-xs text-muted-foreground">No {title} data available</p>;
  }

  const data = values.map((v, i) => ({
    lag: i,
    value: v,
    ci_upper: safeAt(ciUpper, i) ?? (confThreshold ?? 0.196),
    ci_lower: safeAt(ciLower, i) ?? -(confThreshold ?? 0.196),
    is_significant: Array.isArray(significantLags) && significantLags.includes(i),
  }));

  const threshold = confThreshold ?? 0.196;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#f3f4f6" />
          <XAxis dataKey="lag" tick={{ fontSize: 9, fill: "#9ca3af" }} label={{ value: "Lag", position: "insideBottom", fontSize: 9, fill: "#9ca3af", dy: 10 }} />
          <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={40} domain={[-1.1, 1.1]} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          <ReferenceLine y={threshold} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} />
          <ReferenceLine y={-threshold} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} />
          <Bar dataKey="value" fill="#2563eb" opacity={0.7} name={title} maxBarSize={10} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function VolatilityChart({ rolling }: { rolling?: NonNullable<TSData["rolling_full"]> }) {
  const volData = rolling?.volatility;
  if (!volData?.dates || !Array.isArray(volData.dates) || volData.dates.length === 0) {
    return <p className="text-xs text-muted-foreground">Volatility data not available</p>;
  }

  const chartData = volData.dates.map((d, i) => ({ 
    date: d, 
    volatility: safeAt(volData.values, i) 
  })).filter(d => d.volatility != null);

  if (chartData.length === 0) {
    return <p className="text-xs text-muted-foreground">No valid volatility data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tickFormatter={dateTick} tick={{ fontSize: 9, fill: "#9ca3af" }} minTickGap={80} />
        <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={50} tickFormatter={v => {
          if (!isFinite(v)) return "—";
          return (v * 100).toFixed(1) + "%";
        }} />
        <Tooltip content={<ChartTooltip />} />
        <Line dataKey="volatility" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Volatility" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

function LagCorrelationChart({ lagAnalysis }: { lagAnalysis?: NonNullable<TSData["lag_analysis"]> }) {
  if (!lagAnalysis?.lags || !Array.isArray(lagAnalysis.lags) || lagAnalysis.lags.length === 0) {
    return <p className="text-xs text-muted-foreground">No lag analysis data available</p>;
  }

  const data = lagAnalysis.lags.map((lag, i) => ({
    lag,
    pearson: safeAt(lagAnalysis.pearson, i),
    spearman: safeAt(lagAnalysis.spearman, i),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#f3f4f6" />
        <XAxis dataKey="lag" tick={{ fontSize: 10, fill: "#9ca3af" }} label={{ value: "Lag", position: "insideBottom", fontSize: 9, fill: "#9ca3af", dy: 10 }} />
        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={40} domain={[-1, 1]} />
        <Tooltip content={<ChartTooltip />} />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        <Bar dataKey="pearson" fill="#2563eb" opacity={0.7} name="Pearson r" maxBarSize={14} />
        <Bar dataKey="spearman" fill="#10b981" opacity={0.7} name="Spearman ρ" maxBarSize={14} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SpectralChart({ spectral }: { spectral?: NonNullable<TSData["spectral"]> }) {
  const freqs = spectral?.dominant_frequencies;
  if (!Array.isArray(freqs) || freqs.length === 0) {
    return <p className="text-xs text-muted-foreground">No dominant frequencies detected</p>;
  }

  const data = freqs.map(f => ({
    label: f?.period_label ?? (f?.period_points ? `${f.period_points}pts` : "?"),
    amplitude: f?.amplitude,
    frequency: f?.frequency,
  })).filter(d => d.amplitude != null && isFinite(d.amplitude));

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground">No valid frequency data</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#f3f4f6" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} />
          <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={55} tickFormatter={v => {
            if (!isFinite(v)) return "—";
            return Number(v).toPrecision(3);
          }} label={{ value: "Amplitude", angle: -90, position: "insideLeft", fontSize: 9, fill: "#9ca3af" }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="amplitude" fill="#7c3aed" opacity={0.75} name="Amplitude" />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-1">Dominant periodicities via FFT. Strongest cycle on left.</p>
    </div>
  );
}


function DataQualityPanel({ q }: { q?: NonNullable<TSData["data_quality"]> }) {
  if (!q) return <p className="text-xs text-muted-foreground">No data quality information available</p>;

  const score = Math.max(0, 100 - (q.missing_pct ?? 0) - ((q.irregular_pct ?? 0) / 2) - (q.n_duplicates ?? 0));
  const scoreColor = score >= 80 ? "green" : score >= 60 ? "yellow" : "red";

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-foreground">Quality Score</span>
          <Badge color={scoreColor}>{score.toFixed(0)} / 100</Badge>
        </div>
        <KVRow label="Total points" value={q.n_total?.toLocaleString?.() ?? "—"} />
        <KVRow label="Missing values" value={<span className={(q.missing_pct ?? 0) > 5 ? "text-red-600 font-medium" : ""}>{q.n_missing ?? 0} ({(q.missing_pct ?? 0).toFixed(2)}%)</span>} />
        <KVRow label="Duplicate timestamps" value={<span className={(q.n_duplicates ?? 0) > 0 ? "text-amber-600 font-medium" : ""}>{q.n_duplicates ?? 0}</span>} />
        <KVRow label="Zero values" value={q.n_zeros ?? 0} />
        <KVRow label="Constant runs (≥5)" value={q.n_const_runs ?? "—"} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Temporal Regularity</p>
        <KVRow label="Inferred frequency" value={<Badge color="blue">{q.inferred_freq ?? "unknown"}</Badge>} />
        <KVRow label="Irregular intervals" value={<span className={(q.irregular_pct ?? 0) > 10 ? "text-amber-600 font-medium" : ""}>{q.irregular_pct != null ? `${q.irregular_pct.toFixed(1)}%` : "—"}</span>} />
        {Array.isArray(q.gaps) && q.gaps.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground font-medium mb-1">Detected gaps ({q.gaps.length})</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {q.gaps.slice(0, 10).map((g, i) => (
                <div key={i} className="text-xs text-muted-foreground bg-amber-50 rounded px-2 py-1">
                  {fmtDate(g?.start)} → {fmtDate(g?.end)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DescriptiveStatsPanel({ stats }: { stats?: NonNullable<TSData["descriptive_stats"]> }) {
  if (!stats) return <p className="text-xs text-muted-foreground">No descriptive statistics available</p>;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Central tendency</p>
        <KVRow label="Mean" value={fmt(stats.mean)} mono />
        <KVRow label="Median" value={fmt(stats.median)} mono />
        <KVRow label="Std dev" value={fmt(stats.std)} mono />
        <KVRow label="CV %" value={stats.cv != null ? `${stats.cv.toFixed(2)}%` : "—"} mono />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Distribution</p>
        <KVRow label="Min" value={fmt(stats.min)} mono />
        <KVRow label="Q1" value={fmt(stats.q1)} mono />
        <KVRow label="Q3" value={fmt(stats.q3)} mono />
        <KVRow label="Max" value={fmt(stats.max)} mono />
        <KVRow label="IQR" value={fmt(stats.iqr)} mono />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Shape</p>
        <KVRow label="Skewness" value={
          <span className={Math.abs(stats.skewness ?? 0) > 1 ? "text-amber-600 font-medium" : ""}>{fmt(stats.skewness)}</span>
        } mono />
        <KVRow label="Kurtosis" value={fmt(stats.kurtosis)} mono />
        <KVRow label="Range" value={fmt(stats.range)} mono />
        <KVRow label="Count" value={stats.count?.toLocaleString?.() ?? "—"} />
      </div>
    </div>
  );
}

function StationarityPanel({ stationarity, diffSuggestions }: {
  stationarity?: NonNullable<TSData["stationarity"]>;
  diffSuggestions?: TSData["differencing_suggestions"];
}) {
  if (!stationarity) return <p className="text-xs text-muted-foreground">No stationarity test results available</p>;

  const verdictColor = {
    stationary: "green" as const,
    non_stationary: "red" as const,
    mixed: "yellow" as const,
    unknown: "gray" as const,
  }[stationarity.verdict ?? "unknown"];

  const verdictLabel = {
    stationary: "Stationary",
    non_stationary: "Non-Stationary",
    mixed: "Mixed signals",
    unknown: "Unknown",
  }[stationarity.verdict ?? "unknown"];

  const tests = [
    { name: "ADF Test", data: stationarity.adf, nullHypothesis: "H₀: Unit root (non-stationary)", trueIsStationary: true },
    { name: "KPSS Test", data: stationarity.kpss, nullHypothesis: "H₀: Stationary", trueIsStationary: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-foreground">Overall verdict:</span>
        <Badge color={verdictColor}>{verdictLabel}</Badge>
        {stationarity.verdict === "non_stationary" && diffSuggestions?.regular_diff_order != null && (
          <Badge color="blue">Suggest d={diffSuggestions.regular_diff_order} differencing</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {tests.map(t => t.data && (
          <div key={t.name} className="border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">{t.name}</span>
              <Badge color={t.data.is_stationary ? "green" : "red"}>
                {t.data.is_stationary ? "Stationary" : "Non-stationary"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{t.nullHypothesis}</p>
            <KVRow label="Statistic" value={fmt(t.data.statistic)} mono />
            <KVRow label="p-value" value={
              <span className={(t.data.pvalue ?? 1) < 0.05 ? "text-green-600 font-medium" : "text-red-600"}>
                {fmt(t.data.pvalue, 6)}
              </span>
            } mono />
            <p className="text-xs text-muted-foreground mt-1.5 italic">{t.data.interpretation ?? "—"}</p>
          </div>
        ))}
      </div>
      {stationarity.zivot_andrews && (
        <div className="border border-amber-100 bg-amber-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground">Zivot-Andrews Structural Break Test</span>
            <Badge color={stationarity.zivot_andrews.pvalue != null && stationarity.zivot_andrews.pvalue < 0.05 ? "yellow" : "green"}>
              {stationarity.zivot_andrews.pvalue != null && stationarity.zivot_andrews.pvalue < 0.05 ? "Break detected" : "No break"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{stationarity.zivot_andrews.interpretation ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">Break at index: {stationarity.zivot_andrews.break_index ?? "—"}</p>
        </div>
      )}
    </div>
  );
}

function NormalityPanel({ normality }: { normality?: NonNullable<TSData["normality_tests"]> }) {
  if (!normality || Object.keys(normality).length === 0) {
    return <p className="text-xs text-muted-foreground">No normality test results available</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {Object.entries(normality).map(([name, test]) => (
        <div key={name} className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground capitalize">{name.replace(/_/g, " ")}</span>
            <Badge color={test?.is_normal ? "green" : "red"}>
              {test?.is_normal ? "Normal" : "Non-normal"}
            </Badge>
          </div>
          <KVRow label="Statistic" value={fmt(test?.statistic)} mono />
          <KVRow label="p-value" value={<span className={(test?.pvalue ?? 1) > 0.05 ? "text-green-600" : "text-red-600"}>{fmt(test?.pvalue, 6)}</span>} mono />
        </div>
      ))}
    </div>
  );
}

function TrendPanel({ trend }: { trend?: NonNullable<TSData["trend_tests"]> }) {
  if (!trend) return <p className="text-xs text-muted-foreground">No trend test results available</p>;

  const mk = trend.mann_kendall;
  const lt = trend.linear_trend;

  if (!mk && !lt) {
    return <p className="text-xs text-muted-foreground">No trend test results available</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {mk && (
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Mann-Kendall Test</span>
            <Badge color={mk.trend === "no trend" ? "gray" : mk.trend === "increasing" ? "green" : "red"}>
              {mk.trend ?? "unknown"}
            </Badge>
          </div>
          <KVRow label="p-value" value={<span className={(mk.p_value ?? 1) < 0.05 ? "text-green-600 font-medium" : "text-muted-foreground"}>{fmt(mk.p_value, 6)}</span>} mono />
          <KVRow label="Tau (τ)" value={fmt(mk.tau)} mono />
          <KVRow label="Sen's slope" value={fmt(mk.sen_slope)} mono />
          <p className="text-xs text-muted-foreground mt-1.5 italic">{mk.interpretation ?? "—"}</p>
        </div>
      )}
      {lt && (
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Linear Trend (OLS)</span>
            <Badge color={(lt.pvalue ?? 1) < 0.05 ? "blue" : "gray"}>
              {(lt.pvalue ?? 1) < 0.05 ? "Significant" : "Not significant"}
            </Badge>
          </div>
          <KVRow label="Slope" value={fmt(lt.slope)} mono />
          <KVRow label="R²" value={lt.r_squared != null ? (lt.r_squared * 100).toFixed(2) + "%" : "—"} mono />
          <KVRow label="p-value" value={fmt(lt.pvalue, 6)} mono />
          <p className="text-xs text-muted-foreground mt-1.5 italic">{lt.interpretation ?? "—"}</p>
        </div>
      )}
    </div>
  );
}

function SeasonalityPanel({ seasonality, spectral, decomp }: {
  seasonality?: NonNullable<TSData["seasonality_tests"]>;
  spectral?: TSData["spectral"];
  decomp?: TSData["decomposition"];
}) {
  if (!seasonality) return <p className="text-xs text-muted-foreground">No seasonality test results available</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge color={seasonality.has_seasonality ? "green" : "gray"}>
          {seasonality.has_seasonality ? "Seasonality detected" : "No clear seasonality"}
        </Badge>
        {seasonality.dominant_period && <Badge color="blue">Period: {seasonality.dominant_period}</Badge>}
        {seasonality.seasonal_diff_order != null && (
          <Badge color="yellow">D={seasonality.seasonal_diff_order} seasonal diff needed</Badge>
        )}
      </div>
      {seasonality.acf_seasonal_strength != null && (
        <KVRow label="ACF at seasonal lag" value={fmt(seasonality.acf_seasonal_strength)} mono />
      )}
      {spectral && <SpectralChart spectral={spectral} />}
    </div>
  );
}

function AnomalyPanel({ anomaliesFull, data }: {
  anomaliesFull?: NonNullable<TSData["anomalies_full"]>;
  data: TSData;
}) {
  const [tab, setTab] = useState<"zscore" | "iqr">("zscore");

  if (!anomaliesFull) {
    return <p className="text-xs text-muted-foreground">No anomaly detection results available</p>;
  }

  const list = tab === "zscore" ? (anomaliesFull.rolling_zscore ?? []) : (anomaliesFull.iqr_fence ?? []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge color={((anomaliesFull.total_anomalies ?? 0) === 0) ? "green" : "red"}>
          {anomaliesFull.total_anomalies ?? 0} anomalies detected
        </Badge>
        <span className="text-xs text-muted-foreground">(union of methods)</span>
      </div>
      <div className="flex border border-border rounded-lg overflow-hidden w-fit">
        {(["zscore", "iqr"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium ${tab === t ? "bg-brand text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}>
            {t === "zscore" ? "Rolling Z-Score" : "IQR Fence"}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">No anomalies detected by this method</p>
      ) : (
        <div className="overflow-auto max-h-48 rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">Date</th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">Value</th>
                {tab === "zscore" && <th className="px-3 py-2 text-right text-muted-foreground font-medium">|Z-score|</th>}
                {tab === "iqr" && <th className="px-3 py-2 text-right text-muted-foreground font-medium">Fence</th>}
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 50).map((a: any, i: number) => (
                <tr key={i} className="border-t border-border hover:bg-red-50">
                  <td className="px-3 py-1.5 text-foreground">{fmtDate(a?.date)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-foreground">{fmt(a?.value)}</td>
                  {tab === "zscore" && <td className="px-3 py-1.5 text-right font-mono text-red-600">{fmt(Math.abs(a?.z_score ?? 0))}</td>}
                  {tab === "iqr" && (
                    <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                      [{fmt(a?.fence_lower)}, {fmt(a?.fence_upper)}]
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > 50 && (
            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted border-t">
              Showing 50 of {list.length} anomalies
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangePointPanel({ changePoints }: { changePoints?: NonNullable<TSData["change_points"]> }) {
  if (!changePoints) return <p className="text-xs text-muted-foreground">No change point detection results available</p>;

  const points = changePoints.change_points ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge color={points.length === 0 ? "gray" : "yellow"}>
          {points.length} change points
        </Badge>
        {changePoints.method && <Badge color="gray">{changePoints.method}</Badge>}
      </div>
      {points.length === 0 ? (
        <p className="text-xs text-muted-foreground">No significant change points detected</p>
      ) : (
        <div className="overflow-auto max-h-40 rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">Index</th>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">Date</th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(0, 20).map((cp, i) => (
                <tr key={i} className="border-t border-border hover:bg-amber-50">
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{cp?.index ?? "—"}</td>
                  <td className="px-3 py-1.5 text-foreground">{fmtDate(cp?.date)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-foreground">{fmt(cp?.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {points.length > 20 && (
            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted border-t">
              Showing 20 of {points.length} change points
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GrangerPanel({ granger }: { granger?: NonNullable<TSData["granger_causality"]> }) {
  if (!granger || Object.keys(granger).length === 0) {
    return <p className="text-xs text-muted-foreground">No other numeric columns available for Granger causality testing</p>;
  }

  const entries = Object.entries(granger);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Tests whether lagged values of other columns help predict the target column.</p>
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left text-muted-foreground font-medium">Column</th>
              <th className="px-3 py-2 text-center text-muted-foreground font-medium">Granger-causes target?</th>
              <th className="px-3 py-2 text-right text-muted-foreground font-medium">Min p-value</th>
              <th className="px-3 py-2 text-right text-muted-foreground font-medium">Best lag</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 20).map(([col, res]) => (
              <tr key={col} className="border-t border-border hover:bg-muted">
                <td className="px-3 py-1.5 font-mono text-foreground max-w-[160px] truncate">{col}</td>
                <td className="px-3 py-1.5 text-center">
                  <Badge color={res?.granger_causes_target ? "green" : "gray"}>
                    {res?.granger_causes_target ? "Yes" : "No"}
                  </Badge>
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-foreground">{fmt(res?.min_pvalue, 6)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-foreground">{res?.best_lag ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length > 20 && (
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted border-t">
            Showing 20 of {entries.length} columns
          </div>
        )}
      </div>
    </div>
  );
}

function ForecastingReadinessPanel({ readiness }: { readiness?: NonNullable<TSData["forecasting_readiness"]> }) {
  if (!readiness) return <p className="text-xs text-muted-foreground">No forecasting readiness assessment available</p>;

  return (
    <div className="space-y-4">
      {/* Issues */}
      {Array.isArray(readiness.issues) && readiness.issues.length > 0 ? (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Pre-processing required
          </p>
          <ul className="space-y-1">
            {readiness.issues.map((issue, i) => (
              <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">•</span>{issue}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Data is ready for modelling
          </p>
        </div>
      )}

      {/* Properties */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge color={readiness.stationarity_verdict === "stationary" ? "green" : "red"}>
          {readiness.stationarity_verdict === "stationary" ? "Stationary" : "Non-stationary"}
        </Badge>
        <Badge color={readiness.has_trend ? "blue" : "gray"}>
          {readiness.has_trend ? "Trend present" : "No trend"}
        </Badge>
        <Badge color={readiness.has_seasonality ? "blue" : "gray"}>
          {readiness.has_seasonality ? "Seasonal" : "Not seasonal"}
        </Badge>
        {readiness.suggested_arima_order && (
          <Badge color="blue">ARIMA({readiness.suggested_arima_order.join(",")})</Badge>
        )}
      </div>

      {/* Model recommendations */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Model Recommendations</p>
        {Array.isArray(readiness.recommendations) && readiness.recommendations.length > 0 ? (
          readiness.recommendations.map((r, i) => (
            <div key={i} className={`border rounded-lg p-3 ${i === 0 ? "border-brand bg-blue-50" : "border-border"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">{r?.model ?? "Unknown"}</span>
                {i === 0 && <Badge color="blue">Recommended</Badge>}
              </div>
              <code className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 block mb-1.5 break-words">{r?.params ?? "—"}</code>
              <p className="text-xs text-muted-foreground">{r?.rationale ?? "—"}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No recommendations available</p>
        )}
      </div>
    </div>
  );
}

// ====================================
// HEADER SUMMARY CARDS
// ====================================
function SummaryCards({ data }: { data: TSData }) {
  const trendValue = data.trend_tests?.mann_kendall?.trend ?? (data.has_trend ? "trend" : "no trend");
  const TrendIcon = trendValue?.includes("increas") ? TrendingUp : trendValue?.includes("decreas") ? TrendingDown : Minus;
  const trendColor = trendValue?.includes("increas") ? "text-green-600" : trendValue?.includes("decreas") ? "text-red-600" : "text-muted-foreground";

  const cards = [
    {
      label: "Data points",
      value: data.n_points?.toLocaleString?.() ?? "?",
      sub: data.data_quality?.inferred_freq ? `freq: ${data.data_quality.inferred_freq}` : undefined,
      icon: <Activity className="w-4 h-4 text-blue-500" />,
    },
    {
      label: "Stationarity",
      value: {
        stationary: "Stationary",
        non_stationary: "Non-Stationary",
        mixed: "Mixed",
        unknown: "Unknown",
      }[data.stationarity?.verdict ?? "unknown"],
      sub: data.adf_pvalue != null ? `ADF p=${fmt(data.adf_pvalue, 4)}` : undefined,
      icon: data.stationarity?.verdict === "stationary"
        ? <CheckCircle className="w-4 h-4 text-green-500" />
        : <XCircle className="w-4 h-4 text-red-500" />,
    },
    {
      label: "Trend",
      value: trendValue?.charAt(0).toUpperCase() + (trendValue?.slice(1) ?? ""),
      sub: data.trend_tests?.mann_kendall ? `τ=${fmt(data.trend_tests.mann_kendall.tau)}` : undefined,
      icon: <TrendIcon className={`w-4 h-4 ${trendColor}`} />,
    },
    {
      label: "Seasonality",
      value: data.seasonality_tests?.has_seasonality ? `Period ${data.seasonality_tests.dominant_period}` : "None detected",
      sub: data.seasonality_tests?.acf_seasonal_strength != null
        ? `ACF@period=${fmt(data.seasonality_tests.acf_seasonal_strength)}`
        : undefined,
      icon: <BarChart2 className="w-4 h-4 text-purple-500" />,
    },
    {
      label: "Anomalies",
      value: (data.anomalies_full?.total_anomalies ?? data.anomalies?.length ?? 0).toString(),
      sub: "multi-method",
      icon: <AlertTriangle className={`w-4 h-4 ${((data.anomalies_full?.total_anomalies ?? 0) > 0) ? "text-amber-500" : "text-muted-foreground/60"}`} />,
    },
    {
      label: "Change points",
      value: (data.change_points?.change_points?.length ?? 0).toString(),
      sub: data.change_points?.method ?? undefined,
      icon: <GitBranch className="w-4 h-4 text-orange-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="bg-card rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            {c.icon}
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight">{c.value}</p>
          {c.sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ====================================
// ARIMA HINTS PANEL
// ====================================
function ArimaHintsPanel({ hints }: { hints?: NonNullable<TSData["acf_pacf_full"]>["arima_hints"] }) {
  if (!hints) return null;
  return (
    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
      <p className="text-xs font-semibold text-blue-800 mb-1">ARIMA Order Hints</p>
      <p className="text-xs text-blue-700">{hints.note ?? "No hints available"}</p>
      <div className="flex gap-3 mt-1.5">
        <Badge color="blue">p = {hints.suggested_p ?? 0}</Badge>
        <Badge color="blue">q = {hints.suggested_q ?? 0}</Badge>
      </div>
    </div>
  );
}

// ====================================
// MAIN PAGE
// ====================================

export default function TimeSeriesPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then(r => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then(r => r.data),
  });

  const datetimeCols =
    profile?.columns
      ?.filter((c: any) => {
        const name = c?.name?.toLowerCase?.() ?? "";
        return (
          c?.semantic_type === "datetime" ||
          c?.dtype?.toLowerCase?.()?.includes("datetime") ||
          c?.dtype?.toLowerCase?.()?.includes("date") ||
          name.includes("date") ||
          name.includes("time") ||
          name.includes("timestamp")
        );
      })
      .map((c: any) => c?.name)
      .filter(Boolean) ?? [];

  const numericCols: string[] = profile?.columns
    ?.filter((c: any) => c?.semantic_type === "numeric")
    .map((c: any) => c?.name)
    .filter(Boolean) ?? [];

  const timeCol = searchParams.get("time_col") ?? datetimeCols[0] ?? "";
  const valueCol = searchParams.get("value_col") ?? numericCols[0] ?? "";

  const { data: initialData, isLoading, isError, refetch } = useQuery<TSData>({
    queryKey: queryKeys.eda.timeseries(datasetId, timeCol, valueCol),
    queryFn: () => datasetsApi.getTimeSeries(datasetId, timeCol, valueCol, "overview").then(r => r.data),
    enabled: !!timeCol && !!valueCol,
    staleTime: 5 * 60 * 1000,
  });

  const [progressiveData, setProgressiveData] = useState<TSData | null>(null);
  const [loadingMethods, setLoadingMethods] = useState<TSMethodLoadingState[]>([]);
  const tsLoadingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!initialData || !timeCol || !valueCol) return;
    setProgressiveData(initialData);

    if (initialData.error) return;

    setLoadingMethods(TS_METHOD_ORDER.map(id => ({
      id, name: TS_METHOD_NAMES[id], status: "pending" as const, estimatedTime: TS_METHOD_TIMES[id],
    })));

    const loadNext = (index: number) => {
      if (index >= TS_METHOD_ORDER.length) return;
      const method = TS_METHOD_ORDER[index];

      setLoadingMethods(prev => prev.map(m => (m.id === method ? { ...m, status: "loading" as const } : m)));

      datasetsApi.getTimeSeries(datasetId, timeCol, valueCol, method)
        .then(response => {
          setProgressiveData(prev => (prev ? mergeTSResult(prev, response.data as TSData) : (response.data as TSData)));
          setLoadingMethods(prev => prev.map(m => (m.id === method ? { ...m, status: "done" as const } : m)));
          if (tsLoadingRef.current) clearTimeout(tsLoadingRef.current);
          tsLoadingRef.current = setTimeout(() => loadNext(index + 1), 300);
        })
        .catch(() => {
          setLoadingMethods(prev => prev.map(m => (m.id === method ? { ...m, status: "error" as const } : m)));
          if (tsLoadingRef.current) clearTimeout(tsLoadingRef.current);
          tsLoadingRef.current = setTimeout(() => loadNext(index + 1), 500);
        });
    };
    loadNext(0);

    return () => {
      if (tsLoadingRef.current) clearTimeout(tsLoadingRef.current);
    };
  }, [initialData, datasetId, timeCol, valueCol]);

  const data = progressiveData ?? initialData;

  const setParams = useCallback((key: string, val: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set(key, val);
    router.replace(`/datasets/${datasetId}/timeseries?${p.toString()}`);
  }, [searchParams, router, datasetId]);

  const anomalyIndices = useMemo(() => {
    if (!data) return new Set<number>();
    const combined = data.anomalies_full?.combined ?? data.anomalies?.map((a) => a?.index).filter(Boolean) ?? [];
    return new Set(Array.isArray(combined) ? combined : []);
  }, [data]);

  const changePointDates = useMemo(() => {
    if (!data?.change_points?.change_points) return [];
    return data.change_points.change_points
      .map((cp) => cp?.date)
      .filter((d) => typeof d === "string" && d.length > 0);
  }, [data]);

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Time Series" },
          ]}
        />

        <div className="mt-4 mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Time Series Analysis</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Stationarity · Decomposition · ACF/PACF · Anomalies · Change Points · Forecasting Readiness
            </p>
          </div>
          {data && (
            <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          )}
        </div>

        {datetimeCols.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="w-12 h-12" />}
            title="No datetime columns"
            description="This dataset has no datetime columns for time series analysis."
          />
        ) : (
          <>
            {/* Column selectors */}
            <div className="flex flex-wrap gap-4 mb-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Time column</label>
                <select
                  value={timeCol}
                  onChange={e => setParams("time_col", e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-card"
                >
                  <option value="">Select a time column</option>
                  {datetimeCols.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Value column</label>
                <select
                  value={valueCol}
                  onChange={e => setParams("value_col", e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-card"
                >
                  <option value="">Select a value column</option>
                  {numericCols.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {!timeCol || !valueCol ? (
              <EmptyState 
                icon={<TrendingUp className="w-12 h-12" />} 
                title="Select columns" 
                description="Choose a time and value column to begin analysis." 
              />
            ) : isLoading ? (
              <PageSpinner />
            ) : isError || !data ? (
              <EmptyState 
                icon={<AlertTriangle className="w-12 h-12" />} 
                title="Analysis failed" 
                description="Could not compute time series analysis. Check that the selected columns are valid." 
              />
            ) : data.error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium">Analysis error: {data.error}</p>
              </div>
            ) : (
              <>
                <SummaryCards data={data} />

                {loadingMethods.length > 0 && (
                  <TSMethodLoadingIndicator methods={loadingMethods} />
                )}

                {data.data_quality && (
                  <Section 
                    title="Data Quality" 
                    icon={<Eye className="w-4 h-4" />}
                    badge={
                      (data.data_quality.missing_pct ?? 0) > 5
                        ? <Badge color="red">{data.data_quality.missing_pct}% missing</Badge>
                        : <Badge color="green">Clean</Badge>
                    }
                  >
                    <DataQualityPanel q={data.data_quality} />
                  </Section>
                )}

                <Section title="Time Series Overview" icon={<Activity className="w-4 h-4" />}>
                  <MainSeriesChart data={data} anomalyIndices={anomalyIndices} changePointDates={changePointDates} />
                </Section>

                {data.descriptive_stats && (
                  <Section title="Descriptive Statistics" icon={<BarChart2 className="w-4 h-4" />}>
                    <DescriptiveStatsPanel stats={data.descriptive_stats} />
                  </Section>
                )}

                {data.stationarity && (
                  <Section 
                    title="Stationarity Tests"
                    icon={<FlaskConical className="w-4 h-4" />}
                    badge={
                      <Badge color={data.stationarity.verdict === "stationary" ? "green" : data.stationarity.verdict === "non_stationary" ? "red" : "yellow"}>
                        {data.stationarity.verdict?.replace("_", " ") ?? "unknown"}
                      </Badge>
                    }
                  >
                    <StationarityPanel stationarity={data.stationarity} diffSuggestions={data.differencing_suggestions} />
                  </Section>
                )}

                {data.trend_tests && (
                  <Section 
                    title="Trend Analysis" 
                    icon={<TrendingUp className="w-4 h-4" />}
                    badge={data.trend_tests.mann_kendall && (
                      <Badge color={data.trend_tests.mann_kendall.trend === "no trend" ? "gray" : "blue"}>
                        {data.trend_tests.mann_kendall.trend ?? "unknown"}
                      </Badge>
                    )}
                  >
                    <TrendPanel trend={data.trend_tests} />
                  </Section>
                )}

                {data.seasonality_tests && (
                  <Section 
                    title="Seasonality & Spectral Analysis" 
                    icon={<Layers className="w-4 h-4" />}
                    badge={
                      <Badge color={data.seasonality_tests.has_seasonality ? "green" : "gray"}>
                        {data.seasonality_tests.has_seasonality ? `Period ${data.seasonality_tests.dominant_period}` : "None"}
                      </Badge>
                    }
                  >
                    <SeasonalityPanel
                      seasonality={data.seasonality_tests}
                      spectral={data.spectral}
                      decomp={data.decomposition}
                    />
                  </Section>
                )}

                {data.decomposition && (
                  <Section 
                    title="STL Decomposition" 
                    icon={<GitBranch className="w-4 h-4" />}
                    badge={<Badge color="blue">{data.decomposition.method ?? "Unknown"}</Badge>}
                  >
                    <DecompositionChart decomp={data.decomposition} />
                  </Section>
                )}

                {(data.acf_pacf_full?.acf || data.acf) && (
                  <Section title="Autocorrelation (ACF / PACF)" icon={<BarChart2 className="w-4 h-4" />}>
                    <div className="grid grid-cols-2 gap-4">
                      {(data.acf_pacf_full?.acf ?? data.acf) && (
                        <CorrelogramChart
                          title="ACF"
                          values={data.acf_pacf_full?.acf?.values ?? data.acf?.values}
                          ciUpper={data.acf_pacf_full?.acf?.ci_upper}
                          ciLower={data.acf_pacf_full?.acf?.ci_lower}
                          confThreshold={data.acf_pacf_full?.acf?.conf_threshold}
                          significantLags={data.acf_pacf_full?.acf?.significant_lags}
                        />
                      )}
                      {(data.acf_pacf_full?.pacf ?? data.pacf) && (
                        <CorrelogramChart
                          title="PACF"
                          values={data.acf_pacf_full?.pacf?.values ?? data.pacf?.values}
                          ciUpper={data.acf_pacf_full?.pacf?.ci_upper}
                          ciLower={data.acf_pacf_full?.pacf?.ci_lower}
                          significantLags={data.acf_pacf_full?.pacf?.significant_lags}
                        />
                      )}
                    </div>
                    <ArimaHintsPanel hints={data.acf_pacf_full?.arima_hints} />
                  </Section>
                )}

                {data.rolling_full && (
                  <Section title="Rolling Statistics & Volatility" icon={<Zap className="w-4 h-4" />}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Annualised Rolling Volatility</p>
                    <VolatilityChart rolling={data.rolling_full} />
                  </Section>
                )}

                {data.lag_analysis && safeLength(data.lag_analysis.lags) > 0 && (
                  <Section title="Lag Feature Correlation" icon={<Clock className="w-4 h-4" />}>
                    <p className="text-xs text-muted-foreground mb-3">Pearson r and Spearman ρ between the series and its lagged versions — guides lag feature selection for ML models.</p>
                    <LagCorrelationChart lagAnalysis={data.lag_analysis} />
                  </Section>
                )}

                {data.anomalies_full && (
                  <Section 
                    title="Anomaly Detection"
                    icon={<AlertTriangle className="w-4 h-4" />}
                    badge={
                      <Badge color={((data.anomalies_full.total_anomalies ?? 0) > 0) ? "red" : "green"}>
                        {data.anomalies_full.total_anomalies ?? 0} found
                      </Badge>
                    }
                  >
                    <AnomalyPanel anomaliesFull={data.anomalies_full} data={data} />
                  </Section>
                )}

                {data.change_points && (
                  <Section 
                    title="Change Point Detection"
                    icon={<GitBranch className="w-4 h-4" />}
                    badge={
                      <Badge color={safeLength(data.change_points.change_points) > 0 ? "yellow" : "gray"}>
                        {safeLength(data.change_points.change_points)} points
                      </Badge>
                    }
                  >
                    <ChangePointPanel changePoints={data.change_points} />
                  </Section>
                )}

                {data.normality_tests && Object.keys(data.normality_tests).length > 0 && (
                  <Section title="Normality Tests" icon={<FlaskConical className="w-4 h-4" />} defaultOpen={false}>
                    <NormalityPanel normality={data.normality_tests} />
                  </Section>
                )}

                {data.granger_causality && Object.keys(data.granger_causality).length > 0 && (
                  <Section title="Granger Causality" icon={<Target className="w-4 h-4" />} defaultOpen={false}>
                    <GrangerPanel granger={data.granger_causality} />
                  </Section>
                )}

                {data.forecasting_readiness && (
                  <Section 
                    title="Forecasting Readiness & Model Recommendations"
                    icon={<Target className="w-4 h-4" />}
                    badge={
                      Array.isArray(data.forecasting_readiness.issues) && data.forecasting_readiness.issues.length === 0
                        ? <Badge color="green">Ready</Badge>
                        : <Badge color="yellow">{Array.isArray(data.forecasting_readiness.issues) ? data.forecasting_readiness.issues.length : 0} issue{(Array.isArray(data.forecasting_readiness.issues) ? data.forecasting_readiness.issues.length : 0) !== 1 ? "s" : ""}</Badge>
                    }
                  >
                    <ForecastingReadinessPanel readiness={data.forecasting_readiness} />
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}