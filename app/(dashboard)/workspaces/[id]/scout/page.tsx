"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scoutApi, datasetsApi, aiApi, uploadToPresignedUrl } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Markdown } from "@/components/shared/Markdown";
import { Mascot } from "@/components/shared/Mascot";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import type { ScoutMessage, ScoutThread, ScoutSuggestion, ScoutToolCall, ScoutConversation } from "@/types";
import {
  Send, Sparkles, Bot, Loader2, ChevronDown, ChevronUp,
  Database, Wand2, AlertCircle, ShieldAlert, Type, SearchCheck,
  Plus, Trash2, MessageSquare, Link2, PanelLeftClose, PanelLeftOpen,
  Square, Pencil, X, Image as ImageIcon,
} from "lucide-react";
import { MissingHeatmap } from "@/components/charts/MissingHeatmap";
import { CorrelationHeatmap } from "@/components/charts/CorrelationHeatmap";
import { QualityGauge } from "@/components/charts/QualityGauge";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { DataTable } from "@/components/shared/DataTable";
import type { TextResult } from "@/types";

// No dedicated text-analysis chart component exists in the product yet —
// this is a compact, purpose-built summary rather than a half-fit reuse.
function TextSummary({ result }: { result: Record<string, unknown> }) {
  const r = result as unknown as TextResult;
  if (!r?.word_freq) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Type className="w-3.5 h-3.5 text-muted-foreground" />{r.total_texts.toLocaleString()} texts</span>
        <span>avg length {Math.round(r.avg_length)}</span>
        {r.sentiment_dist && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400">+{r.sentiment_dist.positive}</span>
            <span className="text-muted-foreground">·{r.sentiment_dist.neutral}</span>
            <span className="text-red-500 dark:text-red-400">-{r.sentiment_dist.negative}</span>
          </span>
        )}
      </div>
      {r.word_freq.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.word_freq.slice(0, 12).map((w) => (
            <span key={w.word} className="px-2 py-0.5 rounded-full bg-muted border border-border text-[11px] text-muted-foreground">
              {w.word} <span className="text-muted-foreground">{w.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RelationshipsSummary({ result }: { result: Record<string, unknown> }) {
  const rels = result.relationships as Array<{ dataset_a: string; dataset_b: string; description: string }> | undefined;
  if (!rels?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      {rels.map((r, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <Link2 className="w-3.5 h-3.5 text-violet-400 dark:text-violet-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-foreground">{r.dataset_a}</span>
            <span className="text-muted-foreground"> ↔ </span>
            <span className="font-medium text-foreground">{r.dataset_b}</span>
            <p className="text-muted-foreground mt-0.5">{r.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchColumnsSummary({ result }: { result: Record<string, unknown> }) {
  const matches = result.matches as Array<{ dataset_id: number; dataset_name: string; column: string; type: string }> | undefined;
  if (!matches) return null;
  if (!matches.length) {
    return <p className="text-xs text-muted-foreground italic px-1">No matching columns found.</p>;
  }
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
      {matches.map((m, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <SearchCheck className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-foreground">{m.column}</span>
          <span className="text-muted-foreground">in {m.dataset_name}</span>
          <span className="ml-auto text-muted-foreground/60 font-mono">{m.type}</span>
        </div>
      ))}
    </div>
  );
}

// OutlierPlot isn't reused here on purpose: its box-plot is a pre-existing
// stub (always renders empty) and its bounds table assumes lower/upper keys
// that isolation_forest's result doesn't have. This summary is built to match
// exactly what get_outliers actually returns.
function OutlierSummary({ result }: { result: Record<string, unknown> }) {
  const columns = result.columns as Array<{ name: string; outlier_count: number; outlier_pct: number; bounds?: { lower?: number; upper?: number } }> | undefined;
  if (!columns?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
      {columns.map((c) => (
        <div key={c.name} className="flex items-center gap-3">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-medium text-foreground flex-1 truncate">{c.name}</span>
          <span className="text-xs text-muted-foreground">{c.outlier_count.toLocaleString()} rows</span>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 w-12 text-right">{c.outlier_pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function ShapSummary({ result }: { result: Record<string, unknown> }) {
  const shapValues = result.shap_values as Array<{ feature: string; mean_abs_shap?: number; importance?: number }> | undefined;
  if (!shapValues?.length) return null;
  const sorted = [...shapValues].sort((a, b) => (b.mean_abs_shap ?? b.importance ?? 0) - (a.mean_abs_shap ?? a.importance ?? 0)).slice(0, 10);
  const max = Math.max(...sorted.map((s) => s.mean_abs_shap ?? s.importance ?? 0), 1e-9);
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
      {sorted.map((s) => {
        const v = s.mean_abs_shap ?? s.importance ?? 0;
        return (
          <div key={s.feature} className="flex items-center gap-2.5">
            <span className="text-xs text-muted-foreground w-32 truncate flex-shrink-0">{s.feature}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, backgroundColor: "hsl(var(--primary))" }} />
            </div>
            <span className="text-[11px] text-muted-foreground w-12 text-right">{v.toFixed(3)}</span>
          </div>
        );
      })}
    </div>
  );
}

function QualityRulesSummary({ result }: { result: Record<string, unknown> }) {
  const rules = result.rules as Array<{ label: string; pass_pct: number; fail_count: number }> | undefined;
  if (!rules) return null;
  if (!rules.length) return <p className="text-xs text-muted-foreground italic px-1">No quality rules configured for this dataset yet.</p>;
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          {r.fail_count === 0 ? (
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex-shrink-0" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground flex-1 truncate">{r.label}</span>
          <span className="text-xs text-muted-foreground">{r.fail_count.toLocaleString()} failing</span>
          <span className="text-xs font-semibold w-12 text-right" style={{ color: r.fail_count === 0 ? "#059669" : "#d97706" }}>{r.pass_pct.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

function StatTestSummary({ result }: { result: Record<string, unknown> }) {
  if (!result.test) return null;
  const p = result.p_value as number;
  const significant = p < 0.05;
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground">{String(result.label ?? result.test)}</span>
        <span className={cn("ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full", significant ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400" : "bg-muted text-muted-foreground")}>
          p = {p.toFixed(4)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{String(result.interpretation)}</p>
    </div>
  );
}

function ActionConfirmation({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 text-xs text-emerald-700 dark:text-emerald-400 w-fit">
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </div>
  );
}

/** Only renders a clean tabular result or short printed output — a nested/
 * scalar dict (the common shape for a custom "check a bunch of things at
 * once" script) has no readable generic rendering, and the answer's prose
 * already covers whatever it found; dumping raw JSON just added noise.
 * Full detail is still available via the trace's "show raw proof" toggle. */
function PythonResultSummary({ result }: { result: Record<string, unknown> }) {
  const value = result.result;
  const stdout = result.stdout as string | undefined;
  const isTable = Array.isArray(value) && value.length > 0 && typeof value[0] === "object";
  if (!isTable && !stdout) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      {isTable && (
        <DataTable
          columns={Object.keys((value as Record<string, unknown>[])[0] as object).map((k) => ({ key: k, label: k }))}
          data={value as Record<string, unknown>[]}
          compact
        />
      )}
      {stdout && (
        <pre className={cn("text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all", isTable && "border-t border-border pt-2")}>{stdout}</pre>
      )}
    </div>
  );
}

type Mode = "agent" | "chat";

// -- Tool metadata: label/caption/group, and which tools are pure orientation
// (no standalone evidentiary value — e.g. "which dataset am I looking at")
// rather than actual findings. Orientation calls are tucked behind the proof
// toggle instead of shown as primary content. Same design as
// components/hypotheses/HypothesisToolResultPreview.tsx — kept as a
// deliberate separate copy (see that file's header comment) but ported here
// since Scout chat had the identical "shows everything, uncaptioned,
// ungrouped" problem. -----------------------------------------------------

type GroupKey = "tests" | "relationships" | "distributions" | "quality" | "timeseries" | "text" | "actions" | "custom";

const GROUP_LABELS: Record<GroupKey, string> = {
  tests: "Statistical Tests",
  relationships: "Relationships & Predictive Signal",
  distributions: "Distributions & Outliers",
  quality: "Data Quality",
  timeseries: "Time Series",
  text: "Text Analysis",
  actions: "Actions Taken",
  custom: "Custom Analysis",
};

const GROUP_ORDER: GroupKey[] = ["tests", "relationships", "distributions", "quality", "timeseries", "text", "actions", "custom"];

interface ToolMeta {
  label: string;
  description: string;
  group?: GroupKey; // omit for orientation-only tools with no evidentiary card
}

const TOOL_META: Record<string, ToolMeta> = {
  list_datasets: { label: "List datasets", description: "Looked up which datasets exist in this workspace." },
  get_dataset_schema: { label: "Read schema", description: "Looked up this dataset's columns and types." },
  search_columns: { label: "Search columns", description: "Searched for a column across datasets." },
  get_known_relationships: { label: "Recall known relationships", description: "Checked for previously-discovered join keys between datasets." },

  get_profile: { label: "Column Profile", description: "Per-column statistics — mean, std, skewness, missing %.", group: "custom" },
  get_missing: { label: "Missing Values", description: "Which columns have missing data, and how much.", group: "quality" },
  get_correlations: { label: "Correlation Matrix", description: "Pairwise statistical association between numeric columns.", group: "relationships" },
  get_outliers: { label: "Outlier Detection", description: "Rows that fall far outside a column's typical range (IQR-based).", group: "distributions" },
  get_feature_importance: { label: "Feature Importance", description: "Which columns best predict a chosen target column.", group: "relationships" },
  get_shap_explanations: { label: "SHAP Feature Impact", description: "Per-feature direction and size of impact on the target.", group: "relationships" },
  get_quality_score: { label: "Data Quality Score", description: "Composite score for completeness, consistency, and uniqueness.", group: "quality" },
  evaluate_quality_rules: { label: "Quality Rule Check", description: "This dataset's configured data-quality rules, evaluated.", group: "quality" },
  get_distribution: { label: "Distribution", description: "How values in a column are spread — histogram, quartiles, normality.", group: "distributions" },
  get_text_analysis: { label: "Text Analysis", description: "Word frequency, sentiment, and quality signals for a text column.", group: "text" },
  get_timeseries: { label: "Time Series Analysis", description: "Trend, seasonality, and stationarity of a time-based column.", group: "timeseries" },
  run_statistical_test: { label: "Statistical Test", description: "A formal hypothesis test (t-test / ANOVA / chi-square) with a p-value.", group: "tests" },
  run_sql: { label: "SQL Query", description: "A direct SQL query run against this dataset.", group: "custom" },
  run_workspace_sql: { label: "Cross-Dataset SQL Query", description: "A SQL query joining data across datasets in this workspace.", group: "custom" },
  run_python: { label: "Custom Analysis", description: "Custom Python code run directly against this dataset.", group: "custom" },
  run_workspace_python: { label: "Custom Analysis (cross-dataset)", description: "Custom Python code run across multiple datasets.", group: "custom" },
  preview_transform: { label: "Transform Preview", description: "A preview of what a cleaning/transform step would change.", group: "custom" },
  add_quality_rule: { label: "Quality rule added", description: "Scout added a new data-quality rule.", group: "actions" },
  save_chart: { label: "Chart saved", description: "Scout saved a chart for later.", group: "actions" },
  create_segment: { label: "Segment saved", description: "Scout saved a named filter segment.", group: "actions" },
  remember_relationship: { label: "Relationship remembered", description: "Scout recorded a join key for future conversations.", group: "actions" },
};

function metaFor(tool: string): ToolMeta {
  return TOOL_META[tool] ?? { label: tool, description: "" };
}

// ── Tool-result -> chart mapping ───────────────────────────────────────────────
// Reuses the same chart components the rest of the product already uses, so a
// Scout answer about outliers/correlations/missing-data renders the exact same
// visuals you'd see on the dedicated EDA pages — not a bespoke duplicate.
function ToolResultBody({ call }: { call: ScoutToolCall }) {
  const r = call.result as Record<string, unknown>;
  switch (call.tool) {
    case "get_missing":
      return (
        <div className="rounded-xl border border-border bg-card p-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <MissingHeatmap data={r as any} />
        </div>
      );
    case "get_correlations":
      return (
        <div className="rounded-xl border border-border bg-card p-3 overflow-x-auto">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <CorrelationHeatmap data={r as any} />
        </div>
      );
    case "get_outliers":
      return <OutlierSummary result={r} />;
    case "get_quality_score":
      return (
        <div className="rounded-xl border border-border bg-card p-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <QualityGauge data={r as any} />
        </div>
      );
    case "run_sql":
    case "run_workspace_sql": {
      const columns = r.columns as string[] | undefined;
      const rows = r.rows as unknown[][] | undefined;
      if (!columns?.length || !rows) return null;
      const tableData = rows.slice(0, 50).map((row) =>
        Object.fromEntries(columns.map((c, i) => [c, row[i]])) as Record<string, unknown>
      );
      return (
        <div className="rounded-xl border border-border bg-card p-2 overflow-x-auto">
          <DataTable
            columns={columns.map((c) => ({ key: c, label: c }))}
            data={tableData}
            compact
          />
        </div>
      );
    }
    case "get_distribution": {
      const column = call.arguments.column as string;
      if (!r.histogram && !r.is_numeric) return null;
      return (
        <div className="rounded-xl border border-border bg-card p-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <DistributionChart data={r as any} column={column} />
        </div>
      );
    }
    case "get_timeseries": {
      const timeCol = call.arguments.time_col as string;
      const valueCol = call.arguments.value_col as string;
      return (
        <div className="rounded-xl border border-border bg-card p-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <TimeSeriesChart data={r as any} timeCol={timeCol} valueCol={valueCol} />
        </div>
      );
    }
    case "get_text_analysis":
      return <TextSummary result={r} />;
    case "search_columns":
      return <SearchColumnsSummary result={r} />;
    case "get_known_relationships":
      return <RelationshipsSummary result={r} />;
    case "get_shap_explanations":
      return <ShapSummary result={r} />;
    case "evaluate_quality_rules":
      return <QualityRulesSummary result={r} />;
    case "run_statistical_test":
      return <StatTestSummary result={r} />;
    case "run_python":
      return <PythonResultSummary result={r} />;
    case "preview_transform": {
      const preview = r.preview as Array<Record<string, unknown>> | undefined;
      if (!preview?.length) return null;
      return (
        <div className="rounded-xl border border-border bg-card p-2 overflow-x-auto">
          <DataTable columns={Object.keys(preview[0]).map((c) => ({ key: c, label: c }))} data={preview} compact />
        </div>
      );
    }
    case "add_quality_rule":
      return <ActionConfirmation icon={ShieldAlert} label="Quality rule added" />;
    case "save_chart":
      return <ActionConfirmation icon={Sparkles} label={`Chart "${String(r.name ?? "")}" saved`} />;
    case "create_segment":
      return <ActionConfirmation icon={Plus} label={`Segment "${String(r.name ?? "")}" saved`} />;
    case "list_datasets": {
      const datasets = r.datasets as Array<Record<string, unknown>> | undefined;
      if (!datasets?.length) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {datasets.map((d) => (
            <span key={String(d.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
              <Database className="w-3 h-3" />
              {String(d.name)}
              <span className="text-muted-foreground">· {String(d.row_count ?? "?")} rows</span>
            </span>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

/** Unchanged wrapper — still used as-is by StreamingBubble's live progress view,
 * where showing every successful call as it happens is the point. */
function ToolResultPreview({ call }: { call: ScoutToolCall }) {
  const r = call.result as Record<string, unknown>;
  if (r?.error) return null;
  return <ToolResultBody call={call} />;
}

interface GroupedCall {
  call: ScoutToolCall;
  meta: ToolMeta;
}

function buildOverview(trace: ScoutToolCall[]): string {
  const counts = new Map<string, number>();
  for (const t of trace) {
    const meta = metaFor(t.tool);
    if (!meta.group) continue;
    if ("error" in (t.result || {})) continue;
    counts.set(meta.label, (counts.get(meta.label) ?? 0) + 1);
  }
  if (counts.size === 0) return "";
  return Array.from(counts.entries())
    .map(([label, n]) => (n > 1 ? `${label} ×${n}` : label))
    .join(" · ");
}

/** One collapsed row per tool call in the raw-proof list — only the function
 * name/arguments show by default; clicking it reveals the full result JSON,
 * rather than dumping every call's full result inline at once. */
function RawProofRow({ t }: { t: ScoutToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-[11px] font-mono bg-muted rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-border/40 transition"
      >
        {open ? <ChevronUp className="w-3 h-3 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 flex-shrink-0 text-muted-foreground" />}
        <span className="text-violet-500 dark:text-violet-400 flex-shrink-0">{t.tool}</span>
        <span className="text-muted-foreground truncate">({JSON.stringify(t.arguments)})</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2 pt-1.5 border-t border-border text-muted-foreground/80 whitespace-pre-wrap break-all">
          {JSON.stringify(t.result, null, 2)}
        </div>
      )}
    </div>
  );
}

function ToolTrace({ trace }: { trace: ScoutToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showProof, setShowProof] = useState(false);
  if (!trace.length) return null;

  const errors = trace.filter((t) => "error" in (t.result || {}));
  const evidentiary = trace.filter((t) => !("error" in (t.result || {})) && metaFor(t.tool).group);
  const orientationCount = trace.length - errors.length - evidentiary.length;

  // De-dupe (byte-identical results) and drop anything whose body has
  // nothing worth showing (e.g. a run_python result with no clean table).
  const seen = new Set<string>();
  const deduped: GroupedCall[] = [];
  for (const call of evidentiary) {
    const key = `${call.tool}:${JSON.stringify(call.result)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (ToolResultBody({ call }) === null) continue;
    deduped.push({ call, meta: metaFor(call.tool) });
  }

  const groups = GROUP_ORDER.map((g) => ({
    key: g,
    label: GROUP_LABELS[g],
    items: deduped.filter((d) => d.meta.group === g),
  })).filter((g) => g.items.length > 0);

  const overview = buildOverview(trace);
  if (groups.length === 0 && errors.length === 0) return null;

  return (
    <div className="mt-2.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Details
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-4">
          {overview && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Checked: </span>{overview}
            </p>
          )}

          {groups.map((g) => (
            <div key={g.key}>
              {groups.length > 1 && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-1.5">{g.label}</p>
              )}
              <div className="space-y-2.5">
                {g.items.map(({ call, meta }, i) => (
                  <div key={i}>
                    {meta.description && groups.length > 1 && (
                      <p className="text-[11px] text-muted-foreground mb-1">{meta.description}</p>
                    )}
                    <ToolResultBody call={call} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {errors.length > 0 && (
            <div className="space-y-1.5">
              {errors.map((t, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span><strong>{t.tool}</strong> hit an issue and was retried: {String((t.result as Record<string, unknown>)?.error)}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowProof((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-muted-foreground transition"
          >
            {showProof ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {trace.length} tool call{trace.length === 1 ? "" : "s"} total
            {orientationCount > 0 && ` (${orientationCount} orientation, not shown above)`} — show raw proof
          </button>

          {showProof && (
            <div className="space-y-1.5 pl-1">
              {trace.map((t, i) => <RawProofRow key={i} t={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, onEdit, editDisabled }: { msg: ScoutMessage; onEdit?: (msg: ScoutMessage) => void; editDisabled?: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
          <Mascot className="w-5 h-5" />
        </div>
      )}
      {isUser && onEdit && (
        <button
          onClick={() => onEdit(msg)}
          disabled={editDisabled}
          title="Edit & resend"
          className="self-center opacity-0 group-hover:opacity-100 disabled:opacity-0 p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      <div className={cn("max-w-[78%] min-w-0", isUser && "order-first ml-auto")}>
        {msg.image_url && (
          <img
            src={msg.image_url}
            alt="Attached"
            className={cn("max-w-[220px] max-h-[220px] rounded-xl border border-border object-cover mb-1.5", isUser && "ml-auto")}
          />
        )}
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed",
            isUser
              ? "text-white rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md border border-border"
          )}
          style={isUser ? { backgroundColor: "hsl(var(--primary))" } : undefined}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          ) : (
            <Markdown content={msg.content} />
          )}
        </div>
        {!isUser && msg.tool_trace?.length > 0 && <ToolTrace trace={msg.tool_trace} />}
      </div>
    </div>
  );
}

interface StreamingToolCall {
  tool: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
}

interface StreamState {
  tools: StreamingToolCall[];
  answer: string;
}

function StreamingBubble({ state, mode }: { state: StreamState; mode: Mode }) {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
        <Mascot className="w-5 h-5" />
      </div>
      <div className="max-w-[78%] min-w-0 space-y-2.5">
        {!state.answer && state.tools.length === 0 && (
          <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-muted border border-border flex items-center gap-2 text-xs text-muted-foreground">
            <Mascot className="w-5 h-5" />
            {mode === "agent" ? "Scout is investigating…" : "Scout is thinking…"}
          </div>
        )}
        {state.tools.map((t, i) =>
          t.result ? (
            <ToolResultPreview key={i} call={t as ScoutToolCall} />
          ) : (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running {t.tool}…
            </div>
          )
        )}
        {state.answer && (
          <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-muted text-foreground border border-border text-[13.5px] leading-relaxed">
            <Markdown content={state.answer} />
            <span className="scout-caret" />
          </div>
        )}
      </div>
    </div>
  );
}

const SIDEBAR_COLLAPSED_KEY = "scout_sidebar_collapsed";

function ConversationRail({
  workspaceId, activeId, onSelect,
}: {
  workspaceId: string;
  activeId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const { data: conversations } = useQuery({
    queryKey: queryKeys.scout.conversations(workspaceId),
    queryFn: () => scoutApi.listConversations(workspaceId).then((r) => r.data as ScoutConversation[]),
  });

  const createMutation = useMutation({
    mutationFn: () => scoutApi.createConversation(workspaceId).then((r) => r.data as ScoutConversation),
    onSuccess: (convo) => {
      qc.invalidateQueries({ queryKey: queryKeys.scout.conversations(workspaceId) });
      onSelect(convo.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scoutApi.deleteConversation(workspaceId, id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.scout.conversations(workspaceId) });
      if (id === activeId) onSelect(null);
    },
  });

  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 border-r border-border flex flex-col items-center bg-muted/50 py-2.5 gap-2 transition-all">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand conversations"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-muted-foreground transition"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          title="New chat"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "hsl(var(--primary))" }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 border-r border-border flex flex-col bg-muted/50 transition-all">
      <div className="p-2.5 flex items-center gap-1.5">
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "hsl(var(--primary))" }}
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse"
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-muted-foreground transition"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
        {conversations?.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "w-full group flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition",
              c.id === activeId ? "bg-card shadow-sm" : "hover:bg-card/70"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs truncate", c.id === activeId ? "text-foreground font-medium" : "text-muted-foreground")}>{c.title}</p>
              <p className="text-[10px] text-muted-foreground">{formatDistanceToNowStrict(new Date(c.updated_at), { addSuffix: true })}</p>
            </div>
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-muted text-muted-foreground/60 hover:text-red-400 dark:text-red-400 transition flex-shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </span>
          </button>
        ))}
        {conversations?.length === 0 && (
          <p className="text-[11px] text-muted-foreground/60 text-center py-6 px-2">No conversations yet</p>
        )}
      </div>
    </div>
  );
}

export default function ScoutPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Mode>("agent");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [optimistic, setOptimistic] = useState<ScoutMessage[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  const { data: workspaceDatasets } = useQuery({
    queryKey: queryKeys.datasets.list(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId).then((r) => r.data as Array<{ id: string; name: string }>),
  });
  const mentionMatches = (workspaceDatasets ?? [])
    .filter((d) => d.name.toLowerCase().includes((mentionQuery ?? "").toLowerCase()))
    .slice(0, 6);

  const { data: providerInfo } = useQuery({
    queryKey: ["ai", "provider"],
    queryFn: () => aiApi.getProvider().then((r) => r.data),
  });
  const visionSupported = providerInfo?.provider === "claude";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<{
    previewUrl: string;
    contentType: string;
    key: string | null;
    uploading: boolean;
    error: string | null;
  } | null>(null);

  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setAttachedImage({ previewUrl: "", contentType: file.type, key: null, uploading: false, error: "Image exceeds 8MB" });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setAttachedImage({ previewUrl, contentType: file.type, key: null, uploading: true, error: null });
    try {
      const { data } = await scoutApi.presignImage(workspaceId, {
        filename: file.name, content_type: file.type, size_bytes: file.size,
      });
      await uploadToPresignedUrl(data.upload_url, file);
      setAttachedImage((prev) => (prev ? { ...prev, key: data.image_key, uploading: false } : prev));
    } catch {
      setAttachedImage((prev) => (prev ? { ...prev, uploading: false, error: "Upload failed — try again" } : prev));
    }
  };

  const handleRemoveImage = () => {
    if (attachedImage?.previewUrl) URL.revokeObjectURL(attachedImage.previewUrl);
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const pendingAnswerRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const flushAnswer = () => {
    rafRef.current = null;
    if (pendingAnswerRef.current) {
      const chunk = pendingAnswerRef.current;
      pendingAnswerRef.current = "";
      setStreamState((prev) => (prev ? { ...prev, answer: prev.answer + chunk } : prev));
    }
  };

  const queueAnswerChunk = (text: string) => {
    pendingAnswerRef.current += text;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushAnswer);
    }
  };

  const { data: conversations } = useQuery({
    queryKey: queryKeys.scout.conversations(workspaceId),
    queryFn: () => scoutApi.listConversations(workspaceId).then((r) => r.data as ScoutConversation[]),
  });

  // Default to the most recently active conversation once the list loads.
  useEffect(() => {
    if (activeId === null && conversations && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const { data: thread, isLoading } = useQuery({
    queryKey: queryKeys.scout.thread(workspaceId, activeId ?? -1),
    queryFn: () => scoutApi.getMessages(workspaceId, activeId!).then((r) => r.data as ScoutThread),
    enabled: activeId !== null,
  });

  const { data: suggestions } = useQuery({
    queryKey: queryKeys.scout.suggestions(workspaceId),
    queryFn: () => scoutApi.getSuggestions(workspaceId).then((r) => r.data as ScoutSuggestion[]),
  });

  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const isSending = streamState !== null;

  const messages = [...(thread?.messages ?? []), ...optimistic];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamState?.answer, streamState?.tools.length]);

  useEffect(() => {
    if (draft === "" && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [draft]);

  const handleSend = async (text?: string) => {
    const message = (text ?? draft).trim();
    if ((!message && !attachedImage?.key) || isSending || attachedImage?.uploading) return;

    const editedId = editingId;
    setEditingId(null);

    const imageToSend = attachedImage?.key
      ? { key: attachedImage.key, contentType: attachedImage.contentType, previewUrl: attachedImage.previewUrl }
      : null;
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (editedId !== null && activeId !== null) {
      try {
        await scoutApi.truncateFrom(workspaceId, activeId, editedId);
        qc.setQueryData<ScoutThread | undefined>(queryKeys.scout.thread(workspaceId, activeId), (prev) => {
          if (!prev) return prev;
          const idx = prev.messages.findIndex((m) => m.id === editedId);
          return idx >= 0 ? { ...prev, messages: prev.messages.slice(0, idx) } : prev;
        });
      } catch {
        setEditingId(editedId);
        return;
      }
    }

    setOptimistic([{
      id: -1, role: "user", content: message, mode: null, tool_trace: [],
      image_url: imageToSend?.previewUrl ?? null,
      created_at: new Date().toISOString(),
    }]);
    setDraft("");
    setMentionQuery(null);
    setStreamState({ tools: [], answer: "" });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let conversationId = activeId;
    try {
      if (conversationId === null) {
        const created = await scoutApi.createConversation(workspaceId).then((r) => r.data as ScoutConversation);
        conversationId = created.id;
        setActiveId(conversationId);
      }

      const sendData = {
        message, mode,
        ...(imageToSend ? { image_key: imageToSend.key, image_content_type: imageToSend.contentType } : {}),
      };
      for await (const event of scoutApi.streamMessage(workspaceId, conversationId, sendData, controller.signal)) {
        if (event.type === "tool_call") {
          setStreamState((prev) => prev ? {
            tools: [...prev.tools, { tool: event.tool as string, arguments: event.arguments as Record<string, unknown> }],
            answer: prev.answer,
          } : prev);
        } else if (event.type === "tool_result") {
          setStreamState((prev) => {
            if (!prev) return prev;
            const tools = [...prev.tools];
            const idx = tools.map((t) => !t.result).lastIndexOf(true);
            if (idx >= 0) tools[idx] = { ...tools[idx], result: event.result as Record<string, unknown> };
            return { tools, answer: prev.answer };
          });
        } else if (event.type === "answer_chunk") {
          queueAnswerChunk(event.text as string);
        } else if (event.type === "error") {
          flushAnswer();
          setStreamState((prev) => ({ tools: prev?.tools ?? [], answer: event.message as string }));
          break;
        } else if (event.type === "done") {
          break;
        }
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (!aborted) {
        setStreamState((prev) => ({ tools: prev?.tools ?? [], answer: "Something went wrong reaching Scout. Please try again." }));
      }
    } finally {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      pendingAnswerRef.current = "";
      abortControllerRef.current = null;
      setOptimistic([]);
      setStreamState(null);
      if (conversationId !== null) {
        qc.invalidateQueries({ queryKey: queryKeys.scout.thread(workspaceId, conversationId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.scout.conversations(workspaceId) });
    }
  };

  const handleStop = () => abortControllerRef.current?.abort();

  const handleEditClick = (msg: ScoutMessage) => {
    if (isSending) return;
    setEditingId(msg.id);
    setDraft(msg.content);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setMentionQuery(null);
    setDraft("");
  };

  const detectMention = (value: string, cursor: number) => {
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at === -1) { setMentionQuery(null); return; }
    const prevChar = at === 0 ? " " : before[at - 1];
    const query = before.slice(at + 1);
    if (/\s/.test(prevChar) === false && at !== 0) { setMentionQuery(null); return; }
    if (/\s/.test(query)) { setMentionQuery(null); return; }
    setMentionQuery(query);
    setMentionStart(at);
    setMentionIndex(0);
  };

  const selectMention = (datasetName: string) => {
    if (mentionQuery === null) return;
    const before = draft.slice(0, mentionStart);
    const after = draft.slice(mentionStart + 1 + mentionQuery.length);
    const inserted = `${before}@${datasetName} ${after}`;
    setDraft(inserted);
    setMentionQuery(null);
    const pos = before.length + datasetName.length + 2;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="h-full flex bg-card overflow-hidden">
      <ConversationRail workspaceId={workspaceId} activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 flex flex-col min-w-0">
      <style jsx global>{`
        @keyframes scout-caret-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .scout-caret {
          display: inline-block;
          width: 2px;
          height: 13px;
          background: hsl(var(--primary));
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: scout-caret-blink 1s step-end infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Mascot className="w-8 h-8" />
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">Scout</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Your AI data analyst for this workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Agent / Chat toggle */}
          <div className="flex items-center bg-muted rounded-full p-0.5 text-xs font-medium">
            {(["agent", "chat"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                  mode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-muted-foreground"
                )}
              >
                {m === "agent" ? <Wand2 className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                {m === "agent" ? "Agent" : "Chat"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/60">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto gap-5">
            <Mascot className="w-14 h-14" glow />
            <div>
              <h2 className="text-base font-bold text-foreground mb-1">Ask Scout anything about your data</h2>
              <p className="text-sm text-muted-foreground">
                Every answer is backed by real analysis Scout ran on your data — not a guess.
              </p>
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="flex flex-col gap-2 w-full">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.label)}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:border-border hover:bg-muted transition text-left"
                  >
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onEdit={handleEditClick} editDisabled={isSending} />
            ))}
            {streamState && <StreamingBubble state={streamState} mode={mode} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border px-6 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          {editingId !== null && (
            <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Editing message — sending will replace it and everything after it</span>
              <button onClick={handleCancelEdit} className="p-0.5 rounded hover:bg-amber-100 dark:bg-amber-900/30 transition"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          {attachedImage && (
            <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-muted border border-border w-fit">
              <div className="relative w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                {attachedImage.previewUrl && <img src={attachedImage.previewUrl} alt="" className="w-full h-full object-cover" />}
                {attachedImage.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  </div>
                )}
              </div>
              <span className={cn("text-[11px]", attachedImage.error ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>
                {attachedImage.error ?? (attachedImage.uploading ? "Uploading…" : "Image attached")}
              </span>
              <button onClick={handleRemoveImage} className="p-0.5 rounded hover:bg-muted transition"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
          )}
          <div
            className="flex items-end gap-2.5 relative"
            onDragOver={(e) => { if (visionSupported) e.preventDefault(); }}
            onDrop={(e) => {
              if (!visionSupported) return;
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileSelect(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {mentionQuery !== null && mentionMatches.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-20">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Reference a dataset</p>
                {mentionMatches.map((d, i) => (
                  <button
                    key={d.id}
                    onClick={() => selectMention(d.name)}
                    onMouseEnter={() => setMentionIndex(i)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition",
                      i === mentionIndex ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Database className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 flex items-end gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 focus-within:border-border transition">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!visionSupported || isSending}
                title={visionSupported ? "Attach an image" : "Image attachments require the Claude provider"}
                className="flex-shrink-0 p-1 -ml-1 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                  detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyDown={(e) => {
                  if (mentionQuery !== null && mentionMatches.length > 0) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionMatches.length); return; }
                    if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
                    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectMention(mentionMatches[mentionIndex].name); return; }
                    if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return; }
                  }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={mode === "agent" ? "Ask Scout to investigate something…" : "Ask a quick question…"}
                className="flex-1 text-sm outline-none placeholder:text-muted-foreground resize-none leading-relaxed py-0.5 bg-transparent"
                rows={1}
                disabled={isSending}
              />
            </div>
            {isSending ? (
              <button
                onClick={handleStop}
                title="Stop generating"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 transition hover:opacity-90"
                style={{ backgroundColor: "hsl(var(--primary))" }}
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={(!draft.trim() && !attachedImage?.key) || attachedImage?.uploading}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition hover:opacity-90"
                style={{ backgroundColor: "hsl(var(--primary))" }}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/60 mt-2">Scout can make mistakes — verify important findings.</p>
      </div>
      </div>
    </div>
  );
}
