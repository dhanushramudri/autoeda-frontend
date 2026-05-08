"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Save, Trash2, Download } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from "recharts";
import type { ColumnProfile, SavedChart } from "@/types";

const CHART_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "scatter", label: "Scatter" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "histogram", label: "Histogram" },
];

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#f43f5e", "#0ea5e9"];

export default function ChartsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const qc = useQueryClient();
  const [chartType, setChartType] = useState("bar");
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [colorCol, setColorCol] = useState("");
  const [chartName, setChartName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  const { data: savedCharts } = useQuery({
    queryKey: queryKeys.charts.saved(datasetId),
    queryFn: () => datasetsApi.getSavedCharts(datasetId).then((r) => r.data as SavedChart[]),
    enabled: !!datasetId,
  });

  const columns: ColumnProfile[] = profile?.columns ?? [];
  const numericCols = columns.filter((c) => c.semantic_type === "numeric" || c.dtype?.includes("int") || c.dtype?.includes("float")).map((c) => c.name);

  const buildChart = async () => {
    if (!xCol && chartType !== "pie") return;
    setLoadingPreview(true);
    try {
      const res = await datasetsApi.preview(datasetId);
      const rows: Record<string, unknown>[] = res.data.rows ?? [];
      setPreviewData(rows.slice(0, 200));
    } catch {
      // ignore
    } finally {
      setLoadingPreview(false);
    }
  };

  const saveChartMutation = useMutation({
    mutationFn: () =>
      datasetsApi.saveChart(datasetId, {
        name: chartName || `${chartType}_${xCol}_${yCol}`,
        chart_type: chartType,
        config: { xCol, yCol, colorCol, chartType },
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.charts.saved(datasetId) });
      setShowSaveForm(false);
      setChartName("");
    },
  });

  const deleteChartMutation = useMutation({
    mutationFn: (chartId: number) => datasetsApi.deleteSavedChart(datasetId, chartId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.charts.saved(datasetId) }),
  });

  const renderChart = () => {
    if (previewData.length === 0) return null;
    const data = previewData.map((row) => ({
      x: row[xCol],
      y: yCol ? Number(row[yCol]) : 0,
      name: row[xCol],
      value: yCol ? Number(row[yCol]) : 0,
    }));

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="y" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === "line" || chartType === "area") {
      const Comp = chartType === "area" ? AreaChart : LineChart;
      const DataComp = chartType === "area" ? Area : Line;
      return (
        <ResponsiveContainer width="100%" height={380}>
          <Comp data={data} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <DataComp type="monotone" dataKey="y" stroke="#3b82f6" fill="#bfdbfe" dot={false} strokeWidth={2} />
          </Comp>
        </ResponsiveContainer>
      );
    }
    if (chartType === "scatter") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="x" type="number" name={xCol} tick={{ fontSize: 11 }} />
            <YAxis dataKey="y" type="number" name={yCol} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill="#3b82f6" opacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === "pie") {
      const pieData = data.slice(0, 10);
      return (
        <ResponsiveContainer width="100%" height={380}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={140} label>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Chart Builder</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Controls */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 h-fit">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Chart Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CHART_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    onClick={() => setChartType(ct.value)}
                    className={`text-xs py-1.5 rounded-lg border transition ${
                      chartType === ct.value ? "bg-brand text-white border-brand" : "border-gray-200 text-gray-600 hover:border-brand/60"
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">X Axis</label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none">
                <option value="">Select...</option>
                {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Y Axis</label>
              <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none">
                <option value="">Select...</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button
              onClick={buildChart}
              disabled={(!xCol && chartType !== "pie") || loadingPreview}
              className="w-full py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-[#2a0d8a] disabled:opacity-50 transition"
            >
              {loadingPreview ? "Loading..." : "Build Chart"}
            </button>

            {previewData.length > 0 && (
              <button
                onClick={() => setShowSaveForm(true)}
                className="w-full py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> Save Chart
              </button>
            )}

            {showSaveForm && (
              <div className="space-y-2">
                <input
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                  placeholder="Chart name..."
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => saveChartMutation.mutate()}
                    disabled={saveChartMutation.isPending}
                    className="flex-1 text-xs bg-brand text-white rounded-lg py-1.5"
                  >
                    Save
                  </button>
                  <button onClick={() => setShowSaveForm(false)} className="text-xs border border-gray-200 rounded-lg py-1.5 px-2">x</button>
                </div>
              </div>
            )}
          </div>

          {/* Chart preview */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
            {loadingPreview && <PageSpinner />}
            {!loadingPreview && previewData.length === 0 && (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Select columns and click Build Chart to preview.
              </div>
            )}
            {!loadingPreview && previewData.length > 0 && renderChart()}
          </div>
        </div>

        {/* Saved charts */}
        {savedCharts && savedCharts.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Saved Charts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {savedCharts.map((chart) => (
                <div key={chart.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{chart.name}</p>
                    <p className="text-xs text-gray-400">{chart.chart_type}</p>
                  </div>
                  <button
                    onClick={() => deleteChartMutation.mutate(chart.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
