"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Data, Layout, Config, Shape } from "plotly.js";
import { SubNav } from "@/components/layout/SubNav";
import { PageSpinner } from "@/components/shared/LoadingBar";
import type {
  FullAnalysisResult,
  NumericCharts,
  CategoricalCharts,
  DatetimeCharts,
} from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ScatterChart, Scatter as RScatter,
} from "recharts";
import {
  BarChart2, GitMerge, Layers, Table2, AlertTriangle,
  Eye, EyeOff, RefreshCw, Info,
  Hash, Type, Clock, Sigma, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

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

const BASE_LAYOUT: Partial<Layout> = {
  margin: { l: 50, r: 20, t: 24, b: 50 },
  font: { size: 11, family: "'DM Sans', sans-serif" },
  paper_bgcolor: "transparent",
  plot_bgcolor:  "transparent",
  showlegend: true,
  legend: { bgcolor: "transparent", font: { size: 10 } },
  xaxis: { gridcolor: "#F1F5F9", zerolinecolor: "#E2E8F0" },
  yaxis: { gridcolor: "#F1F5F9", zerolinecolor: "#E2E8F0" },
};

const PLOT_CFG: Partial<Config> = {
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d", "toImage"],
  responsive: true,
};

const PLOT_STYLE = { width: "100%", height: "280px" };

// ─── Shared primitives ────────────────────────────────────────────────────────
function Empty({ msg = "Insufficient data" }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/60">
      <Info className="w-6 h-6" />
      <span className="text-xs">{msg}</span>
    </div>
  );
}

function Pill({ label, value, color = C.primary }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center bg-muted rounded-lg px-3 py-2 border border-border min-w-[72px]">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <span className="text-sm font-bold mt-0.5" style={{ color }}>{value}</span>
    </div>
  );
}

