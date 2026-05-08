"use client";

import { useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { ChartCard, SectionHeader } from "@/components/analysis/ChartCard";
import type {
  FullAnalysisResult,
  NumericCharts,
  CategoricalCharts,
  DatetimeCharts,
} from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
  ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  BarChart2, BoxSelect, Activity, TrendingUp, GitMerge,
  Layers, Calendar, Table2, AlertTriangle, ChevronRight,
  Eye, EyeOff, Filter, Download, RefreshCw, Info,
  Hash, Type, Clock, Sigma, Maximize2,
} from "lucide-react";

// ─── Plotly (SSR-safe) ────────────────────────────────────────────────────────
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary:   "#1D4ED8",
  secondary: "#7C3AED",
  accent:    "#0891B2",
  success:   "#059669",
  warning:   "#D97706",
  danger:    "#DC2626",
  muted:     "#64748B",
  surface:   "#F8FAFC",
  border:    "#E2E8F0",
};

const PALETTE = [
  "#1D4ED8", "#7C3AED", "#0891B2", "#059669",
  "#D97706", "#DC2626", "#DB2777", "#2563EB",
  "#7C3AED", "#0D9488",
];

// ─── Plotly base config ───────────────────────────────────────────────────────
const BASE_LAYOUT: Partial<Plotly.Layout> = {
  margin: { l: 50, r: 20, t: 24, b: 50 },
  font: { size: 11, family: "'DM Sans', sans-serif" },
  paper_bgcolor: "transparent",
  plot_bgcolor:  "transparent",
  showlegend: true,
  legend: { bgcolor: "transparent", font: { size: 10 } },
  xaxis: { gridcolor: "#F1F5F9", zerolinecolor: "#E2E8F0" },
  yaxis: { gridcolor: "#F1F5F9", zerolinecolor: "#E2E8F0" },
};

const PLOT_CFG: Partial<Plotly.Config> = {
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d", "toImage"],
  responsive: true,
};

const PLOT_STYLE = { width: "100%", height: "280px" };

