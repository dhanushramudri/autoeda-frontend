"use client";

import { useMemo, useState } from "react";
import type { CorrelationResult } from "@/types";
import { cn } from "@/lib/utils";


export type HeatmapMode = "numeric" | "cramers_v" | "theils_u" | "eta_sq";

interface Props {
  data: CorrelationResult;
  /** Subset of columns to display. Undefined = show all. */
  cols?: string[];
  mode?: HeatmapMode;
}

interface TooltipInfo {
  row: string;
  col: string;
  primary: number;
  secondary?: { label: string; value: number | null }[];
}


/**
 * Diverging blue–white–red for correlation [-1, +1].
 * Positive → blue, negative → red, zero → white.
 */
function divergingColor(value: number): string {
  if (value >= 0) {
    const t = value;
    return `rgb(${Math.round(255 - t * 196)},${Math.round(255 - t * 125)},${Math.round(255 - t * 9)})`;
  } else {
    const t = -value;
    return `rgb(${Math.round(255 - t * 16)},${Math.round(255 - t * 187)},${Math.round(255 - t * 187)})`;
  }
}

/**
 * Sequential purple scale for [0, 1] association metrics (Cramér's V, η², etc.).
 * 0 → white, 1 → deep purple.
 */
function sequentialColor(value: number): string {
  const t = Math.max(0, Math.min(1, value));
  const r = Math.round(255 - t * (255 - 76));
  const g = Math.round(255 - t * (255 - 29));
  const b = Math.round(255 - t * (255 - 149));
  return `rgb(${r},${g},${b})`;
}

function cellBg(mode: HeatmapMode, value: number): string {
  return mode === "numeric" ? divergingColor(value) : sequentialColor(value);
}

function cellTextColor(mode: HeatmapMode, value: number): string {
  const abs = Math.abs(value);
  return abs > 0.55 ? "rgba(255,255,255,0.95)" : "#374151";
}


function extractNumericMatrix(
  data: CorrelationResult,
  cols: string[],
): Record<string, Record<string, number | null>> {
  return Object.fromEntries(
    cols.map((r) => [
      r,
      Object.fromEntries(cols.map((c) => [c, data.matrix?.[r]?.[c] ?? null])),
    ]),
  );
}

function extractCramersMatrix(
  data: CorrelationResult,
  cols: string[],
): Record<string, Record<string, number | null>> {
  return Object.fromEntries(
    cols.map((r) => [
      r,
      Object.fromEntries(cols.map((c) => [c, data.cramers_v?.[r]?.[c] ?? null])),
    ]),
  );
}

function extractTheilsMatrix(
  data: CorrelationResult,
  cols: string[],
): Record<string, Record<string, number | null>> {
  return Object.fromEntries(
    cols.map((r) => [
      r,
      Object.fromEntries(cols.map((c) => [c, data.theils_u?.[r]?.[c] ?? null])),
    ]),
  );
}

/**
 * Mixed matrix: rows = num_cols, columns = cat_cols.
 * Returns the primary scalar (eta_sq) for each cell.
 */
function extractMixedMatrix(
  data: CorrelationResult,
  numCols: string[],
  catCols: string[],
): {
  rowLabels: string[];
  colLabels: string[];
  values: Record<string, Record<string, number | null>>;
  extras: Record<string, Record<string, { pb?: number | null; rb?: number | null; p?: number | null; ncat?: number } | null>>;
} {
  const values: Record<string, Record<string, number | null>> = {};
  const extras: Record<string, Record<string, any>> = {};

  for (const nr of numCols) {
    values[nr] = {};
    extras[nr] = {};
    for (const cc of catCols) {
      const cell = data.mixed?.[nr]?.[cc];
      if (!cell) {
        values[nr][cc] = null;
        extras[nr][cc] = null;
      } else {
        values[nr][cc] = cell.eta_sq ?? null;
        extras[nr][cc] = {
          pb:   cell.point_biserial,
          rb:   cell.rank_biserial,
          p:    cell.p_value,
          ncat: cell.n_categories,
        };
      }
    }
  }

  return { rowLabels: numCols, colLabels: catCols, values, extras };
}


function Legend({ mode }: { mode: HeatmapMode }) {
  if (mode === "numeric") {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-muted-foreground">−1</span>
        <div
          className="h-2 rounded-full flex-1 max-w-[200px]"
          style={{ background: "linear-gradient(to right, rgb(239,68,68), rgb(255,255,255), rgb(59,130,246))" }}
        />
        <span className="text-[10px] text-muted-foreground">+1</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-[10px] text-muted-foreground">0</span>
      <div
        className="h-2 rounded-full flex-1 max-w-[200px]"
        style={{ background: "linear-gradient(to right, rgb(255,255,255), rgb(76,29,149))" }}
      />
      <span className="text-[10px] text-muted-foreground">1</span>
    </div>
  );
}