function Insight({ text, level = "warning" }: { text: string; level?: "warning" | "danger" | "info" }) {
  const map = {
    warning: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
    danger:  "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400",
    info:    "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400",
  };
  return (
    <div className={`flex items-start gap-1.5 text-[10px] px-2.5 py-1.5 rounded border mt-2 ${map[level]}`}>
      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NUMERIC CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function HistKDE({ data, col }: { data: NumericCharts["histogram_kde"]; col: string }) {
  if (!data || !data.bins || data.bins.length === 0) return <Empty />;
  const traces: Data[] = [
    { x: data.bins || [], y: data.counts || [], type: "bar", name: "Frequency",
      marker: { color: C.primary, opacity: 0.75 } },
  ];
  if (data.kde_x?.length && data.kde_y?.length) {
    traces.push({
      x: data.kde_x, y: data.kde_y, type: "scatter", mode: "lines",
      name: "KDE", line: { color: C.danger, width: 2.5 }, yaxis: "y2",
    });
  }
  const shapes: Partial<Shape>[] = [];
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
  if (data?.q1 == null || data?.median == null || data?.q3 == null) return <Empty />;
  const outliers = (data.outliers ?? []).filter((v): v is number => v != null);
  return (
    <Plot
      data={[{
        type: "box",
        y: outliers,
        q1: [data.q1], median: [data.median], q3: [data.q3],
        lowerfence: [data.min ?? data.q1], upperfence: [data.max ?? data.q3],
        mean: [data.mean ?? data.median], name: col,
        marker: { color: C.primary, outliercolor: C.danger, size: 4 },
        line: { color: C.primary }, boxpoints: "outliers", jitter: 0.4,
      } as Data]}
      layout={{ ...BASE_LAYOUT, yaxis: { title: col } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

function ViolinChart({ data, col }: { data: NumericCharts["violin"]; col: string }) {
  if (!data?.y?.length) return <Empty />;
  return (
    <Plot
      data={[{
        type: "violin", y: data.y,
        x: Array(data.y.length).fill(col),
        name: col, box: { visible: true }, meanline: { visible: true },
        line: { color: C.secondary }, fillcolor: C.secondary, opacity: 0.55,
      } as any]}
      layout={{ ...BASE_LAYOUT, yaxis: { title: col } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

function QQPlot({ data, col }: { data: NumericCharts["qq"]; col: string }) {
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
        xaxis: { title: "Theoretical quantiles" },
        yaxis: { title: "Sample quantiles" },
        legend: { orientation: "h", y: -0.25 } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

function ECDFChart({ data, col }: { data: NumericCharts["ecdf"]; col: string }) {
  if (!data?.x?.length) return <Empty />;
  return (
    <Plot
      data={[{
        x: data.x, y: data.y, mode: "lines", type: "scatter", name: "ECDF",
        line: { color: C.accent, width: 2.5, shape: "hv" },
        fill: "tozeroy", fillcolor: `${C.accent}18`,
      }]}
      layout={{ ...BASE_LAYOUT,
        xaxis: { title: col },
        yaxis: { title: "Cumulative probability", range: [0, 1] } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

function StripPlot({ data, col }: { data: NumericCharts["violin"]; col: string }) {
  if (!data?.y?.length) return <Empty />;
  const maxPoints = 2000;
  const pts = data.y as number[];
  const sample = pts.length > maxPoints
    ? pts.filter((_, i) => i % Math.ceil(pts.length / maxPoints) === 0)
    : pts;
  return (
    <Plot
      data={[{
        x: sample.map(() => col), y: sample,
        type: "box", boxpoints: "all", jitter: 0.45, pointpos: 0,
        marker: { color: C.accent, size: 3, opacity: 0.35 },
        line: { color: "transparent" }, fillcolor: "transparent",
        name: col, showlegend: false,
      } as any]}
      layout={{ ...BASE_LAYOUT, yaxis: { title: col }, xaxis: { title: "" } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORICAL CHART COMPONENTS
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
        <Bar dataKey="value" fill={C.primary} radius={6} background={{ fill: "#F1F5F9" }} />
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

function TreemapChart({ data, col }: { data: CategoricalCharts["bar"]; col: string }) {
  if (!data?.labels?.length) return <Empty />;
  return (
    <Plot
      data={[{
        type: "treemap",
        labels: data.labels,
        values: data.values,
        parents: Array(data.labels.length).fill(""),
        textinfo: "label+percent parent",
        hovertemplate: "%{label}: %{value:,}<br>%{percentParent:.1%}<extra></extra>",
        marker: { colors: data.values, colorscale: "Blues", showscale: false },
      } as any]}
      layout={{ ...BASE_LAYOUT, margin: { l: 10, r: 10, t: 10, b: 10 } }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATETIME CHART COMPONENTS
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
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{title}</p>
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
// BIVARIATE CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function BivNumNum({ data, col1, col2 }: { data: any; col1: string; col2: string }) {
  if (data?.error) return <Empty msg={data.error} />;
  const traces: Data[] = [
    { x: data.x, y: data.y, mode: "markers", type: "scatter", name: "Data",
      marker: { color: C.primary, size: 5, opacity: 0.45 } },
  ];
  if (data.line_x?.length) {
    traces.push({
      x: data.line_x, y: data.line_y, mode: "lines", type: "scatter",
      name: `Trend (R²=${data.r2?.toFixed(2) ?? "?"})`,
      line: { color: C.danger, width: 2, dash: "dash" },
    });
  }
  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        <Pill label="Pearson r" value={data.pearson_r?.toFixed(3) ?? "--"}
          color={Math.abs(data.pearson_r ?? 0) > 0.7 ? C.danger : Math.abs(data.pearson_r ?? 0) > 0.4 ? C.warning : C.muted} />
        <Pill label="R²" value={data.r2?.toFixed(3) ?? "--"} />
        <Pill label="p-value"
          value={data.p_value != null ? (data.p_value < 0.001 ? "<0.001" : data.p_value.toFixed(3)) : "--"} />
      </div>
      <Plot data={traces}
        layout={{ ...BASE_LAYOUT, xaxis: { title: col1 }, yaxis: { title: col2 },
          legend: { orientation: "h", y: -0.25 } }}
        config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
    </>
  );
}

function BivCatCat({ data }: { data: any }) {
  if (data?.error) return <Empty msg={data.error} />;
  const rows = (data.cat1_labels as string[])?.map((l: string, i: number) => {
    const row: Record<string, any> = { label: l.length > 18 ? l.slice(0, 16) + "…" : l };
    (data.series as any[])?.forEach((s: any) => { row[s.name] = s.values[i]; });
    return row;
  }) ?? [];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ bottom: 44, left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {(data.cat2_labels as string[])?.map((name: string, i: number) => (
          <Bar key={name} dataKey={name} fill={PALETTE[i % PALETTE.length]} opacity={0.85} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function BivNumCat({ data }: { data: any }) {
  if (data?.error || !data?.groups) return <Empty msg={data?.error ?? "No data"} />;
  const traces: Data[] = Object.entries(data.groups as Record<string, any>).map(([grp, stats], i) => ({
    type: "box",
    y: [stats.min, stats.q1, stats.median, stats.q3, stats.max, ...(stats.outliers ?? [])],
    q1: [stats.q1], median: [stats.median], q3: [stats.q3],
    lowerfence: [stats.min], upperfence: [stats.max],
    name: grp, marker: { color: PALETTE[i % PALETTE.length] },
    boxpoints: "outliers",
  } as Data));
  return (
    <Plot data={traces}
      layout={{ ...BASE_LAYOUT, yaxis: { title: data.numeric_col },
        xaxis: { title: data.categorical_col }, boxmode: "group" }}
      config={PLOT_CFG} style={PLOT_STYLE} useResizeHandler />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTIVARIATE CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function PairPlot({ pairs }: { pairs: FullAnalysisResult["multi_column"]["scatter_pairs"] }) {
  if (!pairs.length) return <Empty msg="Need at least 2 numeric columns for pair plot" />;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {pairs.map((pair) => (
        <div key={`${pair.col1}-${pair.col2}`} className="border border-border rounded-lg overflow-hidden">
          <div className="px-2 py-1 bg-muted text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
            <span className="truncate">{pair.col1} × {pair.col2}</span>
            <span className="text-muted-foreground ml-1 flex-shrink-0">r={pair.pearson_r?.toFixed(2)}</span>
          </div>
          <Plot
            data={[
              { x: pair.x, y: pair.y, mode: "markers", type: "scatter",
                marker: { color: C.primary, size: 3, opacity: 0.4 }, showlegend: false },
              ...(pair.line_x?.length ? [{
                x: pair.line_x, y: pair.line_y, mode: "lines" as const, type: "scatter" as const,
                line: { color: C.danger, width: 1.5, dash: "dash" as const }, showlegend: false,
              }] : []),
            ]}
            layout={{ ...BASE_LAYOUT, showlegend: false, margin: { l: 28, r: 8, t: 6, b: 28 },
              xaxis: { showticklabels: false, gridcolor: "#F1F5F9", zeroline: false },
              yaxis: { showticklabels: false, gridcolor: "#F1F5F9", zeroline: false } }}
            config={{ ...PLOT_CFG, displayModeBar: false }}
            style={{ width: "100%", height: "160px" }}
            useResizeHandler />
        </div>
      ))}
    </div>
  );
}

function Scatter3DPlot({ data }: { data: any }) {
  if (data?.error) return <Empty msg={data.error} />;
  return (
    <Plot
      data={[{
        x: data.x, y: data.y, z: data.z,
        mode: "markers", type: "scatter3d",
        marker: { size: 3, color: data.z, colorscale: "Viridis", opacity: 0.65,
          colorbar: { thickness: 10, len: 0.6, tickfont: { size: 9 } } },
      } as Data]}
      layout={{ ...BASE_LAYOUT, margin: { l: 0, r: 0, t: 10, b: 10 },
        scene: { xaxis: { title: data.x_col }, yaxis: { title: data.y_col }, zaxis: { title: data.z_col } } }}
      config={PLOT_CFG} style={{ width: "100%", height: "420px" }} useResizeHandler />
  );
}

function BubbleChart({ data, xCol, yCol, sizeCol }: { data: any; xCol: string; yCol: string; sizeCol: string }) {
  if (data?.error) return <Empty msg={data.error} />;
  const sizes = data.z as number[];
  if (!sizes?.length) return <Empty />;
  const minZ = Math.min(...sizes);
  const maxZ = Math.max(...sizes);
  const range = maxZ - minZ || 1;
  const normalizedSizes = sizes.map((v) => 4 + ((v - minZ) / range) * 28);
  return (
    <Plot
      data={[{
        x: data.x, y: data.y,
        mode: "markers", type: "scatter",
        marker: {
          size: normalizedSizes, color: data.z,
          colorscale: "Viridis", opacity: 0.6,
          colorbar: { title: sizeCol, thickness: 10, len: 0.6, tickfont: { size: 9 } },
        },
        hovertemplate: `${xCol}: %{x}<br>${yCol}: %{y}<br>${sizeCol}: %{customdata}<extra></extra>`,
        customdata: data.z,
        showlegend: false,
      } as any]}
      layout={{ ...BASE_LAYOUT, xaxis: { title: xCol }, yaxis: { title: yCol } }}
      config={PLOT_CFG} style={{ width: "100%", height: "380px" }} useResizeHandler />
  );
}

function PCAPlot({ data }: { data: any }) {
  if (data?.error) return <Empty msg={data.error} />;
  const ev = (data.explained_variance_ratio as number[]) ?? [];
  const loadingRows = (data.columns as string[])?.map((col: string, i: number) => ({
    col: col.length > 14 ? col.slice(0, 12) + "…" : col,
    pc1: (data.loadings_pc1 as number[])[i] ?? 0,
    pc2: (data.loadings_pc2 as number[])?.[i] ?? 0,
  })) ?? [];
  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap">
        {ev.map((v, i) => (
          <Pill key={i} label={`PC${i + 1}`} value={`${(v * 100).toFixed(1)}%`} color={PALETTE[i]} />
        ))}
        <Pill label="Cumulative" value={`${(ev.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%`} color={C.muted} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Score Plot (PC1 vs PC2)</p>
          <Plot
            data={[{ x: data.scores_pc1, y: data.scores_pc2, mode: "markers", type: "scatter",
              marker: { color: C.primary, size: 4, opacity: 0.45 }, showlegend: false } as Data]}
            layout={{ ...BASE_LAYOUT, showlegend: false,
              xaxis: { title: `PC1 (${(ev[0] * 100).toFixed(1)}%)` },
              yaxis: { title: `PC2 (${(ev[1] * 100)?.toFixed(1)}%)` } }}
            config={PLOT_CFG} style={{ width: "100%", height: "280px" }} useResizeHandler />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Variable Loadings</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={loadingRows} layout="vertical" margin={{ left: 90, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} domain={[-1, 1]} />
              <YAxis dataKey="col" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="pc1" fill={C.primary} opacity={0.85} name="PC1" />
              <Bar dataKey="pc2" fill={C.secondary} opacity={0.85} name="PC2" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function CorrelationHeatmap({ data }: { data: FullAnalysisResult["multi_column"]["correlation"] }) {
  if (!data?.labels?.length) return <Empty msg="Need 2+ numeric columns" />;
  const textData = (data.z as number[][]).map((row) =>
    row.map((v) => (v != null ? v.toFixed(2) : ""))
  );
  return (
    <Plot
      data={[{
        z: data.z, x: data.labels, y: data.labels, type: "heatmap",
        colorscale: [[0, C.danger], [0.5, "#ffffff"], [1, C.primary]],
        zmin: -1, zmax: 1, text: textData, texttemplate: "%{text}",
        hovertemplate: "%{x} × %{y}: %{z:.3f}<extra></extra>",
        colorbar: { thickness: 12, len: 0.8, tickfont: { size: 10 } },
      } as any]}
      layout={{ ...BASE_LAYOUT, xaxis: { tickangle: -35 }, yaxis: { tickangle: 0 } }}
      config={PLOT_CFG} style={{ width: "100%", height: "360px" }} useResizeHandler />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT TABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function NormalityTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["normality_table"] }) {
  if (!rows.length) return <Empty msg="No numeric columns" />;
  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] border-separate border-spacing-0">
        <thead>
          <tr>
            {["Column", "n", "Test", "p-value", "Normal?", "Skewness", "Kurtosis"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide border-b border-border bg-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.column} className={idx % 2 === 0 ? "bg-card" : "bg-muted/50"}>
              <td className="px-3 py-2 font-mono font-semibold text-foreground">{r.column}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.n.toLocaleString()}</td>
              <td className="px-3 py-2 text-muted-foreground uppercase text-[10px]">{r.test}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.p_value?.toFixed(4) ?? "--"}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  r.is_normal ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                }`}>
                  {r.is_normal === null ? "?" : r.is_normal ? "✓ Yes" : "✗ No"}
                </span>
              </td>
              <td className={`px-3 py-2 font-semibold ${
                Math.abs(r.skewness ?? 0) > 1 ? "text-red-600 dark:text-red-400" :
                Math.abs(r.skewness ?? 0) > 0.5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
              }`}>{r.skewness?.toFixed(3) ?? "--"}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.kurtosis?.toFixed(3) ?? "--"}</td>
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
              <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide border-b border-border bg-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.column} className={idx % 2 === 0 ? "bg-card" : "bg-muted/50"}>
              <td className="px-3 py-2 font-mono font-semibold text-foreground">{r.column}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.outlier_count.toLocaleString()}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(r.outlier_pct ?? 0, 100)}%`,
                        background: (r.outlier_pct ?? 0) > 10 ? C.danger : (r.outlier_pct ?? 0) > 5 ? C.warning : C.success,
                      }} />
                  </div>
                  <span className={`font-semibold ${(r.outlier_pct ?? 0) > 10 ? "text-red-600 dark:text-red-400" : (r.outlier_pct ?? 0) > 5 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {r.outlier_pct?.toFixed(2) ?? "--"}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground font-mono">{r.lower_bound?.toFixed(3) ?? "--"}</td>
              <td className="px-3 py-2 text-muted-foreground font-mono">{r.upper_bound?.toFixed(3) ?? "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardinalityTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["cardinality"] }) {
  const FLAG: Record<string, { cls: string; label: string }> = {
    id_like:         { cls: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",   label: "ID-like" },
    constant:        { cls: "bg-muted text-muted-foreground",     label: "Constant" },
    binary:          { cls: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400",         label: "Binary" },
    low_cardinality: { cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400", label: "Low-card" },
    normal:          { cls: "bg-card text-muted-foreground border border-border", label: "Normal" },
  };
  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] border-separate border-spacing-0">
        <thead>
          <tr>
            {["Column", "Dtype", "Unique (n)", "Unique %", "Flag"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide border-b border-border bg-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const f = FLAG[r.flag] ?? FLAG.normal;
            return (
              <tr key={r.column} className={idx % 2 === 0 ? "bg-card" : "bg-muted/50"}>
                <td className="px-3 py-2 font-mono font-semibold text-foreground">{r.column}</td>
                <td className="px-3 py-2 text-muted-foreground font-mono">{r.dtype}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.unique_count.toLocaleString()}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.unique_pct?.toFixed(1) ?? "--"}%</td>
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
    <div className="flex items-center justify-center h-32 gap-2 text-emerald-600 dark:text-emerald-400">
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
              <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide border-b border-border bg-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.column} className={idx % 2 === 0 ? "bg-card" : "bg-muted/50"}>
              <td className="px-3 py-2 font-mono font-semibold text-foreground">{r.column}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.missing_count.toLocaleString()}</td>
              <td className="px-3 py-2 w-48">
                <div className="w-full bg-muted rounded-full h-2">
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
  { key: "univariate",    label: "Univariate",   icon: <BarChart2 className="w-4 h-4" />, desc: "Single column distributions" },
  { key: "bivariate",    label: "Bivariate",    icon: <GitMerge className="w-4 h-4" />,  desc: "Pair relationships" },
  { key: "multivariate", label: "Multivariate", icon: <Layers className="w-4 h-4" />,    desc: "Multi-column patterns" },
  { key: "quality",      label: "Data Quality", icon: <Table2 className="w-4 h-4" />,    desc: "Missing, outliers, normality" },
];

type ChartKey =
  | "histogram" | "box" | "violin" | "strip" | "qq" | "ecdf"
  | "bar" | "pie" | "pareto" | "treemap"
  | "timeseries" | "seasonality";

const CHART_LABELS: Record<ChartKey, string> = {
  histogram:   "Histogram + KDE",
  box:         "Box Plot",
  violin:      "Violin Plot",
  strip:       "Strip Plot",
  qq:          "QQ Plot",
  ecdf:        "ECDF",
  bar:         "Bar Chart",
  pie:         "Pie / Donut",
  pareto:      "Pareto Chart",
  treemap:     "Treemap",
  timeseries:  "Time Series",
  seasonality: "Seasonality",
};

const NUMERIC_CHARTS: ChartKey[] = ["histogram", "box", "violin", "strip", "qq", "ecdf"];
const CAT_CHARTS: ChartKey[]     = ["bar", "pie", "pareto", "treemap"];
const DT_CHARTS: ChartKey[]      = ["timeseries", "seasonality"];

function Sidebar({
  data, activeTab, setActiveTab,
  selectedCol, setSelectedCol,
  visibleCharts, toggleChart,
}: {
  data: FullAnalysisResult;
  activeTab: AnalysisTab; setActiveTab: (t: AnalysisTab) => void;
  selectedCol: string; setSelectedCol: (c: string) => void;
  visibleCharts: Set<ChartKey>; toggleChart: (k: ChartKey) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const TYPE_ICON: Record<string, React.ReactNode> = {
    numeric:     <Hash className="w-2.5 h-2.5 text-blue-500 dark:text-blue-400" />,
    categorical: <Type className="w-2.5 h-2.5 text-violet-500 dark:text-violet-400" />,
    datetime:    <Clock className="w-2.5 h-2.5 text-cyan-500 dark:text-cyan-400" />,
  };

  const colType = selectedCol ? data.column_types[selectedCol] : null;
  const chartsForColType = colType === "numeric" ? NUMERIC_CHARTS
    : colType === "categorical" ? CAT_CHARTS
    : colType === "datetime" ? DT_CHARTS
    : [];

  const sections = [
    { label: "Numeric",     cols: data.numeric_cols,     type: "numeric" },
    { label: "Categorical", cols: data.categorical_cols, type: "categorical" },
    { label: "Datetime",    cols: data.datetime_cols,    type: "datetime" },
  ].filter((s) => s.cols.length > 0);

  /* ── Collapsed: icon rail ── */
  if (collapsed) {
    return (
      <aside className="w-12 flex-shrink-0 border-r border-border bg-card flex flex-col items-center py-2 gap-1 h-full">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground mb-1"
          title="Expand sidebar">
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        {TAB_META.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            title={t.label}
            className={`p-2 rounded-md transition ${
              activeTab === t.key
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                : "text-muted-foreground hover:bg-muted hover:text-muted-foreground"
            }`}>
            {t.icon}
          </button>
        ))}
      </aside>
    );
  }

  /* ── Expanded sidebar ── */
  return (
    <aside className="w-60 flex-shrink-0 border-r border-border bg-card flex flex-col h-full overflow-hidden">

      {/* Tab switcher + collapse button */}
      <div className="border-b border-border flex-shrink-0">
        <div className="flex items-center justify-end px-2 pt-1.5">
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            title="Collapse sidebar">
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
        {TAB_META.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
              activeTab === t.key
                ? "bg-blue-50 dark:bg-blue-950/40 border-r-2 border-blue-600 text-blue-700 dark:text-blue-400"
                : "text-muted-foreground hover:bg-muted"
            }`}>
            <span className={activeTab === t.key ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}>{t.icon}</span>
            <div>
              <p className="text-xs font-semibold">{t.label}</p>
              <p className="text-[9px] text-muted-foreground">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Chart type toggles — ABOVE columns so always visible */}
      {activeTab === "univariate" && chartsForColType.length > 0 && (
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Chart Types</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {chartsForColType.map((k) => (
              <label key={k} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-muted cursor-pointer">
                <input type="checkbox" checked={visibleCharts.has(k)}
                  onChange={() => toggleChart(k)} className="accent-blue-600 w-3 h-3 flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate">{CHART_LABELS[k]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Column selector — scrollable, takes remaining space */}
      {activeTab === "univariate" && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Columns</p>
          {sections.map(({ label, cols, type }) => (
            <div key={type} className="mb-3">
              <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1 mb-1">
                {label} ({cols.length})
              </p>
              {cols.map((col) => (
                <button key={col} onClick={() => setSelectedCol(col)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all ${
                    selectedCol === col ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400" : "text-muted-foreground hover:bg-muted"
                  }`}>
                  <span className="flex-shrink-0">
                    {TYPE_ICON[type] ?? <Sigma className="w-2.5 h-2.5 text-muted-foreground" />}
                  </span>
                  <span className="text-[11px] truncate font-medium">{col}</span>
                  {selectedCol === col && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ))}
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
    <div className={`bg-card rounded-xl border border-border shadow-sm overflow-hidden ${wide ? "col-span-2" : ""}`}>
      <div className="flex items-start justify-between px-4 pt-3 pb-2 border-b border-border">
        <div className="flex-1">
          <p className="text-xs font-bold text-foreground">{title}</p>
          {desc && <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>}
          {insight && <Insight text={insight} level={insightLevel ?? "warning"} />}
        </div>
        <button onClick={() => setExpanded((v) => !v)}
          className="p-1 rounded hover:bg-muted text-muted-foreground ml-2 flex-shrink-0">
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
      <div className="h-px flex-1 bg-muted" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">
        {label}{count !== undefined && <span className="ml-1 text-muted-foreground/60">({count})</span>}
      </span>
      <div className="h-px flex-1 bg-muted" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AnalysisPage() {
  const { datasetId } = useParams<{ datasetId: string }>();

  // 1. Skeleton query (fast, loads all metadata)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.eda.analysis(datasetId),
    queryFn: () => datasetsApi.getAnalysis(datasetId).then((r) => r.data as FullAnalysisResult),
    staleTime: 1000 * 60 * 10,
  });

  // 2. Per-column chart query (lazy, fires only when a column is selected)
  const [selectedCol, setSelectedCol] = useState<string>("");
  const { data: columnCharts, isFetching: colChartsLoading } = useQuery({
    queryKey: ["eda", "column", datasetId, selectedCol],
    queryFn: () =>
      datasetsApi.getAnalysisColumn(datasetId, selectedCol).then((r) => r.data),
    enabled: !!selectedCol && !!data,
    staleTime: 1000 * 60 * 10,
  });

  const [activeTab, setActiveTab] = useState<AnalysisTab>("univariate");
  const [visibleCharts, setVisibleCharts] = useState<Set<ChartKey>>(
    new Set([
      "histogram", "box", "violin", "strip", "qq", "ecdf",
      "bar", "pie", "pareto", "treemap",
      "timeseries", "seasonality",
    ] as ChartKey[])
  );

  useEffect(() => {
    if (data && !selectedCol) {
      const first = data.numeric_cols[0] ?? data.categorical_cols[0] ?? data.datetime_cols[0] ?? "";
      setSelectedCol(first);
    }
  }, [data, selectedCol]);

  function toggleChart(k: ChartKey) {
    setVisibleCharts((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }
  const show = (k: ChartKey) => visibleCharts.has(k);

  // ── Bivariate state ──────────────────────────────────────────────────────────
  const [bivType, setBivType] = useState<"num_num" | "cat_cat" | "num_cat">("num_num");
  const [bivCol1, setBivCol1] = useState("");
  const [bivCol2, setBivCol2] = useState("");
  const bivEnabled = !!bivCol1 && !!bivCol2 && bivCol1 !== bivCol2;
  const { data: bivData, isFetching: bivLoading } = useQuery({
    queryKey: ["eda", "bivariate", datasetId, bivCol1, bivCol2, bivType],
    queryFn: () => datasetsApi.getBivariate(datasetId, bivCol1, bivCol2, bivType).then((r) => r.data),
    enabled: bivEnabled,
    staleTime: 1000 * 60 * 10,
  });

  // ── Multivariate state ───────────────────────────────────────────────────────
  const [s3x, setS3x] = useState("");
  const [s3y, setS3y] = useState("");
  const [s3z, setS3z] = useState("");
  const s3Enabled = !!s3x && !!s3y && !!s3z && new Set([s3x, s3y, s3z]).size === 3;
  const { data: s3Data, isFetching: s3Loading } = useQuery({
    queryKey: ["eda", "scatter3d", datasetId, s3x, s3y, s3z],
    queryFn: () => datasetsApi.getScatter3d(datasetId, s3x, s3y, s3z).then((r) => r.data),
    enabled: s3Enabled,
    staleTime: 1000 * 60 * 10,
  });
  const { data: pcaData, isFetching: pcaLoading } = useQuery({
    queryKey: ["eda", "pca", datasetId],
    queryFn: () => datasetsApi.getPCA(datasetId).then((r) => r.data),
    enabled: (data?.numeric_cols?.length ?? 0) >= 2,
    staleTime: 1000 * 60 * 10,
  });

  // ── Custom chart state ────────────────────────────────────────────────────────
  const [customType, setCustomType] = useState<"bar" | "line" | "area" | "scatter">("scatter");
  const [customX, setCustomX] = useState("");
  const [customY, setCustomY] = useState("");
  const { data: previewData, isFetching: previewLoading } = useQuery({
    queryKey: queryKeys.datasets.preview(datasetId),
    queryFn: () => datasetsApi.preview(datasetId).then((r) => r.data),
    enabled: !!customX && !!customY,
    staleTime: 1000 * 60 * 10,
  });
  const customRows = useMemo(() => {
    if (!previewData?.rows || !customX || !customY) return [];
    const limit = customType === "scatter" ? 500 : 150;
    return (previewData.rows as Record<string, unknown>[]).slice(0, limit).map((row) => ({
      x: customType === "scatter" ? (Number(row[customX]) || 0) : String(row[customX] ?? ""),
      y: Number(row[customY]) || 0,
    }));
  }, [previewData, customX, customY, customType]);

  // ── Loading / error states ────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex flex-col min-h-screen bg-muted">
      <SubNav datasetId={datasetId} />
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <PageSpinner />
        <p className="text-sm text-muted-foreground animate-pulse">Computing analysis…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col min-h-screen bg-muted">
      <SubNav datasetId={datasetId} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 dark:text-red-400 mx-auto" />
          <p className="text-red-500 dark:text-red-400 font-semibold text-sm">Analysis failed</p>
          <p className="text-muted-foreground text-xs">{(error as Error).message}</p>
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    </div>
  );

  const colType = selectedCol && data ? data.column_types[selectedCol] : null;

  return (
    <div className="flex flex-col h-screen bg-muted">
      <SubNav datasetId={datasetId} />

      {data && (
        <div className="flex flex-1 overflow-hidden min-h-0">
          <Sidebar
            data={data}
            activeTab={activeTab} setActiveTab={setActiveTab}
            selectedCol={selectedCol} setSelectedCol={setSelectedCol}
            visibleCharts={visibleCharts} toggleChart={toggleChart}
          />

          {/* ── Main content ── */}
          <main className="flex-1 overflow-y-auto p-5">

            {/* ══════════ UNIVARIATE TAB ══════════ */}
            {activeTab === "univariate" && (
              <div className="grid grid-cols-2 gap-4">
                {selectedCol && colChartsLoading && (
                  <div className="col-span-2 flex items-center justify-center h-40 gap-2 text-muted-foreground animate-pulse">
                    <PageSpinner />
                    <span className="text-xs">Loading charts for {selectedCol}…</span>
                  </div>
                )}

                {/* ── Numeric column ── */}
                {selectedCol && !colChartsLoading && colType === "numeric" && (() => {
                  const charts = columnCharts as any;
                  if (!charts || !charts.histogram_kde) return (
                    <div className="col-span-2"><Empty msg={`No chart data for ${selectedCol}`} /></div>
                  );
                  const highSkew = Math.abs(charts.skewness ?? 0) > 1;
                  const missingInfo = data!.stat_cards.missing_bar.find((r) => r.column === selectedCol);
                  return (
                    <>
                      {/* Stats pills */}
                      <div className="col-span-2 flex gap-2 flex-wrap">
                        {[
                          { label: "Mean",    value: charts.histogram_kde.mean?.toFixed(4) ?? "--" },
                          { label: "Median",  value: charts.histogram_kde.median?.toFixed(4) ?? "--" },
                          { label: "Min",     value: charts.box.min?.toFixed(4) ?? "--" },
                          { label: "Max",     value: charts.box.max?.toFixed(4) ?? "--" },
                          { label: "Q1",      value: charts.box.q1?.toFixed(4) ?? "--" },
                          { label: "Q3",      value: charts.box.q3?.toFixed(4) ?? "--" },
                          {
                            label: "Skewness",
                            value: charts.skewness?.toFixed(3) ?? "--",
                            color: Math.abs(charts.skewness ?? 0) > 1 ? C.danger :
                                   Math.abs(charts.skewness ?? 0) > 0.5 ? C.warning : C.muted,
                          },
                          { label: "Kurtosis", value: charts.kurtosis?.toFixed(3) ?? "--" },
                          {
                            label: "Missing",
                            value: `${missingInfo?.missing_pct?.toFixed(1) ?? "0"}%`,
                            color: (missingInfo?.missing_pct ?? 0) > 5 ? C.warning : C.muted,
                          },
                        ].map(({ label, value, color }) => (
                          <Pill key={label} label={label} value={value} color={color ?? C.primary} />
                        ))}
                      </div>

                      {show("histogram") && (
                        <Card title={`Histogram + KDE — ${selectedCol}`}
                          desc="Frequency distribution with kernel density estimate, mean (dashed) & median (dotted)"
                          insight={highSkew ? `Skewness ${charts.skewness?.toFixed(2)} — distribution is ${(charts.skewness ?? 0) > 0 ? "right" : "left"}-skewed` : undefined}
                          insightLevel={Math.abs(charts.skewness ?? 0) > 2 ? "danger" : "warning"}>
                          <HistKDE data={charts.histogram_kde} col={selectedCol} />
                        </Card>
                      )}

                      {show("box") && (
                        <Card title={`Box Plot — ${selectedCol}`} desc="IQR box with whiskers and outlier dots">
                          <BoxPlot data={charts.box} col={selectedCol} />
                        </Card>
                      )}

                      {show("violin") && (
                        <Card title={`Violin Plot — ${selectedCol}`} desc="Full KDE distribution shape with embedded box plot">
                          <ViolinChart data={charts.violin} col={selectedCol} />
                        </Card>
                      )}

                      {show("strip") && (
                        <Card title={`Strip Plot — ${selectedCol}`} desc="Individual data points with jitter to reveal density">
                          <StripPlot data={charts.violin} col={selectedCol} />
                        </Card>
                      )}

                      {show("qq") && (
                        <Card title={`QQ Plot — ${selectedCol}`}
                          desc="Sample vs. theoretical normal quantiles"
                          insight={charts.normality?.is_normal === false
                            ? `Not normally distributed (p = ${charts.normality.p_value?.toFixed(4)})` : undefined}
                          insightLevel="warning">
                          <QQPlot data={charts.qq} col={selectedCol} />
                        </Card>
                      )}

                      {show("ecdf") && (
                        <Card title={`ECDF — ${selectedCol}`} desc="Empirical cumulative distribution function">
                          <ECDFChart data={charts.ecdf} col={selectedCol} />
                        </Card>
                      )}
                    </>
                  );
                })()}

                {/* ── Categorical column ── */}
                {selectedCol && !colChartsLoading && colType === "categorical" && (() => {
                  const charts = columnCharts as any;
                  if (!charts || !charts.bar) return (
                    <div className="col-span-2"><Empty msg={`No chart data for ${selectedCol}`} /></div>
                  );
                  const total = charts.bar.total_categories;
                  return (
                    <>
                      <div className="col-span-2 flex gap-2 flex-wrap">
                        <Pill label="Categories" value={total} />
                        <Pill label="Top value"  value={charts.bar.labels[0] ?? "--"} color={C.secondary} />
                        <Pill label="Top freq"   value={`${charts.bar.percentages[0]?.toFixed(1) ?? "--"}%`} color={C.secondary} />
                        <Pill label="Other"      value={charts.bar.other_count > 0 ? `+${charts.bar.other_count}` : "0"} color={C.muted} />
                      </div>

                      {show("bar") && (
                        <Card title={`Frequency — ${selectedCol}`}
                          desc={`Top ${Math.min(total, 20)} of ${total} categories by count`}
                          insight={total > 50 ? `High cardinality: ${total} unique values` : undefined}
                          insightLevel="warning">
                          <CatBar data={charts.bar} col={selectedCol} />
                        </Card>
                      )}

                      {show("pie") && charts.pie && (
                        <Card title={`Share — ${selectedCol}`} desc="Proportional breakdown by category">
                          <CatPie data={charts.pie} />
                        </Card>
                      )}

                      {show("treemap") && (
                        <Card title={`Treemap — ${selectedCol}`} desc="Category frequency as proportional rectangles">
                          <TreemapChart data={charts.bar} col={selectedCol} />
                        </Card>
                      )}

                      {show("pareto") && (
                        <Card title={`Pareto — ${selectedCol}`} desc="Frequency bars + cumulative % line (80/20 analysis)" wide>
                          {charts.pareto?.labels?.length ? (
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart
                                data={charts.pareto.labels.map((l: string, i: number) => ({
                                  label: l.length > 14 ? l.slice(0, 12) + "…" : l,
                                  value: charts.pareto.values[i],
                                  cumPct: charts.pareto.cumulative_pct[i],
                                }))}
                                margin={{ bottom: 44, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                                <YAxis yAxisId="r" orientation="right" domain={[0, 100]}
                                  tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                <Bar yAxisId="l" dataKey="value" fill={C.primary} opacity={0.85} radius={[4, 4, 0, 0]} />
                                <Line yAxisId="r" type="monotone" dataKey="cumPct"
                                  stroke={C.danger} strokeWidth={2} dot={false} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : <Empty />}
                        </Card>
                      )}
                    </>
                  );
                })()}

                {/* ── Datetime column ── */}
                {selectedCol && !colChartsLoading && colType === "datetime" && (() => {
                  const charts = columnCharts as any;
                  if (!charts || !charts.timeseries) return (
                    <div className="col-span-2"><Empty msg={`No chart data for ${selectedCol}`} /></div>
                  );
                  return (
                    <>
                      {show("timeseries") && (
                        <Card title={`Time Series — ${selectedCol}`}
                          desc="Event count over time (auto-aggregated)" wide>
                          <TimeSeriesLine data={charts.timeseries} />
                        </Card>
                      )}
                      {show("seasonality") && (
                        <Card title={`Seasonality — ${selectedCol}`}
                          desc="Count by hour of day, day of week, and month" wide>
                          <SeasonalityGrid data={charts.seasonality} />
                        </Card>
                      )}
                    </>
                  );
                })()}

                {!selectedCol && (
                  <div className="col-span-2 bg-card rounded-xl border border-dashed border-border p-12 text-center">
                    <BarChart2 className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Select a column from the sidebar to view charts</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════════ BIVARIATE TAB ══════════ */}
            {activeTab === "bivariate" && (
              <div className="max-w-3xl space-y-5">
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <GitMerge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-sm font-bold text-foreground">Bivariate Analysis</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Analyzing relationships between pairs of variables</p>

                  <p className="text-xs font-semibold text-muted-foreground mb-2">Select Analysis Type</p>
                  <div className="flex gap-2 flex-wrap mb-5">
                    {([
                      { key: "num_num" as const, label: "Numerical × Numerical" },
                      { key: "cat_cat" as const, label: "Categorical × Categorical" },
                      { key: "num_cat" as const, label: "Numerical × Categorical" },
                    ]).map((t) => (
                      <button key={t.key}
                        onClick={() => { setBivType(t.key); setBivCol1(""); setBivCol2(""); }}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                          bivType === t.key
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-card text-muted-foreground border-border hover:border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:bg-blue-950/40"
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        {bivType === "num_cat" ? "Numeric Column" : "Column 1"}
                      </label>
                      <select value={bivCol1} onChange={(e) => setBivCol1(e.target.value)}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select column…</option>
                        {(bivType === "cat_cat" ? data.categorical_cols : data.numeric_cols).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        {bivType === "num_cat" ? "Categorical Column" : "Column 2"}
                      </label>
                      <select value={bivCol2} onChange={(e) => setBivCol2(e.target.value)}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select column…</option>
                        {(bivType === "num_num" ? data.numeric_cols :
                          bivType === "cat_cat" ? data.categorical_cols :
                          data.categorical_cols
                        ).filter((c) => c !== bivCol1).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {(!bivCol1 || !bivCol2) && (
                  <div className="bg-card rounded-xl border border-dashed border-border p-10 text-center">
                    <GitMerge className="w-6 h-6 text-muted-foreground/60 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Select two columns above to visualise their relationship</p>
                  </div>
                )}
                {bivCol1 && bivCol2 && bivLoading && (
                  <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground text-sm animate-pulse">
                    Computing…
                  </div>
                )}
                {bivCol1 && bivCol2 && !bivLoading && bivData && (
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="px-4 pt-3 pb-2 border-b border-border flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">{bivCol1} × {bivCol2}</p>
                      {"n" in (bivData as object) && (
                        <span className="text-[10px] text-muted-foreground">{(bivData as any).n?.toLocaleString()} rows</span>
                      )}
                    </div>
                    <div className="p-4">
                      {bivType === "num_num" && <BivNumNum data={bivData} col1={bivCol1} col2={bivCol2} />}
                      {bivType === "cat_cat" && <BivCatCat data={bivData} />}
                      {bivType === "num_cat" && <BivNumCat data={bivData} />}
                    </div>
                  </div>
                )}

                {/* ── Custom Chart Builder ── */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <BarChart2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <h2 className="text-sm font-bold text-foreground">Custom Chart Builder</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Free-form X/Y chart from preview data (up to 500 rows)</p>

                  {/* Chart type selector */}
                  <div className="flex gap-2 flex-wrap mb-4">
                    {(["scatter", "bar", "line", "area"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setCustomType(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition ${
                          customType === t
                            ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                            : "bg-card text-muted-foreground border-border hover:border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:bg-violet-950/40"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Column pickers */}
                  <div className="flex gap-4 mb-5">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        X Axis {customType === "scatter" ? "(numeric)" : "(any)"}
                      </label>
                      <select
                        value={customX}
                        onChange={(e) => setCustomX(e.target.value)}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">Select column…</option>
                        {(customType === "scatter"
                          ? data.numeric_cols
                          : [...data.numeric_cols, ...data.categorical_cols, ...data.datetime_cols]
                        ).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Y Axis (numeric)</label>
                      <select
                        value={customY}
                        onChange={(e) => setCustomY(e.target.value)}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">Select column…</option>
                        {data.numeric_cols.filter((c) => c !== customX).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Chart output */}
                  {(!customX || !customY) && (
                    <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
                      Select X and Y columns to render the chart
                    </div>
                  )}
                  {customX && customY && previewLoading && (
                    <div className="border border-border rounded-lg p-8 text-center text-muted-foreground text-sm animate-pulse">
                      Loading preview data…
                    </div>
                  )}
                  {customX && customY && !previewLoading && customRows.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {customX} → {customY}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {customRows.length} rows · preview data
                        </span>
                      </div>

                      {customType === "scatter" && (
                        <ResponsiveContainer width="100%" height={280}>
                          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="x" type="number" name={customX} tick={{ fontSize: 10 }}
                              label={{ value: customX, position: "insideBottom", offset: -14, fontSize: 10, fill: C.muted }} />
                            <YAxis dataKey="y" type="number" name={customY} tick={{ fontSize: 10 }}
                              label={{ value: customY, angle: -90, position: "insideLeft", fontSize: 10, fill: C.muted }} />
                            <Tooltip
                              cursor={{ strokeDasharray: "3 3" }}
                              contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}` }}
                              formatter={(v: number, n: string) => [v, n === "y" ? customY : customX]}
                            />
                            <RScatter data={customRows} fill={C.secondary} opacity={0.5} r={3} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      )}

                      {customType === "bar" && (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={customRows} margin={{ bottom: 36, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="x" tick={{ fontSize: 9 }} angle={-30} textAnchor="end"
                              interval={Math.max(0, Math.floor(customRows.length / 20) - 1)} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                              formatter={(v: number) => [v, customY]} />
                            <Bar dataKey="y" fill={C.primary} opacity={0.85} radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}

                      {customType === "line" && (
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={customRows} margin={{ bottom: 36, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="x" tick={{ fontSize: 9 }} angle={-30} textAnchor="end"
                              interval={Math.max(0, Math.floor(customRows.length / 20) - 1)} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                              formatter={(v: number) => [v, customY]} />
                            <Line type="monotone" dataKey="y" stroke={C.accent} strokeWidth={2}
                              dot={false} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}

                      {customType === "area" && (
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={customRows} margin={{ bottom: 36, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="x" tick={{ fontSize: 9 }} angle={-30} textAnchor="end"
                              interval={Math.max(0, Math.floor(customRows.length / 20) - 1)} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                              formatter={(v: number) => [v, customY]} />
                            <Area type="monotone" dataKey="y" stroke={C.secondary} strokeWidth={2}
                              fill={C.secondary} fillOpacity={0.13} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════ MULTIVARIATE TAB ══════════ */}
            {activeTab === "multivariate" && (
              <div className="space-y-6">

                {/* Correlation Heatmap */}
                <section>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Correlation Heatmap</h3>
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="px-4 pt-3 pb-2 border-b border-border">
                      <p className="text-xs font-bold text-foreground">Pearson Correlation Matrix</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Pairwise linear correlation −1 (red) to +1 (blue)</p>
                    </div>
                    <div className="p-4"><CorrelationHeatmap data={data.multi_column.correlation} /></div>
                  </div>
                </section>

                {/* Pair Plot */}
                <section>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Pair Plot</h3>
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="px-4 pt-3 pb-2 border-b border-border">
                      <p className="text-xs font-bold text-foreground">Top Correlated Pairs</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Scatter + trend line for highest-correlation numeric pairs</p>
                    </div>
                    <div className="p-4"><PairPlot pairs={data.multi_column.scatter_pairs} /></div>
                  </div>
                </section>

                {/* 3D Scatter + Bubble — shared column pickers */}
                <section>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">3D Scatter & Bubble Chart</h3>
                  <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                    <div className="flex gap-3 mb-4 flex-wrap">
                      {([
                        { label: "X Axis", val: s3x, set: setS3x },
                        { label: "Y Axis", val: s3y, set: setS3y },
                        { label: "Z / Size", val: s3z, set: setS3z },
                      ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                        <div key={label} className="flex-1 min-w-[140px]">
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">{label}</label>
                          <select value={val} onChange={(e) => set(e.target.value)}
                            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Select…</option>
                            {data.numeric_cols.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>

                    {!s3Enabled && (
                      <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
                        Select three different numeric columns to render charts
                      </div>
                    )}
                    {s3Enabled && s3Loading && (
                      <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Computing…</div>
                    )}
                    {s3Enabled && !s3Loading && s3Data && (
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">3D Scatter Plot</p>
                          <Scatter3DPlot data={s3Data} />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Bubble Chart — size encodes <span className="font-mono">{s3z}</span>
                          </p>
                          <BubbleChart data={s3Data} xCol={s3x} yCol={s3y} sizeCol={s3z} />
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* PCA */}
                <section>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">PCA Analysis</h3>
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="px-4 pt-3 pb-2 border-b border-border">
                      <p className="text-xs font-bold text-foreground">Principal Component Analysis</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Score plot (PC1 vs PC2) and variable loadings across all numeric columns</p>
                    </div>
                    <div className="p-4">
                      {pcaLoading && <div className="text-center text-muted-foreground text-sm py-8 animate-pulse">Computing PCA…</div>}
                      {pcaData && <PCAPlot data={pcaData} />}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* ══════════ DATA QUALITY TAB ══════════ */}
            {activeTab === "quality" && (
              <div className="grid grid-cols-2 gap-4">
                <TabHeader label="Missing Values" />
                <Card title="Missing Value Summary"
                  desc="Columns with missing data, sorted by percentage" wide
                  insight={data.missing_charts.bar.some((r) => (r.missing_pct ?? 0) > 30)
                    ? "Some columns have >30% missing values. Consider imputation or removal."
                    : undefined}
                  insightLevel="warning">
                  <MissingTable rows={data.missing_charts.bar} />
                </Card>

                <TabHeader label="Normality Tests" />
                <Card title="Normality Tests (Shapiro-Wilk / D'Agostino K²)"
                  desc="Shapiro-Wilk for n < 5000, D'Agostino K² otherwise. p < 0.05 = non-normal." wide
                  insight={(() => {
                    const nonNorm = data.stat_cards.normality_table.filter((r) => r.is_normal === false);
                    return nonNorm.length ? `${nonNorm.length} column(s) are non-normal: ${nonNorm.map((r) => r.column).slice(0, 3).join(", ")}` : undefined;
                  })()}
                  insightLevel="info">
                  <NormalityTable rows={data.stat_cards.normality_table} />
                </Card>

                <TabHeader label="Outlier Detection" />
                <Card title="Outlier Summary (IQR Method)"
                  desc="Outliers defined as values outside Q1 − 1.5×IQR and Q3 + 1.5×IQR" wide
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
                  insightLevel="warning" wide>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total Rows",  value: data.stat_cards.duplicates.total_rows.toLocaleString(),      color: C.primary },
                      { label: "Duplicates",  value: data.stat_cards.duplicates.duplicate_count.toLocaleString(), color: (data.stat_cards.duplicates.duplicate_pct ?? 0) > 5 ? C.danger : C.muted },
                      { label: "Dup %",       value: `${data.stat_cards.duplicates.duplicate_pct?.toFixed(2) ?? "0"}%`, color: (data.stat_cards.duplicates.duplicate_pct ?? 0) > 5 ? C.danger : C.success },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-muted rounded-xl p-4 text-center border border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
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