// ─── Shared empty state ───────────────────────────────────────────────────────
function Empty({ msg = "Insufficient data" }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
      <Info className="w-6 h-6" />
      <span className="text-xs">{msg}</span>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function Pill({
  label, value, color = C.primary,
}: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 min-w-[72px]">
      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
      <span className="text-sm font-bold mt-0.5" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── Insight badge ────────────────────────────────────────────────────────────
function Insight({ text, level = "warning" }: { text: string; level?: "warning" | "danger" | "info" }) {
  const map = {
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    danger:  "bg-red-50 border-red-200 text-red-700",
    info:    "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={`flex items-start gap-1.5 text-[10px] px-2.5 py-1.5 rounded border mt-2 ${map[level]}`}>
      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVARIATE — NUMERIC
// ═══════════════════════════════════════════════════════════════════════════════

function HistKDE({ data, col }: { data: NumericCharts["histogram_kde"]; col: string }) {
  if (!data?.bins?.length) return <Empty />;
  const traces: Plotly.Data[] = [
    { x: data.bins, y: data.counts, type: "bar", name: "Frequency",
      marker: { color: C.primary, opacity: 0.75 } },
  ];
  if (data.kde_x?.length) {
    traces.push({ x: data.kde_x, y: data.kde_y, type: "scatter", mode: "lines",
      name: "KDE", line: { color: C.danger, width: 2.5 }, yaxis: "y2" });
  }
  const shapes: Partial<Plotly.Shape>[] = [];
  if (data.mean != null) shapes.push({
    type: "line", x0: data.mean, x1: data.mean, y0: 0, y1: 1, yref: "paper",
    line: { color: C.warning, width: 1.5, dash: "dash" },
  });
  if (data.median != null) shapes.push({
    type: "line", x0: data.median, x1: data.median, y0: 0, y1: 1, yref: "paper",
    line: { color: C.success, width: 1.5, dash: "dot" },
  });
  return (
    <Plot data={traces}
      layout={{ ...BASE_LAYOUT, shapes, xaxis: { title: col }, yaxis: { title: "Count" },
        yaxis2: { overlaying: "y", side: "right", showgrid: false, title: "Density" },
        legend: { orientation: "h", y: -0.25 } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

function BoxPlot({ data, col }: { data: NumericCharts["box"]; col: string }) {
  if (!data?.q1) return <Empty />;
  return (
    <Plot
      data={[{
        type: "box",
        y: [...(data.outliers as number[] ?? []), data.min!, data.q1!, data.median!, data.q3!, data.max!],
        q1: [data.q1!], median: [data.median!], q3: [data.q3!],
        lowerfence: [data.min!], upperfence: [data.max!],
        mean: [data.mean ?? data.median!], name: col,
        marker: { color: C.primary, outliercolor: C.danger, size: 4 },
        line: { color: C.primary }, boxpoints: "outliers", jitter: 0.4,
      } as Plotly.Data]}
      layout={{ ...BASE_LAYOUT, yaxis: { title: col } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

function ViolinPlot({ data, col }: { data: NumericCharts["violin"]; col: string }) {
  if (!data?.y?.length) return <Empty />;
  return (
    <Plot
      data={[{
        type: "violin", y: data.y, name: col,
        box: { visible: true }, meanline: { visible: true },
        line: { color: C.secondary }, fillcolor: C.secondary, opacity: 0.55,
        points: "outliers",
      } as Plotly.Data]}
      layout={{ ...BASE_LAYOUT, yaxis: { title: col } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

function QQPlot({ data }: { data: NumericCharts["qq"] }) {
  if (!data?.theoretical?.length) return <Empty />;
  return (
    <Plot
      data={[
        { x: data.theoretical, y: data.sample, mode: "markers", type: "scatter",
          name: "Sample", marker: { color: C.primary, size: 4, opacity: 0.55 } },
        { x: data.line_x, y: data.line_y, mode: "lines", type: "scatter",
          name: "Normal line", line: { color: C.danger, width: 2 } },
      ]}
      layout={{ ...BASE_LAYOUT,
        xaxis: { title: "Theoretical quantiles" }, yaxis: { title: "Sample quantiles" },
        legend: { orientation: "h", y: -0.25 } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

function ECDFPlot({ data, col }: { data: NumericCharts["ecdf"]; col: string }) {
  if (!data?.x?.length) return <Empty />;
  return (
    <Plot
      data={[{
        x: data.x, y: data.y, mode: "lines", type: "scatter", name: "ECDF",
        line: { color: C.accent, width: 2.5, shape: "hv" },
        fill: "tozeroy", fillcolor: `${C.accent}18`,
      }]}
      layout={{ ...BASE_LAYOUT, xaxis: { title: col },
        yaxis: { title: "Cumulative probability", range: [0, 1] } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

// Numeric stats summary row
function NumericStatRow({ data, col }: { data: NumericCharts; col: string }) {
  const stats = [
    { label: "Mean",     value: data.histogram_kde?.mean?.toFixed(3)   ?? "--" },
    { label: "Median",   value: data.histogram_kde?.median?.toFixed(3) ?? "--" },
    { label: "Std Dev",  value: data.std?.toFixed(3)                   ?? "--" },
    { label: "Skewness", value: data.skewness?.toFixed(3)              ?? "--",
      color: Math.abs(data.skewness ?? 0) > 1 ? C.danger : Math.abs(data.skewness ?? 0) > 0.5 ? C.warning : C.success },
    { label: "Kurtosis", value: data.kurtosis?.toFixed(3)              ?? "--" },
    { label: "Min",      value: data.box?.min?.toFixed(3)              ?? "--" },
    { label: "Max",      value: data.box?.max?.toFixed(3)              ?? "--" },
  ];
  return (
    <div className="flex flex-wrap gap-2 px-1 pb-1">
      {stats.map((s) => <Pill key={s.label} label={s.label} value={s.value} color={s.color} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVARIATE — CATEGORICAL
// ═══════════════════════════════════════════════════════════════════════════════

function CatBar({ data, col }: { data: CategoricalCharts["bar"]; col: string }) {
  if (!data?.labels?.length) return <Empty />;
  const rows = data.labels.map((l, i) => ({
    label: l.length > 22 ? l.slice(0, 20) + "…" : l,
    value: data.values[i],
    pct: data.percentages[i],
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} layout="vertical" margin={{ left: 100, right: 30 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
        <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "#374151" }} width={100} />
        <Tooltip
          formatter={(v: number, _n, p) => [`${v.toLocaleString()} (${p.payload.pct?.toFixed(1)}%)`, col]}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}` }}
        />
        <Bar dataKey="value" fill={C.primary} radius={[0, 6, 6, 0]}
          background={{ fill: "#F1F5F9", radius: [0, 6, 6, 0] }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CatPie({ data }: { data: CategoricalCharts["pie"] }) {
  if (!data?.labels?.length) return <Empty />;
  const rows = data.labels.map((l, i) => ({ name: l, value: data.values[i] }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%"
          outerRadius={100} innerRadius={48} paddingAngle={2}>
          {rows.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => v.toLocaleString()}
          contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ParetoPlot({ data }: { data: CategoricalCharts["pareto"] }) {
  if (!data?.labels?.length) return <Empty />;
  const rows = data.labels.map((l, i) => ({
    label: l.length > 14 ? l.slice(0, 12) + "…" : l,
    value: data.values[i],
    cumPct: data.cumulative_pct[i],
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ bottom: 44, right: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" />
        <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]}
          tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Bar yAxisId="l" dataKey="value" fill={C.primary} opacity={0.85} radius={[4, 4, 0, 0]} />
        <Line yAxisId="r" type="monotone" dataKey="cumPct"
          stroke={C.danger} strokeWidth={2} dot={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVARIATE — DATETIME
// ═══════════════════════════════════════════════════════════════════════════════

function TimeSeriesLine({ data }: { data: DatetimeCharts["timeseries"] }) {
  if (!data?.dates?.length) return <Empty />;
  const rows = data.dates.map((d, i) => ({ date: d, value: data.values[i] }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Line type="monotone" dataKey="value" stroke={C.primary}
          strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SeasonalityGrid({ data }: { data: DatetimeCharts["seasonality"] }) {
  if (!data?.by_hour) return <Empty />;
  const charts = [
    { title: "By Hour",        items: data.by_hour },
    { title: "By Day of Week", items: data.by_dow },
    { title: "By Month",       items: data.by_month },
  ];
  return (
    <div className="grid grid-cols-3 gap-4 w-full">
      {charts.map(({ title, items }) => (
        <div key={title}>
          <p className="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{title}</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={items.labels.map((l, i) => ({ l, v: items.values[i] }))}
              margin={{ bottom: 22 }}>
              <XAxis dataKey="l" tick={{ fontSize: 8 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 8 }} />
              <Bar dataKey="v" fill={C.accent} opacity={0.85} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIVARIATE
// ═══════════════════════════════════════════════════════════════════════════════

function ScatterPair({ pair }: { pair: FullAnalysisResult["multi_column"]["scatter_pairs"][0] }) {
  if (!pair?.x?.length) return <Empty />;
  const traces: Plotly.Data[] = [
    { x: pair.x, y: pair.y, mode: "markers", type: "scatter", name: "Data",
      marker: { color: C.primary, size: 5, opacity: 0.5 } },
  ];
  if (pair.line_x?.length) {
    traces.push({ x: pair.line_x, y: pair.line_y, mode: "lines", type: "scatter",
      name: `Trend (R²=${pair.r2?.toFixed(2) ?? "?"})`,
      line: { color: C.danger, width: 2, dash: "dash" } });
  }
  return (
    <>
      <div className="flex gap-2 px-1 mb-2">
        <Pill label="Pearson r" value={pair.pearson_r?.toFixed(3) ?? "--"}
          color={Math.abs(pair.pearson_r ?? 0) > 0.7 ? C.danger : Math.abs(pair.pearson_r ?? 0) > 0.4 ? C.warning : C.muted} />
        <Pill label="R²" value={pair.r2?.toFixed(3) ?? "--"} />
      </div>
      <Plot data={traces}
        layout={{ ...BASE_LAYOUT, xaxis: { title: pair.col1 }, yaxis: { title: pair.col2 },
          legend: { orientation: "h", y: -0.25 } }}
        config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
    </>
  );
}

function GroupedBox({ data }: { data: FullAnalysisResult["multi_column"]["grouped_box"] }) {
  if (!data?.groups || !Object.keys(data.groups).length) return <Empty />;
  const traces: Plotly.Data[] = Object.entries(data.groups).map(([grp, stats], i) => ({
    type: "box",
    y: [stats.min!, stats.q1!, stats.median!, stats.q3!, stats.max!, ...(stats.outliers as number[] ?? [])],
    q1: [stats.q1!], median: [stats.median!], q3: [stats.q3!],
    lowerfence: [stats.min!], upperfence: [stats.max!],
    name: grp, marker: { color: PALETTE[i % PALETTE.length] },
    boxpoints: "outliers",
  } as Plotly.Data));
  return (
    <Plot data={traces}
      layout={{ ...BASE_LAYOUT, yaxis: { title: data.numeric_col },
        xaxis: { title: data.categorical_col }, boxmode: "group" }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTIVARIATE
// ═══════════════════════════════════════════════════════════════════════════════

function CorrelationHeatmap({ data }: { data: FullAnalysisResult["multi_column"]["correlation"] }) {
  if (!data?.labels?.length) return <Empty msg="Need 2+ numeric columns" />;
  return (
    <Plot
      data={[{
        z: data.z, x: data.labels, y: data.labels,
        type: "heatmap",
        colorscale: [[0, C.danger], [0.5, "#ffffff"], [1, C.primary]],
        zmin: -1, zmax: 1,
        text: (data.z as number[][]).map((row) =>
          row.map((v) => (v != null ? v.toFixed(2) : ""))) as Plotly.Data["text"],
        texttemplate: "%{text}",
        hovertemplate: "%{x} × %{y}: %{z:.3f}<extra></extra>",
        colorbar: { thickness: 12, len: 0.8, tickfont: { size: 10 } },
      } as Plotly.Data]}
      layout={{ ...BASE_LAYOUT, xaxis: { tickangle: -35 }, yaxis: { tickangle: 0 } }}
      config={PLOT_CFG} style={{ width: "100%", height: "360px" }} useResizeHandler />
  );
}

// Radar chart for column-level stats overview
function ColumnRadar({ data }: { data: FullAnalysisResult }) {
  const rows = data.stat_cards?.normality_table?.map((r) => ({
    col: r.column.length > 12 ? r.column.slice(0, 10) + "…" : r.column,
    skewness: Math.abs(r.skewness ?? 0),
    kurtosis: Math.min(Math.abs((r.kurtosis ?? 3) - 3) / 5, 1),
    outlierPct: (data.stat_cards.outlier_summary.find((o) => o.column === r.column)?.outlier_pct ?? 0) / 100,
    missingPct: (data.missing_charts?.bar?.find((m) => m.column === r.column)?.missing_pct ?? 0) / 100,
    normality: r.is_normal ? 1 : 0,
  })) ?? [];

  if (!rows.length) return <Empty msg="No numeric columns for radar" />;

  // Build one radar per column -- cap at 6 columns
  const cols = rows.slice(0, 6);
  return (
    <div className="grid grid-cols-3 gap-3">
      {cols.map((r) => (
        <div key={r.col} className="flex flex-col items-center">
          <p className="text-[10px] font-semibold text-slate-500 mb-1">{r.col}</p>
          <RadarChart width={160} height={130}
            data={[
              { dim: "Skew",    v: Math.min(r.skewness, 1) },
              { dim: "Kurt",    v: r.kurtosis },
              { dim: "Outlier", v: r.outlierPct },
              { dim: "Missing", v: r.missingPct },
              { dim: "Normal",  v: r.normality },
            ]}>
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis dataKey="dim" tick={{ fontSize: 8, fill: C.muted }} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            <Radar name={r.col} dataKey="v" stroke={C.primary}
              fill={C.primary} fillOpacity={0.25} />
          </RadarChart>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT TABLES
// ═══════════════════════════════════════════════════════════════════════════════

function NormalityTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["normality_table"] }) {
  if (!rows.length) return <Empty msg="No numeric columns" />;
  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] border-separate border-spacing-0">
        <thead>
          <tr>
            {["Column", "n", "Test", "p-value", "Normal?", "Skewness", "Kurtosis"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-slate-400 font-semibold text-[10px] uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.column} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              <td className="px-3 py-2 font-mono font-semibold text-slate-800">{r.column}</td>
              <td className="px-3 py-2 text-slate-500">{r.n.toLocaleString()}</td>
              <td className="px-3 py-2 text-slate-400 uppercase text-[10px]">{r.test}</td>
              <td className="px-3 py-2 text-slate-600">{r.p_value?.toFixed(4) ?? "--"}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  r.is_normal ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}>
                  {r.is_normal === null ? "?" : r.is_normal ? "✓ Yes" : "✗ No"}
                </span>
              </td>
              <td className={`px-3 py-2 font-semibold ${
                Math.abs(r.skewness ?? 0) > 1 ? "text-red-600" :
                Math.abs(r.skewness ?? 0) > 0.5 ? "text-amber-600" : "text-emerald-600"
              }`}>{r.skewness?.toFixed(3) ?? "--"}</td>
              <td className="px-3 py-2 text-slate-500">{r.kurtosis?.toFixed(3) ?? "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutlierTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["outlier_summary"] }) {
  if (!rows.length) return <Empty msg="No numeric columns" />;
  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] border-separate border-spacing-0">
        <thead>
          <tr>
            {["Column", "Outliers (n)", "Outlier %", "Lower Fence", "Upper Fence"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-slate-400 font-semibold text-[10px] uppercase tracking-wide border-b border-slate-100 bg-slate-50">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.column} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              <td className="px-3 py-2 font-mono font-semibold text-slate-800">{r.column}</td>
              <td className="px-3 py-2 text-slate-600">{r.outlier_count.toLocaleString()}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(r.outlier_pct ?? 0, 100)}%`,
                        background: (r.outlier_pct ?? 0) > 10 ? C.danger : (r.outlier_pct ?? 0) > 5 ? C.warning : C.success,
                      }} />
                  </div>
                  <span className={`font-semibold ${(r.outlier_pct ?? 0) > 10 ? "text-red-600" : (r.outlier_pct ?? 0) > 5 ? "text-amber-600" : "text-slate-600"}`}>
                    {r.outlier_pct?.toFixed(2) ?? "--"}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-slate-400 font-mono">{r.lower_bound?.toFixed(3) ?? "--"}</td>
              <td className="px-3 py-2 text-slate-400 font-mono">{r.upper_bound?.toFixed(3) ?? "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardinalityTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["cardinality"] }) {
  const FLAG: Record<string, { cls: string; label: string }> = {
    id_like:         { cls: "bg-purple-100 text-purple-700",  label: "ID-like" },
    constant:        { cls: "bg-slate-100 text-slate-500",    label: "Constant" },
    binary:          { cls: "bg-sky-100 text-sky-700",        label: "Binary" },
    low_cardinality: { cls: "bg-emerald-100 text-emerald-700",label: "Low-card" },
    normal:          { cls: "bg-white text-slate-500 border border-slate-200", label: "Normal" },
  };
  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] border-separate border-spacing-0">
        <thead>
          <tr>
            {["Column", "Dtype", "Unique (n)", "Unique %", "Flag"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-slate-400 font-semibold text-[10px] uppercase tracking-wide border-b border-slate-100 bg-slate-50">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const f = FLAG[r.flag] ?? FLAG.normal;
            return (
              <tr key={r.column} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="px-3 py-2 font-mono font-semibold text-slate-800">{r.column}</td>
                <td className="px-3 py-2 text-slate-400 font-mono">{r.dtype}</td>
                <td className="px-3 py-2 text-slate-600">{r.unique_count.toLocaleString()}</td>
                <td className="px-3 py-2 text-slate-600">{r.unique_pct?.toFixed(1) ?? "--"}%</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${f.cls}`}>{f.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MissingTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["missing_bar"] }) {
  if (!rows.length) return (
    <div className="flex items-center justify-center h-32 gap-2 text-emerald-600">
      <span className="text-lg">✓</span>
      <span className="text-sm font-semibold">No missing values — dataset is complete</span>
    </div>
  );
  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] border-separate border-spacing-0">
        <thead>
          <tr>
            {["Column", "Missing (n)", "Visual", "%"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-slate-400 font-semibold text-[10px] uppercase tracking-wide border-b border-slate-100 bg-slate-50">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.column} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              <td className="px-3 py-2 font-mono font-semibold text-slate-800">{r.column}</td>
              <td className="px-3 py-2 text-slate-500">{r.missing_count.toLocaleString()}</td>
              <td className="px-3 py-2 w-48">
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(r.missing_pct ?? 0, 100)}%`,
                      background: (r.missing_pct ?? 0) > 50 ? C.danger : (r.missing_pct ?? 0) > 20 ? C.warning : C.primary,
                    }} />
                </div>
              </td>
              <td className="px-3 py-2 font-semibold"
                style={{ color: (r.missing_pct ?? 0) > 50 ? C.danger : (r.missing_pct ?? 0) > 20 ? C.warning : C.muted }}>
                {r.missing_pct?.toFixed(1) ?? "--"}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

type AnalysisTab = "univariate" | "bivariate" | "multivariate" | "quality";

const TAB_META: { key: AnalysisTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "univariate",   label: "Univariate",   icon: <BarChart2 className="w-4 h-4" />,  desc: "Single column distributions" },
  { key: "bivariate",   label: "Bivariate",   icon: <GitMerge className="w-4 h-4" />,   desc: "Pair relationships" },
  { key: "multivariate",label: "Multivariate", icon: <Layers className="w-4 h-4" />,     desc: "Multi-column patterns" },
  { key: "quality",     label: "Data Quality", icon: <Table2 className="w-4 h-4" />,     desc: "Missing, outliers, normality" },
];

type ChartKey = "histogram" | "box" | "violin" | "qq" | "ecdf"
  | "bar" | "pie" | "pareto"
  | "timeseries" | "seasonality"
  | "scatter" | "grouped_box"
  | "correlation" | "radar";

const CHART_LABELS: Record<ChartKey, string> = {
  histogram: "Histogram + KDE",
  box:       "Box Plot",
  violin:    "Violin Plot",
  qq:        "QQ Plot",
  ecdf:      "ECDF",
  bar:       "Bar Chart",
  pie:       "Pie / Donut",
  pareto:    "Pareto Chart",
  timeseries:"Time Series",
  seasonality:"Seasonality",
  scatter:   "Scatter + Trend",
  grouped_box:"Grouped Box",
  correlation:"Correlation Heatmap",
  radar:     "Column Radar",
};

function Sidebar({
  data, activeTab, setActiveTab,
  visibleCols, toggleCol,
  visibleCharts, toggleChart,
}: {
  data: FullAnalysisResult;
  activeTab: AnalysisTab; setActiveTab: (t: AnalysisTab) => void;
  visibleCols: Set<string>; toggleCol: (c: string) => void;
  visibleCharts: Set<ChartKey>; toggleChart: (k: ChartKey) => void;
}) {
  const allCols = [...data.numeric_cols, ...data.categorical_cols, ...data.datetime_cols];
  const allOn = allCols.every((c) => visibleCols.has(c));
  const TYPE_ICON: Record<string, React.ReactNode> = {
    numeric:     <Hash className="w-2.5 h-2.5 text-blue-500" />,
    categorical: <Type className="w-2.5 h-2.5 text-violet-500" />,
    datetime:    <Clock className="w-2.5 h-2.5 text-cyan-500" />,
  };

  // Charts relevant per tab
  const tabCharts: Record<AnalysisTab, ChartKey[]> = {
    univariate:   ["histogram", "box", "violin", "qq", "ecdf", "bar", "pie", "pareto", "timeseries", "seasonality"],
    bivariate:    ["scatter", "grouped_box"],
    multivariate: ["correlation", "radar"],
    quality:      [],
  };
  const chartsForTab = tabCharts[activeTab];

  return (
    <aside className="w-60 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
      {/* Tab switcher */}
      <div className="border-b border-slate-100">
        {TAB_META.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
              activeTab === t.key
                ? "bg-blue-50 border-r-2 border-blue-600 text-blue-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}>
            <span className={activeTab === t.key ? "text-blue-600" : "text-slate-400"}>{t.icon}</span>
            <div>
              <p className="text-xs font-semibold">{t.label}</p>
              <p className="text-[9px] text-slate-400">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Columns filter */}
      <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Columns</p>
          <button onClick={() => allCols.forEach((c) => { if (allOn === visibleCols.has(c)) toggleCol(c); })}
            className="text-[10px] text-blue-600 hover:underline">
            {allOn ? "Hide all" : "Show all"}
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {allCols.map((col) => {
            const t = data.column_types[col];
            return (
              <label key={col} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={visibleCols.has(col)}
                  onChange={() => toggleCol(col)} className="accent-blue-600 w-3 h-3" />
                <span className="flex-shrink-0">{TYPE_ICON[t] ?? <Sigma className="w-2.5 h-2.5 text-slate-400" />}</span>
                <span className="text-[11px] text-slate-700 truncate">{col}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Chart type toggles */}
      {chartsForTab.length > 0 && (
        <div className="px-3 py-2 flex-1 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Chart Types</p>
          <div className="space-y-0.5">
            {chartsForTab.map((k) => (
              <label key={k} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={visibleCharts.has(k)}
                  onChange={() => toggleChart(k)} className="accent-blue-600 w-3 h-3" />
                <span className="text-[11px] text-slate-600">{CHART_LABELS[k]}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════
function Card({
  title, desc, insight, insightLevel, wide, children,
}: {
  title: string; desc?: string; insight?: string;
  insightLevel?: "warning" | "danger" | "info";
  wide?: boolean; children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${wide ? "col-span-2" : ""}`}>
      <div className="flex items-start justify-between px-4 pt-3 pb-2 border-b border-slate-50">
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-800">{title}</p>
          {desc && <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>}
          {insight && <Insight text={insight} level={insightLevel ?? "warning"} />}
        </div>
        <button onClick={() => setExpanded((v) => !v)}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 ml-2 flex-shrink-0">
          {expanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      {expanded && <div className="p-4">{children}</div>}
    </div>
  );
}

function TabHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="col-span-2 flex items-center gap-3 mt-2 mb-1">
      <div className="h-px flex-1 bg-slate-100" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2">
        {label}{count !== undefined && <span className="ml-1 text-slate-300">({count})</span>}
      </span>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY BANNER
// ═══════════════════════════════════════════════════════════════════════════════
function SummaryBanner({ data }: { data: FullAnalysisResult }) {
  const numericCount  = data.numeric_cols.length;
  const catCount      = data.categorical_cols.length;
  const dtCount       = data.datetime_cols.length;
  const missingCols   = data.missing_charts?.bar?.filter((r) => (r.missing_pct ?? 0) > 0).length ?? 0;
  const highOutlier   = data.stat_cards?.outlier_summary?.filter((r) => (r.outlier_pct ?? 0) > 10).length ?? 0;
  const nonNormal     = data.stat_cards?.normality_table?.filter((r) => r.is_normal === false).length ?? 0;

  const stats = [
    { label: "Rows",         value: data.total_rows?.toLocaleString() ?? "--",  color: C.primary },
    { label: "Columns",      value: (numericCount + catCount + dtCount).toString(), color: C.primary },
    { label: "Numeric",      value: numericCount.toString(),  color: C.accent },
    { label: "Categorical",  value: catCount.toString(),      color: C.secondary },
    { label: "Datetime",     value: dtCount.toString(),       color: "#0891B2" },
    { label: "Missing Cols", value: missingCols.toString(),   color: missingCols > 0 ? C.warning : C.success },
    { label: "High Outlier", value: highOutlier.toString(),   color: highOutlier > 0 ? C.danger : C.success },
    { label: "Non-Normal",   value: nonNormal.toString(),     color: nonNormal > 3 ? C.warning : C.muted },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{s.label}</span>
          <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
        </div>
      ))}
      {data.sampled && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-700 text-[10px] font-medium">
          <Info className="w-3 h-3" />
          Sample: {data.sample_size?.toLocaleString()} / {data.total_rows?.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AnalysisPage() {
  const { datasetId } = useParams<{ datasetId: string }>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.eda.analysis(datasetId),
    queryFn: () => datasetsApi.getAnalysis(datasetId).then((r) => r.data as FullAnalysisResult),
    staleTime: 1000 * 60 * 10,
  });

  const allCols = useMemo(() => {
    if (!data) return [];
    return [...data.numeric_cols, ...data.categorical_cols, ...data.datetime_cols];
  }, [data]);

  const [activeTab, setActiveTab] = useState<AnalysisTab>("univariate");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [visibleCharts, setVisibleCharts] = useState<Set<ChartKey>>(
    new Set(Object.keys(CHART_LABELS) as ChartKey[])
  );

  useMemo(() => {
    if (allCols.length > 0 && visibleCols.size === 0) setVisibleCols(new Set(allCols));
  }, [allCols]);

  function toggleCol(col: string) {
    setVisibleCols((p) => { const n = new Set(p); n.has(col) ? n.delete(col) : n.add(col); return n; });
  }
  function toggleChart(k: ChartKey) {
    setVisibleCharts((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  const show = (k: ChartKey) => visibleCharts.has(k);
  const colOn = (c: string) => visibleCols.has(c);

  // ─────────────────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <SubNav datasetId={datasetId} />
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <PageSpinner />
        <p className="text-sm text-slate-400 animate-pulse">Computing analysis…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <SubNav datasetId={datasetId} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-500 font-semibold text-sm">Analysis failed</p>
          <p className="text-slate-400 text-xs">{(error as Error).message}</p>
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <SubNav datasetId={datasetId} />

      {data && (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            data={data}
            activeTab={activeTab} setActiveTab={setActiveTab}
            visibleCols={visibleCols} toggleCol={toggleCol}
            visibleCharts={visibleCharts} toggleChart={toggleChart}
          />

          {/* ── Main content ── */}
          <main className="flex-1 overflow-y-auto p-5">
            <SummaryBanner data={data} />

            {/* ══════════ UNIVARIATE TAB ══════════ */}
            {activeTab === "univariate" && (
              <div className="grid grid-cols-2 gap-4">

                {/* Numeric columns */}
                {data.numeric_cols.filter(colOn).map((col) => {
                  const charts = data.numeric_charts[col];
                  if (!charts) return null;
                  const highSkew = Math.abs(charts.skewness ?? 0) > 1;
                  return (
                    <div key={col} className="contents">
                      <TabHeader label={`${col} — numeric`} />

                      {/* Stats row always visible */}
                      <div className="col-span-2">
                        <NumericStatRow data={charts} col={col} />
                      </div>

                      {show("histogram") && (
                        <Card title={`Histogram + KDE — ${col}`}
                          desc="Frequency distribution with kernel density estimate, mean (dashed) & median (dotted)"
                          insight={highSkew ? `Skewness ${charts.skewness?.toFixed(2)} — distribution is ${(charts.skewness ?? 0) > 0 ? "right" : "left"}-skewed` : undefined}
                          insightLevel={Math.abs(charts.skewness ?? 0) > 2 ? "danger" : "warning"}>
                          <HistKDE data={charts.histogram_kde} col={col} />
                        </Card>
                      )}

                      {show("box") && (
                        <Card title={`Box Plot — ${col}`} desc="IQR box with whiskers and outlier dots">
                          <BoxPlot data={charts.box} col={col} />
                        </Card>
                      )}

                      {show("violin") && (
                        <Card title={`Violin Plot — ${col}`} desc="Full KDE distribution shape">
                          <ViolinPlot data={charts.violin} col={col} />
                        </Card>
                      )}

                      {show("qq") && (
                        <Card title={`QQ Plot — ${col}`}
                          desc="Sample vs. theoretical normal quantiles"
                          insight={charts.normality?.is_normal === false
                            ? `Not normally distributed (p = ${charts.normality.p_value?.toFixed(4)})` : undefined}
                          insightLevel="warning">
                          <QQPlot data={charts.qq} />
                        </Card>
                      )}

                      {show("ecdf") && (
                        <Card title={`ECDF — ${col}`} desc="Empirical cumulative distribution function">
                          <ECDFPlot data={charts.ecdf} col={col} />
                        </Card>
                      )}
                    </div>
                  );
                })}

                {/* Categorical columns */}
                {data.categorical_cols.filter(colOn).map((col) => {
                  const charts = data.categorical_charts[col];
                  if (!charts) return null;
                  const total = charts.bar.total_categories;
                  return (
                    <div key={col} className="contents">
                      <TabHeader label={`${col} — categorical`} />

                      {show("bar") && (
                        <Card title={`Bar Chart — ${col}`}
                          desc={`Top ${Math.min(total, 20)} of ${total} categories by frequency`}
                          insight={total > 50 ? `High cardinality: ${total} unique values` : undefined}
                          insightLevel="warning">
                          <CatBar data={charts.bar} col={col} />
                        </Card>
                      )}

                      {show("pie") && charts.pie && (
                        <Card title={`Pie / Donut — ${col}`} desc="Proportional share by category">
                          <CatPie data={charts.pie} />
                        </Card>
                      )}

                      {show("pareto") && (
                        <Card title={`Pareto — ${col}`} desc="Frequency bars + cumulative % line (80/20 analysis)" wide>
                          <ParetoPlot data={charts.pareto} />
                        </Card>
                      )}
                    </div>
                  );
                })}

                {/* Datetime columns */}
                {data.datetime_cols.filter(colOn).map((col) => {
                  const charts = data.datetime_charts[col];
                  if (!charts) return null;
                  return (
                    <div key={col} className="contents">
                      <TabHeader label={`${col} — datetime`} />

                      {show("timeseries") && (
                        <Card title={`Time Series — ${col}`}
                          desc="Event count over time (auto-aggregated by frequency)" wide>
                          <TimeSeriesLine data={charts.timeseries} />
                        </Card>
                      )}

                      {show("seasonality") && (
                        <Card title={`Seasonality — ${col}`}
                          desc="Count distribution by hour of day, day of week, and month" wide>
                          <SeasonalityGrid data={charts.seasonality} />
                        </Card>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ══════════ BIVARIATE TAB ══════════ */}
            {activeTab === "bivariate" && (
              <div className="grid grid-cols-2 gap-4">
                {show("scatter") && data.multi_column.scatter_pairs.length > 0 && (
                  <>
                    <TabHeader label="Scatter Plots + Trend Lines" count={data.multi_column.scatter_pairs.length} />
                    {data.multi_column.scatter_pairs.map((pair) => (
                      <Card key={`${pair.col1}-${pair.col2}`}
                        title={`${pair.col1} × ${pair.col2}`}
                        desc={`Scatter with linear trend. Pearson r = ${pair.pearson_r?.toFixed(3) ?? "?"}`}
                        insight={Math.abs(pair.pearson_r ?? 0) > 0.8
                          ? `Strong correlation (r = ${pair.pearson_r?.toFixed(3)})` : undefined}
                        insightLevel={Math.abs(pair.pearson_r ?? 0) > 0.9 ? "danger" : "warning"}>
                        <ScatterPair pair={pair} />
                      </Card>
                    ))}
                  </>
                )}

                {show("grouped_box") && data.multi_column.grouped_box?.groups && (
                  <>
                    <TabHeader label="Grouped Box Plot" />
                    <Card
                      title={`${data.multi_column.grouped_box.numeric_col} by ${data.multi_column.grouped_box.categorical_col}`}
                      desc="Distribution of highest-variance numeric column split by category" wide>
                      <GroupedBox data={data.multi_column.grouped_box} />
                    </Card>
                  </>
                )}

                {!data.multi_column.scatter_pairs.length && !data.multi_column.grouped_box?.groups && (
                  <div className="col-span-2">
                    <Empty msg="Need at least 2 numeric columns for bivariate analysis" />
                  </div>
                )}
              </div>
            )}

            {/* ══════════ MULTIVARIATE TAB ══════════ */}
            {activeTab === "multivariate" && (
              <div className="grid grid-cols-2 gap-4">
                {show("correlation") && (
                  <>
                    <TabHeader label="Correlation Matrix" />
                    <Card title="Pearson Correlation Heatmap"
                      desc="Pairwise linear correlation between all numeric columns. Range: −1 (red) to +1 (blue)"
                      wide
                      insight={
                        (() => {
                          const z = data.multi_column.correlation?.z as number[][] ?? [];
                          const labels = data.multi_column.correlation?.labels ?? [];
                          let strongPairs: string[] = [];
                          for (let i = 0; i < z.length; i++) for (let j = i + 1; j < z[i].length; j++) {
                            if (Math.abs(z[i][j]) > 0.85) strongPairs.push(`${labels[i]} & ${labels[j]}`);
                          }
                          return strongPairs.length ? `Highly correlated pairs: ${strongPairs.slice(0, 3).join(", ")}` : undefined;
                        })()
                      }
                      insightLevel="warning">
                      <CorrelationHeatmap data={data.multi_column.correlation} />
                    </Card>
                  </>
                )}

                {show("radar") && (
                  <>
                    <TabHeader label="Column Health Radar" />
                    <Card title="Column Quality Radar"
                      desc="Per-column overview of skewness, kurtosis, outlier %, missing %, and normality"
                      wide>
                      <ColumnRadar data={data} />
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* ══════════ DATA QUALITY TAB ══════════ */}
            {activeTab === "quality" && (
              <div className="grid grid-cols-2 gap-4">
                <TabHeader label="Missing Values" />
                <Card title="Missing Value Summary"
                  desc="Columns with missing data, sorted by percentage"
                  wide
                  insight={data.missing_charts.bar.some((r) => (r.missing_pct ?? 0) > 30)
                    ? "Some columns have >30% missing values. Consider imputation or removal."
                    : undefined}
                  insightLevel="warning">
                  <MissingTable rows={data.missing_charts.bar} />
                </Card>

                <TabHeader label="Normality Tests" />
                <Card title="Normality Tests (Shapiro-Wilk / D'Agostino K²)"
                  desc="Shapiro-Wilk for n < 5000, D'Agostino K² otherwise. p < 0.05 = non-normal."
                  wide
                  insight={(() => {
                    const nonNorm = data.stat_cards.normality_table.filter((r) => r.is_normal === false);
                    return nonNorm.length ? `${nonNorm.length} column(s) are non-normal: ${nonNorm.map((r) => r.column).slice(0, 3).join(", ")}` : undefined;
                  })()}
                  insightLevel="info">
                  <NormalityTable rows={data.stat_cards.normality_table} />
                </Card>

                <TabHeader label="Outlier Detection" />
                <Card title="Outlier Summary (IQR Method)"
                  desc="Outliers defined as values outside Q1 − 1.5×IQR and Q3 + 1.5×IQR"
                  wide
                  insight={(() => {
                    const severe = data.stat_cards.outlier_summary.filter((r) => (r.outlier_pct ?? 0) > 10);
                    return severe.length ? `${severe.length} column(s) have >10% outliers: ${severe.map((r) => r.column).join(", ")}` : undefined;
                  })()}
                  insightLevel="danger">
                  <OutlierTable rows={data.stat_cards.outlier_summary} />
                </Card>

                <TabHeader label="Cardinality" />
                <Card title="Column Cardinality Analysis"
                  desc="Unique value counts and type flags per column" wide>
                  <CardinalityTable rows={data.stat_cards.cardinality} />
                </Card>

                <TabHeader label="Duplicates" />
                <Card title="Duplicate Row Analysis"
                  desc="Count of exact-duplicate rows in the dataset"
                  insight={(data.stat_cards.duplicates.duplicate_pct ?? 0) > 5
                    ? `${data.stat_cards.duplicates.duplicate_pct?.toFixed(1)}% duplicate rows detected`
                    : undefined}
                  insightLevel="warning"
                  wide>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total Rows",  value: data.stat_cards.duplicates.total_rows.toLocaleString(),     color: C.primary },
                      { label: "Duplicates",  value: data.stat_cards.duplicates.duplicate_count.toLocaleString(), color: (data.stat_cards.duplicates.duplicate_pct ?? 0) > 5 ? C.danger : C.muted },
                      { label: "Dup %",       value: `${data.stat_cards.duplicates.duplicate_pct?.toFixed(2) ?? "0"}%`, color: (data.stat_cards.duplicates.duplicate_pct ?? 0) > 5 ? C.danger : C.success },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
                        <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}