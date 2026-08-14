"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ScoutToolCall } from "@/types";
import { ChevronDown, ChevronUp, AlertCircle, ShieldAlert, SearchCheck, Link2, Database } from "lucide-react";
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

function PythonResultSummary({ result }: { result: Record<string, unknown> }) {
  const value = result.result;
  const stdout = result.stdout as string | undefined;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      {Array.isArray(value) && value.length > 0 && typeof value[0] === "object" ? (
        <DataTable
          columns={Object.keys(value[0] as object).map((k) => ({ key: k, label: k }))}
          data={value as Record<string, unknown>[]}
          compact
        />
      ) : (
        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
      )}
      {stdout && (
        <pre className="text-[11px] font-mono text-muted-foreground border-t border-border pt-2 whitespace-pre-wrap break-all">{stdout}</pre>
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

export function HypothesisToolResultPreview({ call }: { call: ScoutToolCall }) {
  const r = call.result as Record<string, unknown>;
  if (r?.error) return null;

  switch (call.tool) {
    case "get_missing":
      return <div className="rounded-xl border border-border bg-card p-3"><MissingHeatmap data={r as any} /></div>; // eslint-disable-line @typescript-eslint/no-explicit-any
    case "get_correlations":
      return <div className="rounded-xl border border-border bg-card p-3 overflow-x-auto"><CorrelationHeatmap data={r as any} /></div>; // eslint-disable-line @typescript-eslint/no-explicit-any
    case "get_outliers":
      return <OutlierSummary result={r} />;
    case "get_quality_score":
      return <div className="rounded-xl border border-border bg-card p-3"><QualityGauge data={r as any} /></div>; // eslint-disable-line @typescript-eslint/no-explicit-any
    case "run_sql":
    case "run_workspace_sql": {
      const columns = r.columns as string[] | undefined;
      const rows = r.rows as unknown[][] | undefined;
      if (!columns?.length || !rows) return null;
      const tableData = rows.slice(0, 50).map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])) as Record<string, unknown>);
      return (
        <div className="rounded-xl border border-border bg-card p-2 overflow-x-auto">
          <DataTable columns={columns.map((c) => ({ key: c, label: c }))} data={tableData} compact />
        </div>
      );
    }
    case "get_distribution": {
      const column = call.arguments.column as string;
      if (!r.histogram && !r.is_numeric) return null;
      return <div className="rounded-xl border border-border bg-card p-3"><DistributionChart data={r as any} column={column} /></div>; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
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
    case "run_workspace_python":
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

export function HypothesisToolTrace({ trace }: { trace: ScoutToolCall[] }) {
  const [open, setOpen] = useState(false);
  if (!trace.length) return null;

  const previews = trace.filter((t) => !("error" in (t.result || {})));
  const errors = trace.filter((t) => "error" in (t.result || {}));

  return (
    <div className="mt-2.5 space-y-2.5">
      {previews.map((t, i) => <HypothesisToolResultPreview key={i} call={t} />)}

      {errors.map((t, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span><strong>{t.tool}</strong>: {String((t.result as Record<string, unknown>)?.error)}</span>
        </div>
      ))}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-muted-foreground transition"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {trace.length} tool {trace.length === 1 ? "call" : "calls"} used
      </button>

      {open && (
        <div className="space-y-1.5 pl-1">
          {trace.map((t, i) => (
            <div key={i} className="text-[11px] font-mono text-muted-foreground bg-muted rounded-lg px-2.5 py-1.5 border border-border">
              <span className="text-violet-500 dark:text-violet-400">{t.tool}</span>
              <span className="text-muted-foreground">({JSON.stringify(t.arguments)})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
