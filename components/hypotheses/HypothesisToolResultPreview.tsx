"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ScoutToolCall } from "@/types";
import { ChevronDown, ChevronUp, AlertCircle, ShieldAlert, SearchCheck, Link2 } from "lucide-react";
import { MissingHeatmap } from "@/components/charts/MissingHeatmap";
import { CorrelationHeatmap } from "@/components/charts/CorrelationHeatmap";
import { QualityGauge } from "@/components/charts/QualityGauge";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { DataTable } from "@/components/shared/DataTable";

/**
 * Trimmed copy of Scout's ToolResultPreview (frontend/app/(dashboard)/workspaces/[id]/scout/page.tsx),
 * covering only the read-only tools relevant to hypothesis verification — Scout's
 * write/action tools (save_chart, create_segment, add_quality_rule, etc.) never
 * appear here since the hypothesis orchestrator's tool allowlist excludes them
 * server-side. A deliberate duplicate, not a shared import — see the build plan
 * for why (the two pages' rendering needs are expected to diverge over time).
 */

// -- Tool metadata: label/caption/group, and which tools are pure orientation
// (no standalone evidentiary value — e.g. "which dataset am I looking at")
// rather than actual findings. Orientation calls are tucked behind the proof
// toggle instead of shown as primary content. -----------------------------

type GroupKey = "tests" | "relationships" | "distributions" | "quality" | "timeseries" | "text" | "profile" | "custom";

const GROUP_LABELS: Record<GroupKey, string> = {
  tests: "Statistical Tests",
  relationships: "Relationships & Predictive Signal",
  distributions: "Distributions & Outliers",
  quality: "Data Quality",
  timeseries: "Time Series",
  text: "Text Analysis",
  profile: "Column Profile",
  custom: "Custom Analysis",
};

const GROUP_ORDER: GroupKey[] = ["tests", "relationships", "distributions", "quality", "timeseries", "text", "profile", "custom"];

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

  get_profile: { label: "Column Profile", description: "Per-column statistics — mean, std, skewness, missing %.", group: "profile" },
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
};

function metaFor(tool: string): ToolMeta {
  return TOOL_META[tool] ?? { label: tool, description: "" };
}

function OutlierSummary({ result }: { result: Record<string, unknown> }) {
  const columns = result.columns as Array<{ name: string; outlier_count: number; outlier_pct: number }> | undefined;
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

/** Only renders a clean tabular result or short printed output — a nested/
 * scalar dict has no readable generic rendering, and the verdict's prose
 * already covers whatever it found. Full detail is still available via the
 * trace's "show raw proof" toggle. */
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
  if (!matches.length) return <p className="text-xs text-muted-foreground italic px-1">No matching columns found.</p>;
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

function ToolResultBody({ call }: { call: ScoutToolCall }) {
  const r = call.result as Record<string, unknown>;
  switch (call.tool) {
    case "get_missing":
      return <MissingHeatmap data={r as any} />; // eslint-disable-line @typescript-eslint/no-explicit-any
    case "get_correlations":
      return <div className="overflow-x-auto"><CorrelationHeatmap data={r as any} /></div>; // eslint-disable-line @typescript-eslint/no-explicit-any
    case "get_outliers":
      return <OutlierSummary result={r} />;
    case "get_quality_score":
      return <QualityGauge data={r as any} />; // eslint-disable-line @typescript-eslint/no-explicit-any
    case "run_sql":
    case "run_workspace_sql": {
      const columns = r.columns as string[] | undefined;
      const rows = r.rows as unknown[][] | undefined;
      if (!columns?.length || !rows) return null;
      const tableData = rows.slice(0, 50).map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])) as Record<string, unknown>);
      return <div className="overflow-x-auto"><DataTable columns={columns.map((c) => ({ key: c, label: c }))} data={tableData} compact /></div>;
    }
    case "get_distribution": {
      const column = call.arguments.column as string;
      if (!r.histogram && !r.is_numeric) return null;
      return <DistributionChart data={r as any} column={column} />; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    case "get_shap_explanations":
      return <ShapSummary result={r} />;
    case "evaluate_quality_rules":
      return <QualityRulesSummary result={r} />;
    case "run_statistical_test":
      return <StatTestSummary result={r} />;
    case "run_python":
    case "run_workspace_python":
      return <PythonResultSummary result={r} />;
    case "preview_transform": {
      const preview = r.preview as Array<Record<string, unknown>> | undefined;
      if (!preview?.length) return null;
      return <div className="overflow-x-auto"><DataTable columns={Object.keys(preview[0]).map((c) => ({ key: c, label: c }))} data={preview} compact /></div>;
    }
    default:
      return null;
  }
}

/** Kept for the Scout chat page, which renders one call at a time inline. */
export function HypothesisToolResultPreview({ call }: { call: ScoutToolCall }) {
  const r = call.result as Record<string, unknown>;
  if (r?.error) return null;
  const body = ToolResultBody({ call });
  if (!body) return null;
  return <div className="rounded-xl border border-border bg-card p-3">{body}</div>;
}

// -- Grouped, captioned, de-duplicated trace view ---------------------------

interface GroupedCall {
  call: ScoutToolCall;
  meta: ToolMeta;
}

function buildOverview(trace: ScoutToolCall[]): string {
  const counts = new Map<string, number>();
  for (const t of trace) {
    const meta = metaFor(t.tool);
    if (!meta.group) continue; // orientation calls don't count toward "what was tested"
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

export function HypothesisToolTrace({ trace }: { trace: ScoutToolCall[] }) {
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
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Details
      </button>

      {expanded && (
        <div className="space-y-5 mt-3">
          {overview && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Tests performed: </span>{overview}
            </p>
          )}

          {groups.map((g) => (
            <div key={g.key}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand mb-2">{g.label}</p>
              <div className="space-y-3">
                {g.items.map(({ call, meta }, i) => (
                  <div key={i}>
                    {meta.description && <p className="text-xs text-muted-foreground mb-1.5">{meta.description}</p>}
                    <div className="rounded-xl border border-border bg-card p-3">
                      <ToolResultBody call={call} />
                    </div>
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
