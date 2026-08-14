"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { OutlierResult } from "@/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

interface OutlierPlotProps {
  data: OutlierResult;
  selectedColumn?: string;
  onColumnChange?: (column: string) => void;
}

export function OutlierPlot({
  data,
  selectedColumn,
  onColumnChange,
}: OutlierPlotProps) {
  const column = selectedColumn || data.columns[0]?.name || "";

  const plotData = useMemo(() => {
    if (!column || !data.columns) return [];

    const columnData = data.columns.find((col) => col.name === column);
    if (!columnData) return [];

    // Create dummy data for box plot (this would be actual data in real implementation)
    return [
      {
        y: [], // In real implementation, fetch actual numeric values for the column
        name: column,
        type: "box",
        boxmean: "sd",
        marker: { color: "#3b82f6" },
      },
    ];
  }, [column, data]);

  const layout = {
    title: `Outlier Analysis - ${column}`,
    yaxis: { title: "Value" },
    showlegend: false,
    height: 400,
    margin: { l: 60, r: 20, t: 40, b: 40 },
  };

  return (
    <div className="w-full space-y-4">
      {data.columns.length > 1 && onColumnChange && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Select Column:</label>
          <select
            value={column}
            onChange={(e) => onColumnChange(e.target.value)}
            className="rounded border border-border px-2 py-1 text-sm"
          >
            {data.columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.outlier_count} outliers)
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded border border-border bg-card p-4">
        <Plot
          data={plotData}
          layout={layout}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Outlier Summary Table */}
      <div className="rounded border border-border bg-card">
        <table className="w-full">
          <thead className="border-b bg-muted">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold">
                Column
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold">
                Outlier Count
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold">
                Outlier %
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold">
                Bounds
              </th>
            </tr>
          </thead>
          <tbody>
            {data.columns.map((col) => (
              <tr key={col.name} className="border-b hover:bg-muted">
                <td className="px-4 py-2 text-sm">{col.name}</td>
                <td className="px-4 py-2 text-sm">{col.outlier_count}</td>
                <td className="px-4 py-2 text-sm">
                  {col.outlier_pct.toFixed(2)}%
                </td>
                <td className="px-4 py-2 text-sm text-muted-foreground">
                  [{col.bounds.lower?.toFixed(2)}, {col.bounds.upper?.toFixed(2)}]
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
