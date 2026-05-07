"use client";

import { useMemo } from "react";
import type { CorrelationResult } from "@/types";

interface Props {
  data: CorrelationResult;
}

function interpolate(value: number): string {
  // -1 → red, 0 → white, 1 → blue
  const r = value < 0 ? 239 : Math.round(239 - (value * 189));
  const g = value < 0 ? Math.round(68 + (value + 1) * 100) : Math.round(68 + (1 - value) * 100);
  const b = value < 0 ? Math.round(68 + (value + 1) * 100) : 239;
  return `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`;
}

export function CorrelationHeatmap({ data }: Props) {
  const { matrix, columns } = data;

  if (!matrix || !columns || columns.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No correlation data available.</p>;
  }

  const cellSize = Math.max(28, Math.min(52, Math.floor(580 / columns.length)));

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Column headers */}
        <div className="flex ml-[80px] mb-0.5">
          {columns.map((col) => (
            <div
              key={col}
              style={{ width: cellSize }}
              className="text-[9px] text-gray-500 text-center overflow-hidden"
              title={col}
            >
              <span
                className="block rotate-[-45deg] origin-bottom-left translate-x-2 translate-y-1 truncate"
                style={{ maxWidth: 60 }}
              >
                {col}
              </span>
            </div>
          ))}
        </div>
        {/* Rows */}
        {columns.map((rowCol, ri) => (
          <div key={rowCol} className="flex items-center">
            <div
              className="text-[9px] text-gray-500 text-right pr-2 truncate"
              style={{ width: 80 }}
              title={rowCol}
            >
              {rowCol}
            </div>
            {columns.map((colCol, ci) => {
              const val = matrix[rowCol]?.[colCol];
              const display = val !== null && val !== undefined ? val.toFixed(2) : "—";
              const bg = val !== null && val !== undefined ? interpolate(val) : "#f3f4f6";
              const isText = val !== null && val !== undefined && Math.abs(val) > 0.5;
              return (
                <div
                  key={colCol}
                  style={{ width: cellSize, height: cellSize, backgroundColor: bg }}
                  className="flex items-center justify-center border border-white/40 cursor-default transition-transform hover:scale-110 hover:z-10 relative"
                  title={`${rowCol} × ${colCol}: ${display}`}
                >
                  <span
                    className="text-[9px] font-mono select-none"
                    style={{ color: isText ? "white" : "#374151" }}
                  >
                    {display}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Top pairs */}
      {data.top_pairs && data.top_pairs.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">Top Correlated Pairs</p>
          <div className="grid grid-cols-2 gap-2">
            {data.top_pairs.slice(0, 10).map((pair, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                <span className="text-gray-600 truncate">
                  <span className="font-mono">{pair.col1}</span>
                  <span className="text-gray-400 mx-1">×</span>
                  <span className="font-mono">{pair.col2}</span>
                </span>
                <span
                  className="font-semibold ml-2 flex-shrink-0"
                  style={{ color: pair.correlation > 0 ? "#3b82f6" : "#ef4444" }}
                >
                  {pair.correlation.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
