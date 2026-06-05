"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { CorrelationHeatmap, type HeatmapMode } from "@/components/charts/CorrelationHeatmap";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AskAiButton } from "@/components/ai/AskAiButton";
import { useAiContextStore } from "@/store/aiContextStore";
import { cn } from "@/lib/utils";
import {
  Search, X, CheckSquare, Square, Hash, Tag, Shuffle,
  ChevronDown, ChevronRight, Lightbulb, AlertTriangle, Info,
} from "lucide-react";
import type { CorrelationResult, MixedPair, CatPair } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const METHODS = ["pearson", "spearman", "kendall"] as const;
type Method = (typeof METHODS)[number];

const METHOD_DESC: Record<Method, string> = {
  pearson:  "Linear relationships between continuous variables",
  spearman: "Monotonic relationships, robust to outliers",
  kendall:  "Rank-based, best for small datasets or ordinal data",
};

const HEATMAP_VIEWS: {
  key: HeatmapMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    key: "numeric",
    label: "Numeric",
    icon: <Hash className="w-3.5 h-3.5" />,
    description: "Pearson / Spearman / Kendall correlation between numeric columns",
  },
  {
    key: "cramers_v",
    label: "Cramér's V",
    icon: <Tag className="w-3.5 h-3.5" />,
    description: "Symmetric bias-corrected association between categorical columns",
  },
  {
    key: "theils_u",
    label: "Theil's U",
    icon: <Tag className="w-3.5 h-3.5" />,
    description: "Asymmetric: how much does knowing row reduce uncertainty about column?",
  },
  {
    key: "eta_sq",
    label: "η² Mixed",
    icon: <Shuffle className="w-3.5 h-3.5" />,
    description: "Variance in numeric column explained by categorical group (ANOVA)",
  },
];


function deriveNumCols(data: CorrelationResult): string[] {
  if (data.column_profile?.num_cols?.length) return data.column_profile.num_cols;
  return Object.keys(data.matrix ?? {});
}