function Tooltip({ info, mode, x, y }: { info: TooltipInfo; mode: HeatmapMode; x: number; y: number }) {
  return (
    <div className="fixed z-[9999] pointer-events-none bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-2xl whitespace-nowrap"
      style={{ top: y - 70, left: x, transform: "translateX(-50%)" }}
    >
      <div className="font-mono mb-1 text-muted-foreground/60">
        <span className="text-white">{info.row}</span>
        <span className="text-muted-foreground mx-1.5">×</span>
        <span className="text-white">{info.col}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold tabular-nums text-amber-300">
          {mode === "numeric" ? info.primary.toFixed(4) : info.primary.toFixed(4)}
        </span>
        {info.secondary?.map((s) =>
          s.value != null ? (
            <span key={s.label} className="text-muted-foreground">
              {s.label}: <span className="text-muted-foreground/60">{s.value.toFixed(3)}</span>
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}


interface GridProps {
  rowLabels: string[];
  colLabels: string[];
  values: Record<string, Record<string, number | null>>;
  extras?: Record<string, Record<string, any>>;
  mode: HeatmapMode;
  isDiag?: boolean; 
}

function HeatmapGrid({ rowLabels, colLabels, values, extras, mode, isDiag = true }: GridProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const n        = Math.max(rowLabels.length, colLabels.length);
  const cellSize = Math.max(20, Math.min(54, Math.floor(560 / n)));
  const showNums = cellSize >= 30;
  const fontSize = Math.max(7, Math.min(11, cellSize * 0.21));

  return (
    <div className="overflow-x-auto">
      <div className="inline-block relative">
        {tooltip && <Tooltip info={tooltip} mode={mode} x={mousePos.x} y={mousePos.y} />}

        {/* Column headers */}
        <div className="flex" style={{ marginLeft: 108, marginBottom: 2 }}>
          {colLabels.map((col) => (
            <div
              key={col}
              style={{ width: cellSize, height: 72, flexShrink: 0 }}
              className="flex items-end justify-center overflow-visible"
            >
              <span
                className="block text-muted-foreground truncate origin-bottom-left"
                style={{
                  fontSize: Math.max(8, Math.min(10, cellSize * 0.21)),
                  transform: "rotate(-50deg) translateX(-2px)",
                  maxWidth: 64,
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
        {rowLabels.map((rowCol) => (
          <div key={rowCol} className="flex items-center">
            {/* Row label */}
            <div
              className="text-muted-foreground text-right pr-2 truncate flex-shrink-0"
              style={{ width: 108, fontSize: Math.max(8, Math.min(11, cellSize * 0.21)) }}
              title={rowCol}
            >
              {rowCol}
            </div>

            {/* Cells */}
            {colLabels.map((colCol) => {
              const val    = values[rowCol]?.[colCol];
              const isDiagCell = isDiag && rowCol === colCol;
              const bg     = val != null ? cellBg(mode, val) : "#f9fafb";
              const textClr = val != null ? cellTextColor(mode, val) : "#d1d5db";

              const extra  = extras?.[rowCol]?.[colCol];
              const secondary: TooltipInfo["secondary"] = extra
                ? [
                    { label: "pb", value: extra.pb ?? null },
                    { label: "rb", value: extra.rb ?? null },
                    { label: "p",  value: extra.p  ?? null },
                  ]
                : undefined;

              return (
                <div
                  key={colCol}
                  style={{ width: cellSize, height: cellSize, backgroundColor: bg, flexShrink: 0 }}
                  className={cn(
                    "flex items-center justify-center border border-white/40 cursor-default select-none",
                    "transition-transform duration-100 hover:scale-110 hover:z-10 relative",
                    isDiagCell && "opacity-60",
                  )}
                  onMouseMove={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    if (val != null) setTooltip({ row: rowCol, col: colCol, primary: val, secondary });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {showNums && val != null && (
                    <span
                      className="font-mono text-center leading-none pointer-events-none"
                      style={{ fontSize, color: textClr }}
                    >
                      {val.toFixed(2)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}


function pBadge(p: number | null | undefined) {
  if (p == null) return null;
  const label = p < 0.001 ? "p<0.001" : p < 0.01 ? "p<0.01" : p < 0.05 ? "p<0.05" : `p=${p.toFixed(3)}`;
  const cls =
    p < 0.001
      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
      : p < 0.05
      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-block text-[9px] border rounded px-1 py-0.5 font-mono ml-1", cls)}>
      {label}
    </span>
  );
}


export function CorrelationHeatmap({ data, cols, mode = "numeric" }: Props) {
  const { matrix } = data;

  const numCols = useMemo(() => {
    const all = Object.keys(matrix ?? {});
    if (!cols || cols.length === 0) return all;
    return cols.filter((c) => all.includes(c));
  }, [matrix, cols]);

  const catCols = useMemo(
    () => Object.keys(data.cramers_v ?? {}),
    [data.cramers_v],
  );

  const mixedData = useMemo(() => {
    const mxNumCols = Object.keys(data.mixed ?? {});
    const mxCatCols =
      mxNumCols.length > 0 ? Object.keys(data.mixed![mxNumCols[0]] ?? {}) : [];
    return extractMixedMatrix(data, mxNumCols, mxCatCols);
  }, [data.mixed]);

  const profileNumCount = data.column_profile?.num_cols?.length ?? numCols.length;
  const profileCatCount = data.column_profile?.cat_cols?.length ?? catCols.length;

  if (mode === "numeric") {
    if (!matrix || numCols.length === 0) {
      return <EmptyState message="No numeric correlation data available." />;
    }
    if (numCols.length < 2) {
      return <EmptyState warn message="Select at least 2 columns to display the correlation matrix." />;
    }
    const numMatrix = extractNumericMatrix(data, numCols);
    return (
      <div className="space-y-3">
        <HeatmapHeader label={`${numCols.length} columns · ${numCols.length * numCols.length} cells`} />
        <HeatmapGrid rowLabels={numCols} colLabels={numCols} values={numMatrix} mode="numeric" isDiag />
        <Legend mode="numeric" />
      </div>
    );
  }

  if (mode === "cramers_v") {
    if (!data.cramers_v && profileCatCount >= 2) {
      return <EmptyState loading message="Computing categorical associations…" />;
    }
    if (!data.cramers_v || catCols.length < 2) {
      return <EmptyState message="Not enough categorical columns for Cramér's V matrix." />;
    }
    const cramersMatrix = extractCramersMatrix(data, catCols);
    return (
      <div className="space-y-3">
        <HeatmapHeader label={`${catCols.length} categorical columns · bias-corrected`} />
        <HeatmapGrid rowLabels={catCols} colLabels={catCols} values={cramersMatrix} mode="cramers_v" isDiag />
        <Legend mode="cramers_v" />
        <p className="text-[10px] text-muted-foreground mt-1">
          Cramér's V ∈ [0, 1] — higher values indicate stronger categorical association.
          Diagonal is always 1 (self-association).
        </p>
      </div>
    );
  }

  if (mode === "theils_u") {
    if (!data.theils_u && profileCatCount >= 2) {
      return <EmptyState loading message="Computing categorical associations…" />;
    }
    if (!data.theils_u || catCols.length < 2) {
      return <EmptyState message="Not enough categorical columns for Theil's U matrix." />;
    }
    const theilsMatrix = extractTheilsMatrix(data, catCols);
    return (
      <div className="space-y-3">
        <HeatmapHeader label={`${catCols.length} categorical columns · asymmetric (row → column)`} />
        <HeatmapGrid rowLabels={catCols} colLabels={catCols} values={theilsMatrix} mode="theils_u" isDiag />
        <Legend mode="theils_u" />
        <p className="text-[10px] text-muted-foreground mt-1">
          Theil's U is asymmetric: cell [row, col] = how much knowing <em>row</em> reduces uncertainty about <em>col</em>.
          Values near 1 = row almost perfectly predicts col.
        </p>
      </div>
    );
  }

  if (mode === "eta_sq") {
    if (!data.mixed && profileNumCount >= 1 && profileCatCount >= 1) {
      return <EmptyState loading message="Computing mixed numeric × categorical associations…" />;
    }
    if (!data.mixed || mixedData.rowLabels.length === 0 || mixedData.colLabels.length === 0) {
      return <EmptyState message="No mixed numeric×categorical data available." />;
    }
    return (
      <div className="space-y-3">
        <HeatmapHeader label={`${mixedData.rowLabels.length} numeric × ${mixedData.colLabels.length} categorical`} />
        <p className="text-[10px] text-muted-foreground">
          η² = proportion of variance in the numeric variable explained by the categorical variable (one-way ANOVA).
          Hover cells for point-biserial r and rank-biserial r where applicable.
        </p>
        <HeatmapGrid
          rowLabels={mixedData.rowLabels}
          colLabels={mixedData.colLabels}
          values={mixedData.values}
          extras={mixedData.extras}
          mode="eta_sq"
          isDiag={false}
        />
        <Legend mode="eta_sq" />
      </div>
    );
  }

  return null;
}


function HeatmapHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function EmptyState({ message, warn, loading }: { message: string; warn?: boolean; loading?: boolean }) {
  return (
    <p
      className={cn(
        "text-sm py-8 text-center rounded-xl flex items-center justify-center gap-2",
        warn
          ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
          : loading
          ? "text-blue-500 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40"
          : "text-muted-foreground",
      )}
    >
      {loading && <span className="w-3 h-3 border-2 border-blue-300 dark:border-blue-700 border-t-blue-500 rounded-full animate-spin" />}
      {message}
    </p>
  );
}