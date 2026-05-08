"use client";

import { useMemo, useState } from "react";
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
} from "recharts";

// Plotly loaded client-only to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const BRAND = "#3411A3";
const BRAND_LIGHT = "#7C5CDB";
const PALETTE = [
  "#3411A3", "#7C5CDB", "#FF6196", "#26D4F0", "#F59E0B",
  "#10B981", "#EF4444", "#8B5CF6", "#06B6D4", "#84CC16",
];

// ── Small chart components ─────────────────────────────────────────────────────

function HistogramKDEChart({ data, col }: { data: NumericCharts["histogram_kde"]; col: string }) {
  if (!data?.bins?.length) return <EmptyChart />;
  const traces: Plotly.Data[] = [
    {
      x: data.bins as number[],
      y: data.counts as number[],
      type: "bar",
      name: "Count",
      marker: { color: BRAND, opacity: 0.7 },
    },
  ];
  if (data.kde_x?.length) {
    traces.push({
      x: data.kde_x as number[],
      y: data.kde_y as number[],
      type: "scatter",
      mode: "lines",
      name: "KDE",
      line: { color: "#FF6196", width: 2 },
    });
  }
  // Mean/median lines
  const shapes: Partial<Plotly.Shape>[] = [];
  if (data.mean != null) {
    shapes.push({ type: "line", x0: data.mean, x1: data.mean, y0: 0, y1: 1, yref: "paper" as const,
      line: { color: "#F59E0B", width: 1.5, dash: "dash" } });
  }
  if (data.median != null) {
    shapes.push({ type: "line", x0: data.median, x1: data.median, y0: 0, y1: 1, yref: "paper" as const,
      line: { color: "#10B981", width: 1.5, dash: "dot" } });
  }

  return (
    <Plot
      data={traces}
      layout={{
        ...BASE_LAYOUT,
        shapes,
        xaxis: { title: col },
        yaxis: { title: "Count" },
        legend: { orientation: "h", y: -0.2 },
      }}
      config={PLOT_CONFIG}
      style={PLOT_STYLE}
      useResizeHandler
    />
  );
}

function BoxPlotChart({ data, col }: { data: NumericCharts["box"]; col: string }) {
  if (!data?.q1) return <EmptyChart />;
  return (
    <Plot
      data={[{
        type: "box",
        y: [
          ...(data.outliers as number[]),
          data.min!, data.q1!, data.median!, data.q3!, data.max!,
        ],
        q1: [data.q1!], median: [data.median!], q3: [data.q3!],
        lowerfence: [data.min!], upperfence: [data.max!],
        mean: [data.mean ?? data.median!],
        name: col,
        marker: { color: BRAND, outliercolor: "#EF4444" },
        boxpoints: "outliers",
        jitter: 0.3,
      } as Plotly.Data]}
      layout={{ ...BASE_LAYOUT, yaxis: { title: col } }}
      config={PLOT_CONFIG}
      style={PLOT_STYLE}
      useResizeHandler
    />
  );
}

function ViolinChart({ data, col }: { data: NumericCharts["violin"]; col: string }) {
  if (!data?.y?.length) return <EmptyChart />;
  return (
    <Plot
      data={[{
        type: "violin",
        y: data.y as number[],
        name: col,
        box: { visible: true },
        meanline: { visible: true },
        line: { color: BRAND },
        fillcolor: BRAND_LIGHT,
        opacity: 0.6,
      } as Plotly.Data]}
      layout={{ ...BASE_LAYOUT, yaxis: { title: col } }}
      config={PLOT_CONFIG}
      style={PLOT_STYLE}
      useResizeHandler
    />
  );
}

function QQChart({ data }: { data: NumericCharts["qq"] }) {
  if (!data?.theoretical?.length) return <EmptyChart />;
  return (
    <Plot
      data={[
        {
          x: data.theoretical as number[],
          y: data.sample as number[],
          mode: "markers",
          type: "scatter",
          name: "Sample",
          marker: { color: BRAND, size: 4, opacity: 0.6 },
        },
        {
          x: data.line_x as number[],
          y: data.line_y as number[],
          mode: "lines",
          type: "scatter",
          name: "Normal",
          line: { color: "#EF4444", width: 2 },
        },
      ]}
      layout={{
        ...BASE_LAYOUT,
        xaxis: { title: "Theoretical quantiles" },
        yaxis: { title: "Sample quantiles" },
        legend: { orientation: "h", y: -0.2 },
      }}
      config={PLOT_CONFIG}
      style={PLOT_STYLE}
      useResizeHandler
    />
  );
}

