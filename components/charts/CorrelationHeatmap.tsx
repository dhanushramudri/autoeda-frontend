"use client";

import { useMemo, useState } from "react";
import type { CorrelationResult } from "@/types";
import { AskAiButton } from "@/components/ai/AskAiButton";
import { cn } from "@/lib/utils";

interface Props {
  data: CorrelationResult;
  /** Subset of columns to display. When omitted, all matrix columns are shown. */
  cols?: string[];
}

/** Diverging colour: -1 → red, 0 → white, +1 → blue */
function cellColor(value: number): string {
  if (value >= 0) {
    const t  = value;                          // 0→1
    const r  = Math.round(255 - t * (255 - 59));
    const g  = Math.round(255 - t * (255 - 130));
    const b  = Math.round(255 - t * (255 - 246));
    return `rgb(${r},${g},${b})`;
  } else {
    const t  = -value;                         // 0→1
    const r  = Math.round(255 - t * (255 - 239));
    const g  = Math.round(255 - t * (255 - 68));
    const b  = Math.round(255 - t * (255 - 68));
    return `rgb(${r},${g},${b})`;
  }
}

function textColor(value: number): string {
  return Math.abs(value) > 0.55 ? "rgba(255,255,255,0.95)" : "#374151";
}

export function CorrelationHeatmap({ data, cols }: Props) {
  const { matrix } = data;
  const [tooltip, setTooltip] = useState<{ row: string; col: string; val: number } | null>(null);

  const displayCols: string[] = useMemo(() => {
    const all = Object.keys(matrix ?? {});
    if (!cols || cols.length === 0) return all;
    return cols.filter((c) => all.includes(c));
  }, [matrix, cols]);

  if (!matrix || displayCols.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        No correlation data for the selected columns.
      </p>
    );
  }

  if (displayCols.length < 2) {
    return (
      <p className="text-sm text-amber-600 py-8 text-center bg-amber-50 rounded-xl">
        Select at least 2 columns to display the correlation matrix.
      </p>
    );
  }

  // Dynamic cell sizing: fit within a comfortable viewport width
  const n        = displayCols.length;
  const cellSize = Math.max(20, Math.min(54, Math.floor(600 / n)));
  const showNums = cellSize >= 32;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{n} columns · {n * n} cells</span>
        <AskAiButton
          question="Explain the top correlations in this heatmap. Which pairs are strongly correlated and could cause multicollinearity?"
          label="Explain correlations"
          variant="chip"
        />
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block relative">
          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-20 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap"
              style={{ top: -36, left: "50%", transform: "translateX(-50%)" }}
            >
              <span className="font-mono">{tooltip.row}</span>
              <span className="text-gray-400 mx-1">×</span>
              <span className="font-mono">{tooltip.col}</span>
              <span className="ml-2 font-semibold">{tooltip.val.toFixed(4)}</span>
            </div>
          )}

          {/* Column header labels (angled) */}
          <div className="flex" style={{ marginLeft: 100, marginBottom: 2 }}>
            {displayCols.map((col) => (
              <div
                key={col}
                style={{ width: cellSize, height: 70, flexShrink: 0 }}
                className="flex items-end justify-center overflow-visible"
              >
                <span
                  className="block text-gray-500 truncate origin-bottom-left"
                  style={{
                    fontSize: Math.max(8, Math.min(10, cellSize * 0.22)),
                    transform: "rotate(-50deg) translateX(-2px)",
                    maxWidth: 60,
                    display: "block",
                    whiteSpace: "nowrap",
                  }}
                  title={col}
                >
                  {col}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {displayCols.map((rowCol) => (
            <div key={rowCol} className="flex items-center">
              {/* Row label */}
              <div
                className="text-gray-500 text-right pr-2 truncate flex-shrink-0"
                style={{ width: 100, fontSize: Math.max(8, Math.min(11, cellSize * 0.22)) }}
                title={rowCol}
              >
                {rowCol}
              </div>

              {/* Cells */}
              {displayCols.map((colCol) => {
                const val      = matrix[rowCol]?.[colCol];
                const isDiag   = rowCol === colCol;
                const bg       = val != null ? cellColor(val) : "#f9fafb";
                const textClr  = val != null ? textColor(val) : "#d1d5db";
                const display  = val != null ? val.toFixed(2) : "—";

                return (
                  <div
                    key={colCol}
                    style={{ width: cellSize, height: cellSize, backgroundColor: bg, flexShrink: 0 }}
                    className={cn(
                      "flex items-center justify-center border border-white/50 cursor-default select-none transition-transform duration-100 hover:scale-110 hover:z-10 relative",
                      isDiag && "opacity-70",
                    )}
                    onMouseEnter={() => val != null && setTooltip({ row: rowCol, col: colCol, val })}
                    onMouseLeave={() => setTooltip(null)}
                    title={`${rowCol} × ${colCol}: ${display}`}
                  >
                    {showNums && (
                      <span
                        className="font-mono text-center leading-none pointer-events-none"
                        style={{ fontSize: Math.max(7, Math.min(11, cellSize * 0.22)), color: textClr }}
                      >
                        {display}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Colour legend */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-gray-400">−1</span>
        <div
          className="h-2 rounded-full flex-1 max-w-[200px]"
          style={{
            background: "linear-gradient(to right, rgb(239,68,68), rgb(255,255,255), rgb(59,130,246))",
          }}
        />
        <span className="text-[10px] text-gray-400">+1</span>
      </div>
    </div>
  );
}
