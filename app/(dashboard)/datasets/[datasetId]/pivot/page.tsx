"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { cn } from "@/lib/utils";
import { Download, RefreshCw } from "lucide-react";
import type { ColumnProfile, PivotResult } from "@/types";

const AGG_FUNCS = ["sum", "mean", "count", "min", "max"];

function heatColor(val: number, min: number, max: number): string {
  if (max === min) return "#f8fafc";
  const t = (val - min) / (max - min);
  const r = Math.round(239 - t * (239 - 59));
  const g = Math.round(246 - t * (246 - 130));
  const b = Math.round(255 - t * (255 - 246));
  return `rgb(${r},${g},${b})`;
}

export default function PivotPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [rowCol, setRowCol] = useState("");
  const [colCol, setColCol] = useState("");
  const [valueCol, setValueCol] = useState("");
  const [aggFunc, setAggFunc] = useState("sum");
  const [heatmap, setHeatmap] = useState(true);
  const [ready, setReady] = useState(false);

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  const columns: ColumnProfile[] = profile?.columns ?? [];
  const numericCols = columns.filter((c) => c.semantic_type === "numeric" || c.dtype?.includes("int") || c.dtype?.includes("float")).map((c) => c.name);
  const catCols = columns.filter((c) => c.semantic_type === "categorical" || c.semantic_type === "boolean").map((c) => c.name);

  const { data: pivot, isLoading: pivotLoading, refetch } = useQuery({
    queryKey: queryKeys.pivot.get(datasetId, `${rowCol}|${colCol}|${valueCol}|${aggFunc}`),
    queryFn: () => datasetsApi.getPivot(datasetId, { row_col: rowCol, col_col: colCol, value_col: valueCol, agg_func: aggFunc }).then((r) => r.data as PivotResult),
    enabled: ready && !!rowCol && !!colCol && !!valueCol,
  });

  const allVals = pivot ? pivot.data.flat() : [];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);

  const exportCsv = () => {
    if (!pivot) return;
    const rows = [["", ...pivot.columns].join(",")];
    pivot.index.forEach((rowLabel, ri) => {
      rows.push([rowLabel, ...pivot.data[ri].map((v) => String(v ?? ""))].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pivot_${rowCol}_${colCol}.csv`;
    a.click();
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Pivot Table</h1>

        {/* Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Row</label>
              <select value={rowCol} onChange={(e) => { setRowCol(e.target.value); setReady(false); }} className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand">
                <option value="">Select column...</option>
                {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Column</label>
              <select value={colCol} onChange={(e) => { setColCol(e.target.value); setReady(false); }} className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand">
                <option value="">Select column...</option>
                {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
              <select value={valueCol} onChange={(e) => { setValueCol(e.target.value); setReady(false); }} className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand">
                <option value="">Select column...</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Aggregation</label>
              <select value={aggFunc} onChange={(e) => { setAggFunc(e.target.value); setReady(false); }} className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand">
                {AGG_FUNCS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} className="rounded" />
                Heatmap
              </label>
            </div>
            <button
              onClick={() => { setReady(true); setTimeout(() => refetch(), 50); }}
              disabled={!rowCol || !colCol || !valueCol}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#2a0d8a] transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Generate
            </button>
            {pivot && (
              <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {pivotLoading && <PageSpinner />}
        {pivot && !pivotLoading && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 bg-gray-50 sticky left-0 z-10 min-w-[120px]">
                    {rowCol} / {colCol}
                  </th>
                  {pivot.columns.map((col) => (
                    <th key={col} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 bg-gray-50 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivot.index.map((rowLabel, ri) => (
                  <tr key={ri} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-700 sticky left-0 bg-white">{rowLabel}</td>
                    {pivot.data[ri].map((val, ci) => (
                      <td
                        key={ci}
                        className="px-4 py-2.5 text-right text-gray-800 font-mono text-xs"
                        style={heatmap ? { backgroundColor: heatColor(val, minVal, maxVal) } : {}}
                      >
                        {typeof val === "number" ? (Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2)) : val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!pivot && !pivotLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
            Select Row, Column, Value, and Aggregation -- then click Generate.
          </div>
        )}
      </div>
    </>
  );
}