function ECDFChart({ data, col }: { data: NumericCharts["ecdf"]; col: string }) {
  if (!data?.x?.length) return <EmptyChart />;
  return (
    <Plot
      data={[{
        x: data.x as number[],
        y: data.y as number[],
        mode: "lines",
        type: "scatter",
        name: "ECDF",
        line: { color: BRAND, width: 2, shape: "hv" },
      }]}
      layout={{
        ...BASE_LAYOUT,
        xaxis: { title: col },
        yaxis: { title: "Cumulative probability", range: [0, 1] },
      }}
      config={PLOT_CONFIG}
      style={PLOT_STYLE}
      useResizeHandler
    />
  );
}

function CatBarChart({ data, col }: { data: CategoricalCharts["bar"]; col: string }) {
  if (!data?.labels?.length) return <EmptyChart />;
  const rows = data.labels.map((l, i) => ({
    label: l.length > 20 ? l.slice(0, 18) + ".." : l,
    value: data.values[i],
    pct: data.percentages[i],
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} layout="vertical" margin={{ left: 80, right: 20 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={80} />
        <Tooltip formatter={(v: number, n: string, p) => [`${v} (${p.payload.pct?.toFixed(1)}%)`, col]} />
        <Bar dataKey="value" fill={BRAND} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CatPieChart({ data }: { data: CategoricalCharts["pie"] }) {
  if (!data?.labels?.length) return <EmptyChart />;
  const rows = data.labels.map((l, i) => ({ name: l, value: data.values[i] }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%"
          outerRadius={90} innerRadius={40} paddingAngle={2}>
          {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => v.toLocaleString()} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ParetoChart({ data }: { data: CategoricalCharts["pareto"] }) {
  if (!data?.labels?.length) return <EmptyChart />;
  const rows = data.labels.map((l, i) => ({
    label: l.length > 14 ? l.slice(0, 12) + ".." : l,
    value: data.values[i],
    cumPct: data.cumulative_pct[i],
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" />
        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]}
          tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip />
        <Bar yAxisId="left" dataKey="value" fill={BRAND} opacity={0.8} />
        <Line yAxisId="right" type="monotone" dataKey="cumPct"
          stroke="#FF6196" strokeWidth={2} dot={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TimeSeriesLineChart({ data }: { data: DatetimeCharts["timeseries"] }) {
  if (!data?.dates?.length) return <EmptyChart />;
  const rows = data.dates.map((d, i) => ({ date: d, value: data.values[i] }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke={BRAND} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SeasonalityCharts({ data }: { data: DatetimeCharts["seasonality"] }) {
  if (!data?.by_hour) return <EmptyChart />;
  const charts = [
    { title: "By Hour", items: data.by_hour },
    { title: "By Day of Week", items: data.by_dow },
    { title: "By Month", items: data.by_month },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {charts.map(({ title, items }) => (
        <div key={title}>
          <p className="text-[10px] font-semibold text-gray-500 mb-1">{title}</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={items.labels.map((l, i) => ({ l, v: items.values[i] }))}
              margin={{ bottom: 20 }}>
              <XAxis dataKey="l" tick={{ fontSize: 8 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 8 }} />
              <Bar dataKey="v" fill={BRAND} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}

function CorrelationHeatmap({ data }: { data: FullAnalysisResult["multi_column"]["correlation"] }) {
  if (!data?.labels?.length) return <EmptyChart message="Need 2+ numeric columns" />;
  return (
    <Plot
      data={[{
        z: data.z as number[][],
        x: data.labels,
        y: data.labels,
        type: "heatmap",
        colorscale: [
          [0, "#EF4444"], [0.5, "#ffffff"], [1, BRAND],
        ],
        zmin: -1, zmax: 1,
        text: (data.z as number[][]).map((row) =>
          row.map((v) => (v != null ? v.toFixed(2) : ""))
        ) as string[][] as Plotly.Data["text"],
        texttemplate: "%{text}",
        hovertemplate: "%{x} x %{y}: %{z:.3f}<extra></extra>",
      } as Plotly.Data]}
      layout={{ ...BASE_LAYOUT, xaxis: { tickangle: -30 }, yaxis: { tickangle: 0 } }}
      config={PLOT_CONFIG}
      style={PLOT_STYLE}
      useResizeHandler
    />
  );
}

function ScatterPairChart({ pair }: { pair: FullAnalysisResult["multi_column"]["scatter_pairs"][0] }) {
  if (!pair?.x?.length) return <EmptyChart />;
  const traces: Plotly.Data[] = [
    {
      x: pair.x as number[],
      y: pair.y as number[],
      mode: "markers",
      type: "scatter",
      name: "Data",
      marker: { color: BRAND, size: 4, opacity: 0.5 },
    },
  ];
  if (pair.line_x?.length) {
    traces.push({
      x: pair.line_x,
      y: pair.line_y,
      mode: "lines",
      type: "scatter",
      name: `Trend (R²=${pair.r2?.toFixed(2) ?? "?"})`,
      line: { color: "#FF6196", width: 2 },
    });
  }
  return (
    <Plot
      data={traces}
      layout={{
        ...BASE_LAYOUT,
        xaxis: { title: pair.col1 },
        yaxis: { title: pair.col2 },
        title: { text: `r = ${pair.pearson_r?.toFixed(3) ?? "?"}`, font: { size: 11 } },
        legend: { orientation: "h", y: -0.25 },
      }}
      config={PLOT_CONFIG}
      style={PLOT_STYLE}
      useResizeHandler
    />
  );
}

function GroupedBoxChart({ data }: { data: FullAnalysisResult["multi_column"]["grouped_box"] }) {
  if (!data?.groups || Object.keys(data.groups).length === 0) return <EmptyChart />;
  const traces: Plotly.Data[] = Object.entries(data.groups).map(([grp, stats], i) => ({
    type: "box",
    y: [stats.min!, stats.q1!, stats.median!, stats.q3!, stats.max!, ...stats.outliers as number[]],
    q1: [stats.q1!], median: [stats.median!], q3: [stats.q3!],
    lowerfence: [stats.min!], upperfence: [stats.max!],
    name: grp,
    marker: { color: PALETTE[i % PALETTE.length] },
    boxpoints: "outliers",
  } as Plotly.Data));
  return (
    <Plot
      data={traces}
      layout={{
        ...BASE_LAYOUT,
        yaxis: { title: data.numeric_col },
        xaxis: { title: data.categorical_col },
        boxmode: "group",
      }}
      config={PLOT_CONFIG}
      style={PLOT_STYLE}
      useResizeHandler
    />
  );
}

// ── Stat card tables ───────────────────────────────────────────────────────────

function NormalityTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["normality_table"] }) {
  if (!rows.length) return <EmptyChart message="No numeric columns" />;
  return (
    <div className="overflow-auto w-full">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-100">
            {["Column", "n", "Test", "p-value", "Normal?", "Skewness", "Kurtosis"].map((h) => (
              <th key={h} className="text-left px-2 py-1.5 text-gray-500 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.column} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-2 py-1.5 font-mono font-medium text-gray-800">{r.column}</td>
              <td className="px-2 py-1.5 text-gray-600">{r.n.toLocaleString()}</td>
              <td className="px-2 py-1.5 text-gray-500 uppercase">{r.test}</td>
              <td className="px-2 py-1.5 text-gray-600">{r.p_value?.toFixed(4) ?? "--"}</td>
              <td className="px-2 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  r.is_normal ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {r.is_normal === null ? "?" : r.is_normal ? "Yes" : "No"}
                </span>
              </td>
              <td className={`px-2 py-1.5 font-medium ${
                Math.abs(r.skewness ?? 0) > 1 ? "text-red-600" :
                Math.abs(r.skewness ?? 0) > 0.5 ? "text-amber-600" : "text-green-600"
              }`}>{r.skewness?.toFixed(3) ?? "--"}</td>
              <td className="px-2 py-1.5 text-gray-600">{r.kurtosis?.toFixed(3) ?? "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutlierTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["outlier_summary"] }) {
  if (!rows.length) return <EmptyChart message="No numeric columns" />;
  return (
    <div className="overflow-auto w-full">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-100">
            {["Column", "Outliers", "%", "Lower Bound", "Upper Bound"].map((h) => (
              <th key={h} className="text-left px-2 py-1.5 text-gray-500 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.column} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-2 py-1.5 font-mono font-medium text-gray-800">{r.column}</td>
              <td className="px-2 py-1.5 text-gray-600">{r.outlier_count.toLocaleString()}</td>
              <td className={`px-2 py-1.5 font-semibold ${
                (r.outlier_pct ?? 0) > 10 ? "text-red-600" :
                (r.outlier_pct ?? 0) > 5 ? "text-amber-600" : "text-gray-600"
              }`}>{r.outlier_pct?.toFixed(2) ?? "--"}%</td>
              <td className="px-2 py-1.5 text-gray-500">{r.lower_bound?.toFixed(3) ?? "--"}</td>
              <td className="px-2 py-1.5 text-gray-500">{r.upper_bound?.toFixed(3) ?? "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardinalityTable({ rows }: { rows: FullAnalysisResult["stat_cards"]["cardinality"] }) {
  const FLAG_STYLES: Record<string, string> = {
    id_like: "bg-purple-100 text-purple-700",
    constant: "bg-gray-100 text-gray-500",
    binary: "bg-sky-100 text-sky-700",
    low_cardinality: "bg-green-100 text-green-700",
    normal: "bg-white text-gray-500 border border-gray-200",
  };
  return (
    <div className="overflow-auto w-full">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-100">
            {["Column", "Type", "Unique", "Unique %", "Flag"].map((h) => (
              <th key={h} className="text-left px-2 py-1.5 text-gray-500 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.column} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-2 py-1.5 font-mono font-medium text-gray-800">{r.column}</td>
              <td className="px-2 py-1.5 text-gray-500">{r.dtype}</td>
              <td className="px-2 py-1.5 text-gray-600">{r.unique_count.toLocaleString()}</td>
              <td className="px-2 py-1.5 text-gray-600">{r.unique_pct?.toFixed(1) ?? "--"}%</td>
              <td className="px-2 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${FLAG_STYLES[r.flag]}`}>
                  {r.flag.replace("_", " ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingBar({ rows }: { rows: FullAnalysisResult["stat_cards"]["missing_bar"] }) {
  if (!rows.length) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
      No missing values - dataset is complete
    </div>
  );
  return (
    <div className="overflow-auto w-full">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Column</th>
            <th className="text-left px-2 py-1.5 text-gray-500 font-semibold w-1/2">Missing</th>
            <th className="text-right px-2 py-1.5 text-gray-500 font-semibold">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.column} className="border-b border-gray-50">
              <td className="px-2 py-1.5 font-mono font-medium text-gray-800">{r.column}</td>
              <td className="px-2 py-1.5 w-1/2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(r.missing_pct ?? 0, 100)}%`,
                        background: (r.missing_pct ?? 0) > 50 ? "#EF4444" :
                          (r.missing_pct ?? 0) > 20 ? "#F59E0B" : "#3411A3",
                      }}
                    />
                  </div>
                  <span className="text-gray-500 text-[10px] w-12 text-right">
                    {r.missing_count.toLocaleString()}
                  </span>
                </div>
              </td>
              <td className="px-2 py-1.5 text-right font-semibold" style={{
                color: (r.missing_pct ?? 0) > 50 ? "#EF4444" :
                  (r.missing_pct ?? 0) > 20 ? "#F59E0B" : "#374151",
              }}>
                {r.missing_pct?.toFixed(1) ?? "--"}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function EmptyChart({ message = "Not enough data" }: { message?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
      {message}
    </div>
  );
}

const BASE_LAYOUT: Partial<Plotly.Layout> = {
  margin: { l: 50, r: 20, t: 20, b: 50 },
  font: { size: 10, family: "Inter, sans-serif" },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  showlegend: true,
};

const PLOT_CONFIG: Partial<Plotly.Config> = {
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
  responsive: true,
};

const PLOT_STYLE = { width: "100%", height: "260px" };

// ── Left sidebar ───────────────────────────────────────────────────────────────

type ChartTypeKey = "histograms" | "boxplots" | "violins" | "qq" | "ecdf"
  | "categorical" | "datetime" | "correlation" | "scatter" | "grouped_box"
  | "missing" | "stat_cards";

const CHART_TYPE_LABELS: Record<ChartTypeKey, string> = {
  histograms: "Histograms + KDE",
  boxplots: "Box Plots",
  violins: "Violin Plots",
  qq: "QQ Plots",
  ecdf: "ECDF",
  categorical: "Categorical",
  datetime: "Date/Time",
  correlation: "Correlation Heatmap",
  scatter: "Scatter Pairs",
  grouped_box: "Grouped Box",
  missing: "Missing Values",
  stat_cards: "Statistical Cards",
};

function AnalysisSidebar({
  data,
  visibleCols,
  toggleCol,
  visibleTypes,
  toggleType,
}: {
  data: FullAnalysisResult;
  visibleCols: Set<string>;
  toggleCol: (c: string) => void;
  visibleTypes: Set<ChartTypeKey>;
  toggleType: (t: ChartTypeKey) => void;
}) {
  const allCols = [...data.numeric_cols, ...data.categorical_cols, ...data.datetime_cols];
  const allVisible = allCols.every((c) => visibleCols.has(c));

  function toggleAll() {
    if (allVisible) allCols.forEach(toggleCol);
    else allCols.filter((c) => !visibleCols.has(c)).forEach(toggleCol);
  }

  const TYPE_ICON: Record<string, string> = { numeric: "#", categorical: "A", datetime: "D" };

  return (
    <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto scrollbar-thin">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Columns</p>
        <button onClick={toggleAll} className="mt-1 text-[10px] text-brand hover:underline">
          {allVisible ? "Hide All" : "Show All"}
        </button>
      </div>

      <div className="px-3 py-2 space-y-0.5">
        {allCols.map((col) => {
          const t = data.column_types[col];
          return (
            <label key={col} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleCols.has(col)}
                onChange={() => toggleCol(col)}
                className="accent-brand w-3 h-3"
              />
              <span className="text-[9px] font-bold text-gray-400 w-3">{TYPE_ICON[t] ?? "?"}</span>
              <span className="text-xs text-gray-700 truncate">{col}</span>
            </label>
          );
        })}
      </div>

      <div className="px-4 pt-3 pb-1 border-t border-gray-100 mt-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Chart Types</p>
      </div>
      <div className="px-3 pb-3 space-y-0.5">
        {(Object.keys(CHART_TYPE_LABELS) as ChartTypeKey[]).map((k) => (
          <label key={k} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={visibleTypes.has(k)}
              onChange={() => toggleType(k)}
              className="accent-brand w-3 h-3"
            />
            <span className="text-xs text-gray-700">{CHART_TYPE_LABELS[k]}</span>
          </label>
        ))}
      </div>
    </aside>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { datasetId } = useParams<{ datasetId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.eda.analysis(datasetId),
    queryFn: () => datasetsApi.getAnalysis(datasetId).then((r) => r.data as FullAnalysisResult),
    staleTime: 1000 * 60 * 10,
  });

  const allCols = useMemo(() => {
    if (!data) return [];
    return [...data.numeric_cols, ...data.categorical_cols, ...data.datetime_cols];
  }, [data]);

  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [visibleTypes, setVisibleTypes] = useState<Set<ChartTypeKey>>(
    new Set(Object.keys(CHART_TYPE_LABELS) as ChartTypeKey[])
  );

  // Initialise visibleCols once data arrives
  useMemo(() => {
    if (allCols.length > 0 && visibleCols.size === 0) {
      setVisibleCols(new Set(allCols));
    }
  }, [allCols]);

  function toggleCol(col: string) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  }

  function toggleType(t: ChartTypeKey) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  const show = (t: ChartTypeKey) => visibleTypes.has(t);
  const colVisible = (c: string) => visibleCols.has(c);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <SubNav datasetId={datasetId} />

      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <PageSpinner />
          <p className="text-sm text-gray-400 animate-pulse">Computing analysis...</p>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-500 font-semibold text-sm">Analysis failed</p>
            <p className="text-gray-400 text-xs mt-1">{(error as Error).message}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="flex flex-1 overflow-hidden">
          <AnalysisSidebar
            data={data}
            visibleCols={visibleCols}
            toggleCol={toggleCol}
            visibleTypes={visibleTypes}
            toggleType={toggleType}
          />

          <main className="flex-1 overflow-y-auto p-6">
            {/* Sampled banner */}
            {data.sampled && (
              <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                Showing charts based on a {data.sample_size.toLocaleString()}-row sample
                (full dataset: {data.total_rows.toLocaleString()} rows)
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">

              {/* ── Numeric columns ──────────────────────────────────────────── */}
              {data.numeric_cols.filter(colVisible).map((col) => {
                const charts = data.numeric_charts[col];
                if (!charts) return null;
                const insight = charts.skewness != null && Math.abs(charts.skewness) > 1
                  ? `High skewness (${charts.skewness?.toFixed(2)}). Distribution is not symmetric.`
                  : null;

                return (
                  <div key={col} className="contents">
                    <SectionHeader label={`${col} (numeric)`} count={
                      [show("histograms"), show("boxplots"), show("violins"), show("qq"), show("ecdf")]
                        .filter(Boolean).length
                    } />

                    {show("histograms") && (
                      <ChartCard title={`Histogram + KDE — ${col}`}
                        description="Distribution of values with kernel density estimate overlay."
                        insight={insight ?? undefined}
                        insightSeverity={Math.abs(charts.skewness ?? 0) > 2 ? "danger" : "warning"}>
                        <HistogramKDEChart data={charts.histogram_kde} col={col} />
                      </ChartCard>
                    )}

                    {show("boxplots") && (
                      <ChartCard title={`Box Plot — ${col}`}
                        description="Q1/Q2/Q3/whiskers with outlier dots.">
                        <BoxPlotChart data={charts.box} col={col} />
                      </ChartCard>
                    )}

                    {show("violins") && (
                      <ChartCard title={`Violin Plot — ${col}`}
                        description="Full distribution shape via kernel density estimate.">
                        <ViolinChart data={charts.violin} col={col} />
                      </ChartCard>
                    )}

                    {show("qq") && (
                      <ChartCard title={`QQ Plot — ${col}`}
                        description="Sample quantiles vs theoretical normal quantiles."
                        insight={charts.normality?.is_normal === false
                          ? `Non-normal (p=${charts.normality.p_value?.toFixed(4)})` : undefined}
                        insightSeverity="warning">
                        <QQChart data={charts.qq} />
                      </ChartCard>
                    )}

                    {show("ecdf") && (
                      <ChartCard title={`ECDF — ${col}`}
                        description="Empirical cumulative distribution function.">
                        <ECDFChart data={charts.ecdf} col={col} />
                      </ChartCard>
                    )}
                  </div>
                );
              })}

              {/* ── Categorical columns ──────────────────────────────────────── */}
              {data.categorical_cols.filter(colVisible).map((col) => {
                const charts = data.categorical_charts[col];
                if (!charts) return null;
                const total = charts.bar.total_categories;
                return (
                  <div key={col} className="contents">
                    <SectionHeader label={`${col} (categorical)`} count={
                      [show("categorical")].filter(Boolean).length * (charts.pie ? 3 : 2)
                    } />

                    {show("categorical") && (
                      <>
                        <ChartCard title={`Bar Chart — ${col}`}
                          description={`Top ${Math.min(total, 20)} of ${total} categories.`}
                          insight={total > 50
                            ? `High cardinality: ${total} unique values.` : undefined}
                          insightSeverity="warning">
                          <CatBarChart data={charts.bar} col={col} />
                        </ChartCard>

                        {charts.pie && (
                          <ChartCard title={`Pie Chart — ${col}`}
                            description="Proportional breakdown by category.">
                            <CatPieChart data={charts.pie} />
                          </ChartCard>
                        )}

                        <ChartCard title={`Pareto Chart — ${col}`}
                          description="Bars sorted by frequency + cumulative percentage line.">
                          <ParetoChart data={charts.pareto} />
                        </ChartCard>
                      </>
                    )}
                  </div>
                );
              })}

              {/* ── Datetime columns ─────────────────────────────────────────── */}
              {data.datetime_cols.filter(colVisible).map((col) => {
                const charts = data.datetime_charts[col];
                if (!charts) return null;
                return (
                  <div key={col} className="contents">
                    <SectionHeader label={`${col} (datetime)`} />

                    {show("datetime") && (
                      <>
                        <ChartCard title={`Time Series — ${col}`}
                          description="Event count over time (auto-aggregated)." isWide>
                          <TimeSeriesLineChart data={charts.timeseries} />
                        </ChartCard>

                        <ChartCard title={`Seasonality — ${col}`}
                          description="Distribution by hour, day of week, and month." isWide>
                          <SeasonalityCharts data={charts.seasonality} />
                        </ChartCard>
                      </>
                    )}
                  </div>
                );
              })}

              {/* ── Multi-column ─────────────────────────────────────────────── */}
              {(show("correlation") || show("scatter") || show("grouped_box")) && (
                <>
                  <SectionHeader label="Multi-Column Analysis" />

                  {show("correlation") && (
                    <ChartCard title="Correlation Heatmap"
                      description="Pearson correlation between all numeric columns." isWide>
                      <div style={{ height: 300 }}>
                        <CorrelationHeatmap data={data.multi_column.correlation} />
                      </div>
                    </ChartCard>
                  )}

                  {show("scatter") && data.multi_column.scatter_pairs.map((pair) => (
                    <ChartCard key={`${pair.col1}-${pair.col2}`}
                      title={`Scatter: ${pair.col1} × ${pair.col2}`}
                      description={`Pearson r = ${pair.pearson_r?.toFixed(3) ?? "?"}`}>
                      <ScatterPairChart pair={pair} />
                    </ChartCard>
                  ))}

                  {show("grouped_box") && data.multi_column.grouped_box?.groups && (
                    <ChartCard title={`Grouped Box: ${data.multi_column.grouped_box.numeric_col} by ${data.multi_column.grouped_box.categorical_col}`}
                      description="Distribution of highest-variance numeric column split by category." isWide>
                      <GroupedBoxChart data={data.multi_column.grouped_box} />
                    </ChartCard>
                  )}
                </>
              )}

              {/* ── Missing values ────────────────────────────────────────────── */}
              {show("missing") && (
                <>
                  <SectionHeader label="Missing Values" />
                  <ChartCard title="Missing Value Summary"
                    description="Columns sorted by % missing. Bar length = missing %." isWide
                    insight={
                      data.missing_charts.bar.some((r) => (r.missing_pct ?? 0) > 30)
                        ? "Some columns have >30% missing values. Consider imputation or dropping."
                        : undefined
                    }
                    insightSeverity="warning">
                    <MissingBar rows={data.missing_charts.bar} />
                  </ChartCard>
                </>
              )}

              {/* ── Statistical cards ─────────────────────────────────────────── */}
              {show("stat_cards") && (
                <>
                  <SectionHeader label="Statistical Analysis" />

                  <ChartCard title="Normality Tests"
                    description="Shapiro-Wilk (n<5000) or D'Agostino K² per numeric column." isWide>
                    <NormalityTable rows={data.stat_cards.normality_table} />
                  </ChartCard>

                  <ChartCard title="Outlier Summary (IQR)"
                    description="Outlier count and bounds per numeric column." isWide>
                    <OutlierTable rows={data.stat_cards.outlier_summary} />
                  </ChartCard>

                  <ChartCard title="Cardinality Analysis"
                    description="Unique value count and type flags per column." isWide>
                    <CardinalityTable rows={data.stat_cards.cardinality} />
                  </ChartCard>

                  <ChartCard title="Duplicates"
                    description="Duplicate row count in the dataset."
                    insight={
                      (data.stat_cards.duplicates.duplicate_pct ?? 0) > 5
                        ? `${data.stat_cards.duplicates.duplicate_pct?.toFixed(1)}% duplicate rows detected.`
                        : undefined
                    }
                    insightSeverity="warning">
                    <div className="flex flex-col gap-4 p-4 w-full">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Total Rows", value: data.stat_cards.duplicates.total_rows.toLocaleString() },
                          { label: "Duplicates", value: data.stat_cards.duplicates.duplicate_count.toLocaleString() },
                          { label: "Dup %", value: `${data.stat_cards.duplicates.duplicate_pct?.toFixed(2) ?? "0"}%` },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ChartCard>
                </>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