function deriveCatCols(data: CorrelationResult): string[] {
  if (data.column_profile?.cat_cols?.length) return data.column_profile.cat_cols;
  return Object.keys(data.cramers_v ?? {});
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function absVal(v: number | null | undefined): number {
  return v != null ? Math.abs(v) : 0;
}

function corrColor(r: number): string {
  return r > 0.7
    ? "text-blue-600"
    : r > 0.4
    ? "text-blue-500"
    : r < -0.7
    ? "text-red-600"
    : r < -0.4
    ? "text-red-500"
    : "text-gray-600";
}

function effectColor(v: number): string {
  return v >= 0.14 ? "text-purple-700" : v >= 0.06 ? "text-purple-500" : "text-gray-500";
}


function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-gray-800">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}


type InsightType = "warning" | "info" | "muted";

const INSIGHT_CONFIG: Record<
  InsightType,
  { icon: React.ReactNode; bg: string; border: string; text: string }
> = {
  warning: {
    icon:   <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />,
    bg:     "bg-amber-50",
    border: "border-amber-100",
    text:   "text-amber-900",
  },
  info: {
    icon:   <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />,
    bg:     "bg-blue-50",
    border: "border-blue-100",
    text:   "text-blue-900",
  },
  muted: {
    icon:   <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />,
    bg:     "bg-gray-50",
    border: "border-gray-100",
    text:   "text-gray-500",
  },
};


interface Insight {
  type: InsightType;
  category: string;
  message: string;
}

function CollapsibleInsights({ insights }: { insights?: Insight[] | null }) {
  const [open, setOpen] = useState(false);

  if (!insights || insights.length === 0) return null;

  return (
    <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-700 flex-1">
          Insights
          <span className="ml-1.5 font-normal text-gray-400">({insights.length})</span>
        </span>
        {open
          ? <ChevronDown  className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        }
      </button>

      {open && (
        <div className="px-4 py-3 bg-white flex flex-col gap-2">
          {insights.map((insight, i) => {
            const cfg = INSIGHT_CONFIG[insight.type] ?? INSIGHT_CONFIG.muted;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs",
                  cfg.bg,
                  cfg.border,
                  cfg.text,
                )}
              >
                {cfg.icon}
                <span className="leading-relaxed">
                  <MarkdownText text={insight.message} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Column selector sidebar ───────────────────────────────────────────────────

interface SidebarProps {
  numCols: string[];
  catCols: string[];
  catCardinality?: Record<string, number>;
  deselected: Set<string>;
  onChange: (col: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

function ColumnSidebar({
  numCols,
  catCols,
  catCardinality = {},
  deselected,
  onChange,
  onSelectAll,
  onSelectNone,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const allActive = useMemo(() => [...numCols, ...catCols], [numCols, catCols]);
  const filterFn  = (c: string) => !search || c.toLowerCase().includes(search.toLowerCase());
  const visibleNum = numCols.filter(filterFn);
  const visibleCat = catCols.filter(filterFn);
  const selectedCount = allActive.length - deselected.size;

  const HIGH_CARD = 50;

  function ColRow({ col, type }: { col: string; type: "num" | "cat" }) {
    const checked    = !deselected.has(col);
    const cardinality = type === "cat" ? (catCardinality[col] ?? 0) : 0;
    const highCard   = type === "cat" && cardinality > HIGH_CARD;

    return (
      <button
        onClick={() => onChange(col)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition",
          checked ? "text-gray-700 hover:bg-gray-50" : "text-gray-400 hover:bg-gray-50",
        )}
        title={highCard ? `${col} — high cardinality (${cardinality} unique values)` : col}
      >
        {checked
          ? <CheckSquare className="w-3.5 h-3.5 text-brand flex-shrink-0" />
          : <Square      className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        }
        <span className="font-mono truncate flex-1">{col}</span>
        {highCard && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-orange-50 text-orange-400 border border-orange-100 flex-shrink-0 mr-0.5">
            {cardinality}
          </span>
        )}
        <span
          className={cn(
            "text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0",
            type === "num"
              ? "bg-blue-50 text-blue-500"
              : "bg-purple-50 text-purple-500",
          )}
        >
          {type === "num" ? "N" : "C"}
        </span>
      </button>
    );
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col max-h-[80vh] sticky top-20">
      <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Columns</span>
          <span className="text-[10px] text-gray-400 tabular-nums">
            {selectedCount}/{allActive.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="w-full pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex gap-1 mt-2">
          <button
            onClick={onSelectAll}
            className="flex-1 text-[10px] py-1 border border-gray-200 rounded text-gray-500 hover:border-brand/60 hover:text-brand transition"
          >
            All
          </button>
          <button
            onClick={onSelectNone}
            className="flex-1 text-[10px] py-1 border border-gray-200 rounded text-gray-500 hover:border-red-200 hover:text-red-500 transition"
          >
            None
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-1 py-1 scrollbar-hide">
        {visibleNum.length > 0 && (
          <>
            <p className="text-[9px] uppercase tracking-wider text-gray-400 px-2 pt-1 pb-0.5">
              Numeric ({numCols.length})
            </p>
            {visibleNum.map((col) => <ColRow key={col} col={col} type="num" />)}
          </>
        )}
        {visibleCat.length > 0 && (
          <>
            <p className="text-[9px] uppercase tracking-wider text-gray-400 px-2 pt-2 pb-0.5">
              Categorical ({catCols.length})
            </p>
            {visibleCat.map((col) => <ColRow key={col} col={col} type="cat" />)}
          </>
        )}
        {visibleNum.length === 0 && visibleCat.length === 0 && (
          <p className="text-[10px] text-gray-400 px-2 py-3">No columns match.</p>
        )}
      </div>
    </aside>
  );
}

// ── VIF table ─────────────────────────────────────────────────────────────────

function VifTable({
  vif,
  visibleCols,
}: {
  vif: Array<{ column: string; vif: number }>;
  visibleCols: string[];
}) {
  const filtered = vif.filter((v) => visibleCols.includes(v.column));
  if (filtered.length === 0) return null;
  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Variance Inflation Factor (VIF)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            VIF &gt; 5: moderate concern · VIF &gt; 10: high multicollinearity
          </p>
        </div>
        <AskAiButton
          question="Looking at these VIF scores, which columns have multicollinearity concerns and what should I do about them?"
          label="What should I do?"
          variant="chip"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
        {[...filtered].sort((a, b) => b.vif - a.vif).map((v) => (
          <div
            key={v.column}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2.5 text-xs border",
              v.vif > 10
                ? "bg-red-50 border-red-100"
                : v.vif > 5
                ? "bg-amber-50 border-amber-100"
                : "bg-gray-50 border-gray-100",
            )}
          >
            <span className="font-mono text-gray-700 truncate mr-2">{v.column}</span>
            <span
              className={cn(
                "font-bold tabular-nums flex-shrink-0",
                v.vif > 10 ? "text-red-600" : v.vif > 5 ? "text-amber-600" : "text-emerald-600",
              )}
            >
              {v.vif.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top numeric pairs ─────────────────────────────────────────────────────────

function TopNumericPairs({
  pairs,
}: {
  pairs: Array<{ col1: string; col2: string; correlation: number }>;
}) {
  if (pairs.length === 0) return null;
  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">
          Strongest Numeric Pairs{" "}
          <span className="text-gray-400 font-normal">(by |r|)</span>
        </h3>
        <AskAiButton
          question="Which numeric column pairs are most strongly correlated, and are any of them problematic for a machine-learning model?"
          label="Explain pairs"
          variant="chip"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pairs.map((pair, i) => {
          const abs = Math.abs(pair.correlation);
          return (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="text-xs font-mono text-gray-600 truncate flex-1 min-w-0">
                {pair.col1}
                <span className="text-gray-400 mx-1.5">×</span>
                {pair.col2}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", pair.correlation >= 0 ? "bg-blue-400" : "bg-red-400")}
                    style={{ width: `${abs * 100}%` }}
                  />
                </div>
                <span className={cn("text-xs font-semibold tabular-nums w-12 text-right", corrColor(pair.correlation))}>
                  {pair.correlation.toFixed(3)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function TopCatPairs({ pairs }: { pairs: CatPair[] }) {
  if (!pairs || pairs.length === 0) return null;
  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">
          Strongest Categorical Associations{" "}
          <span className="text-gray-400 font-normal">(Cramér's V)</span>
        </h3>
        <AskAiButton
          question="Which categorical column pairs show the strongest association by Cramér's V? Are any near-redundant?"
          label="Explain"
          variant="chip"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pairs.slice(0, 12).map((pair, i) => (
          <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
            <span className="text-xs font-mono text-gray-600 truncate flex-1 min-w-0">
              {pair.col1}
              <span className="text-gray-400 mx-1.5">×</span>
              {pair.col2}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-purple-400" style={{ width: `${pair.cramers_v * 100}%` }} />
              </div>
              <span className="text-xs font-semibold tabular-nums w-12 text-right text-purple-700">
                {pair.cramers_v.toFixed(3)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function TopMixedPairs({ pairs }: { pairs: MixedPair[] }) {
  if (!pairs || pairs.length === 0) return null;
  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Top Numeric × Categorical Pairs{" "}
            <span className="text-gray-400 font-normal">(η²)</span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            η² ≥ 0.14 = large effect · ≥ 0.06 = medium · &lt; 0.06 = small
          </p>
        </div>
        <AskAiButton
          question="Which categorical features explain the most variance in numeric columns? Are there strong group effects?"
          label="Explain η²"
          variant="chip"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pairs.slice(0, 12).map((pair, i) => {
          const eta = pair.eta_sq ?? 0;
          return (
            <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-600 truncate flex-1 min-w-0">
                  <span className="text-purple-600">{pair.cat_col}</span>
                  <span className="text-gray-400 mx-1.5">→</span>
                  {pair.num_col}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-400"
                      style={{ width: `${Math.min((eta / 0.3) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-semibold tabular-nums w-12 text-right", effectColor(eta))}>
                    {eta.toFixed(3)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                {pair.point_biserial != null && (
                  <span className="text-[10px] text-gray-400">
                    pb-r:{" "}
                    <span className={cn("font-mono", pair.point_biserial > 0 ? "text-blue-500" : "text-red-500")}>
                      {pair.point_biserial.toFixed(3)}
                    </span>
                  </span>
                )}
                {pair.rank_biserial != null && (
                  <span className="text-[10px] text-gray-400">
                    rb-r:{" "}
                    <span className="font-mono text-gray-600">{pair.rank_biserial.toFixed(3)}</span>
                  </span>
                )}
                {pair.p_value != null && (
                  <span
                    className={cn(
                      "text-[9px] border rounded px-1 py-0.5 font-mono",
                      pair.p_value < 0.001
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : pair.p_value < 0.05
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-gray-50 text-gray-400 border-gray-200",
                    )}
                  >
                    {pair.p_value < 0.001
                      ? "p<0.001"
                      : pair.p_value < 0.01
                      ? "p<0.01"
                      : pair.p_value < 0.05
                      ? "p<0.05"
                      : `p=${pair.p_value.toFixed(3)}`}
                  </span>
                )}
                <span className="text-[10px] text-gray-300 ml-auto">{pair.n_categories} groups</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ProfilePills({ numCols, catCols }: { numCols: string[]; catCols: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {numCols.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          <Hash className="w-3 h-3" />
          {numCols.length} numeric
        </span>
      )}
      {catCols.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
          <Tag className="w-3 h-3" />
          {catCols.length} categorical
        </span>
      )}
    </div>
  );
}


function HeatmapTabs({
  active, hasNumeric, hasCat, hasMixed, onChange,
}: {
  active: HeatmapMode;
  hasNumeric: boolean;
  hasCat: boolean;
  hasMixed: boolean;
  onChange: (m: HeatmapMode) => void;
}) {
  const available = HEATMAP_VIEWS.filter((v) => {
    if (v.key === "numeric") return hasNumeric;
    if (v.key === "cramers_v" || v.key === "theils_u") return hasCat;
    if (v.key === "eta_sq") return hasMixed;
    return false;
  });

  if (available.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
      {available.map((v) => (
        <button
          key={v.key}
          onClick={() => onChange(v.key)}
          title={v.description}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition",
            v.key === active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
          )}
        >
          {v.icon}
          {v.label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CorrelationsPage() {
  const { datasetId }  = useParams<{ datasetId: string }>();
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const setPageContext = useAiContextStore((s) => s.setPageContext);

  const method = (searchParams.get("method") as Method) ?? "pearson";
  const [deselected, setDeselected]   = useState<Set<string>>(new Set());
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("numeric");

  const setMethod = (m: Method) =>
    router.replace(`/datasets/${datasetId}/correlations?method=${m}`);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn:  () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.correlations(datasetId, method),
    queryFn:  () =>
      datasetsApi.getCorrelations(datasetId, method).then((r) => r.data as CorrelationResult),
  });

  const allNumCols = useMemo(() => (data ? deriveNumCols(data) : []), [data]);
  const allCatCols = useMemo(() => (data ? deriveCatCols(data) : []), [data]);
  const allCols    = useMemo(() => [...allNumCols, ...allCatCols], [allNumCols, allCatCols]);
  const catCardinality = useMemo(
    () => data?.column_profile?.cat_cardinality ?? {},
    [data],
  );

  const hasNumeric = allNumCols.length >= 2;
  const hasCat     = allCatCols.length >= 2;
  const hasMixed   = allNumCols.length >= 1 && allCatCols.length >= 1;

  useEffect(() => {
    if (!data) return;
    setHeatmapMode(!hasNumeric && hasCat ? "cramers_v" : "numeric");
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setDeselected(new Set()); }, [method]);

  // ── Filtered visible columns ───────────────────────────────────────────────
  const visibleNumCols = useMemo(
    () => allNumCols.filter((c) => !deselected.has(c)),
    [allNumCols, deselected],
  );
  const visibleCatCols = useMemo(
    () => allCatCols.filter((c) => !deselected.has(c)),
    [allCatCols, deselected],
  );

  // ── Top pairs (filtered) ───────────────────────────────────────────────────
  const topNumericPairs = useMemo(() => {
    if (!data?.matrix || visibleNumCols.length < 2) return [];
    const pairs: Array<{ col1: string; col2: string; correlation: number }> = [];
    visibleNumCols.forEach((c1, i) => {
      visibleNumCols.slice(i + 1).forEach((c2) => {
        const r = data.matrix[c1]?.[c2];
        if (r != null) pairs.push({ col1: c1, col2: c2, correlation: r });
      });
    });
    return pairs.sort((a, b) => absVal(b.correlation) - absVal(a.correlation)).slice(0, 12);
  }, [data, visibleNumCols]);

  const topCatPairs = useMemo(
    () => (data?.cat_top_pairs ?? []).filter(
      (p) => visibleCatCols.includes(p.col1) && visibleCatCols.includes(p.col2),
    ),
    [data, visibleCatCols],
  );

  const topMixedPairs = useMemo(
    () => (data?.mixed_top_pairs ?? []).filter(
      (p) => visibleNumCols.includes(p.num_col) && visibleCatCols.includes(p.cat_col),
    ),
    [data, visibleNumCols, visibleCatCols],
  );

  useEffect(() => {
    const top3Num   = topNumericPairs.slice(0, 3).map((p) => `${p.col1}↔${p.col2}: ${p.correlation.toFixed(2)}`).join(", ");
    const top3Mixed = topMixedPairs.slice(0, 3).map((p) => `${p.cat_col}→${p.num_col}: η²=${p.eta_sq?.toFixed(2)}`).join(", ");
    setPageContext({
      page:  "correlations",
      label: `Correlations (${method})`,
      details: {
        method,
        view:             heatmapMode,
        numeric_cols:     visibleNumCols.length,
        categorical_cols: visibleCatCols.length,
        total_cols:       allCols.length,
        top_numeric_pairs: top3Num   || "none",
        top_mixed_pairs:   top3Mixed || "none",
      },
      suggestedQuestions: [
        "Which columns are most strongly correlated?",
        "Are any correlations problematic for modeling?",
        "Which categorical features have the most group-level variance?",
        "What do the VIF scores indicate?",
        "Are there near-redundant categorical columns?",
      ],
    });
    return () => setPageContext(null);
  }, [method, heatmapMode, topNumericPairs, topMixedPairs,
      visibleNumCols.length, visibleCatCols.length, allCols.length, setPageContext]);

  // ── Sidebar handlers ───────────────────────────────────────────────────────
  const toggleCol  = useCallback((col: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  }, []);
  const selectAll  = useCallback(() => setDeselected(new Set()), []);
  const selectNone = useCallback(() => setDeselected(new Set(allCols)), [allCols]);

  function renderTopPairs() {
    if (heatmapMode === "numeric")                                  return <TopNumericPairs pairs={topNumericPairs} />;
    if (heatmapMode === "cramers_v" || heatmapMode === "theils_u") return <TopCatPairs pairs={topCatPairs} />;
    if (heatmapMode === "eta_sq")                                   return <TopMixedPairs pairs={topMixedPairs} />;
    return null;
  }

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-full mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Correlations" },
          ]}
        />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mt-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Correlations</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Pairwise associations — numeric, categorical, and mixed
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition",
                    m === method ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mr-1">{METHOD_DESC[method]}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-5">
            <div className="w-56 flex-shrink-0 h-64 bg-gray-100 rounded-xl animate-pulse" />
            <div className="flex-1 h-64 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : data ? (
          <div className="flex gap-5 items-start">
            {/* Sidebar */}
            <ColumnSidebar
              numCols={allNumCols}
              catCols={allCatCols}
              catCardinality={catCardinality}
              deselected={deselected}
              onChange={toggleCol}
              onSelectAll={selectAll}
              onSelectNone={selectNone}
            />

            {/* Main panel */}
            <div className="flex-1 min-w-0">

              <ProfilePills numCols={allNumCols} catCols={allCatCols} />

              <CollapsibleInsights insights={data.insights} />

              <div className="bg-white rounded-xl border border-gray-200 p-6">

                {deselected.size > 0 && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-xs text-blue-700">
                      Showing{" "}
                      <strong>{visibleNumCols.length + visibleCatCols.length}</strong>{" "}
                      of <strong>{allCols.length}</strong> columns.
                    </span>
                    <button onClick={selectAll} className="text-xs text-brand hover:underline ml-1">
                      Show all
                    </button>
                  </div>
                )}

                <HeatmapTabs
                  active={heatmapMode}
                  hasNumeric={hasNumeric}
                  hasCat={hasCat}
                  hasMixed={hasMixed}
                  onChange={setHeatmapMode}
                />

                <CorrelationHeatmap
                  data={data}
                  cols={heatmapMode === "numeric" ? visibleNumCols : undefined}
                  mode={heatmapMode}
                />

                {renderTopPairs()}

                {heatmapMode === "numeric" && data.vif && data.vif.length > 0 && (
                  <VifTable vif={data.vif} visibleCols={visibleNumCols} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}