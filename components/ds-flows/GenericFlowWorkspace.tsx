"use client";
/**
 * Universal workspace renderer for any ds-flow that uses the P.page() block spec.
 * Works for: forecasting, revenue_growth, pricing, efficiency_cost, and any future flow.
 * Churn has its own bespoke FlowWorkspace; everything else lands here.
 *
 * A "page" from the backend is: { blocks: [ {type: kpis|chart|table|note|bullets|markdown|checks|downloads}, ... ] }
 * One generic renderer draws all of these so each solution gets consistent UI without per-flow code.
 */

import { useState, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, CheckCircle2, Circle, ChevronRight, Download, Info, Loader2, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { dsFlowsApi } from "@/lib/api";
import type { FlowRunFull } from "./FlowWorkspace";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── colour palette ─────────────────────────────────────────────────────────
const C: Record<string, string> = {
  brand: "#3411A3",
  pink:  "#ff6196",
  soft:  "#B4AEFF",
  muted: "#8a88a3",
};
function color(c?: string) { return C[c ?? "brand"] ?? C.brand; }

// ─── KPIs ────────────────────────────────────────────────────────────────────
function KpiBlock({ items }: { items: { title: string; value: string; sub?: string; pink?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((kpi, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{kpi.title}</div>
          <div className={cn("text-2xl font-bold", kpi.pink ? "text-pink-500" : "text-jman-midnight dark:text-foreground")}>{kpi.value ?? "—"}</div>
          {kpi.sub && <div className="text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Charts ──────────────────────────────────────────────────────────────────
const AX_STYLE = { fontSize: 11, fill: C.muted };
const TT_STYLE = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };

function ChartBlock({ b }: { b: any }) {
  const { kind, title, subtitle, data, x, series, height = 260, band } = b;
  if (!data?.length || !series?.length) return <p className="text-sm text-muted-foreground">No chart data.</p>;

  const Chart = kind === "bar" ? BarChart : kind === "area" ? AreaChart : LineChart;
  const SeriesEl = kind === "bar" ? Bar : kind === "area" ? Area : Line;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-sm font-semibold text-foreground mb-0.5">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground mb-2">{subtitle}</div>}
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="rgba(120,120,150,0.15)" vertical={false} />
          <XAxis dataKey={x} tick={AX_STYLE} tickLine={false} axisLine={false} />
          <YAxis tick={AX_STYLE} tickLine={false} axisLine={false} width={48} />
          <Tooltip {...TT_STYLE} />
          {series.map((s: any) => (
            <SeriesEl
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stroke={color(s.color)}
              fill={color(s.color)}
              fillOpacity={kind === "area" ? 0.15 : 1}
              dot={false}
              strokeWidth={2}
              type="monotone"
            />
          ))}
          {band && series.map((s: any) => (
            <Area key={`${s.key}_band`} dataKey="band" stroke="none" fill={color(s.color)} fillOpacity={0.1} type="monotone" />
          ))}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────
function TableBlock({ b }: { b: any }) {
  const { title, subtitle, head, rows } = b;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {(title || subtitle) && (
        <div className="px-4 py-3 border-b border-border">
          {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>{head.map((h: string, i: number) => <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row: any[], ri: number) => (
              <tr key={ri} className="hover:bg-muted/20">
                {row.map((cell: any, ci: number) => <td key={ci} className="px-3 py-2 text-foreground whitespace-nowrap">{cell ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Note ────────────────────────────────────────────────────────────────────
function NoteBlock({ b }: { b: any }) {
  const tones: Record<string, string> = {
    pink:  "bg-pink-50 border-pink-200 text-pink-800 dark:bg-pink-950/30 dark:border-pink-900 dark:text-pink-300",
    plain: "bg-muted border-border text-muted-foreground",
    warn:  "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300",
    info:  "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-300",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm flex items-start gap-2", tones[b.tone ?? "plain"] ?? tones.plain)}>
      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{b.text}</span>
    </div>
  );
}

// ─── Bullets ─────────────────────────────────────────────────────────────────
function BulletsBlock({ b }: { b: any }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {b.title && <div className="text-sm font-semibold text-foreground mb-2">{b.title}</div>}
      <ul className="space-y-1">
        {b.items.map((item: string, i: number) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="text-brand mt-1 flex-shrink-0">•</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Checks ──────────────────────────────────────────────────────────────────
function ChecksBlock({ b }: { b: any }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      {b.items.map((item: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {item.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          <span className={item.ok ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
          {item.note && <span className="text-xs text-muted-foreground">— {item.note}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Markdown ────────────────────────────────────────────────────────────────
function MarkdownBlock({ b }: { b: any }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {b.title && <div className="text-sm font-semibold text-foreground mb-2">{b.title}</div>}
      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">{b.text}</pre>
    </div>
  );
}

// ─── Downloads ───────────────────────────────────────────────────────────────
function DownloadsBlock({ b, run, workspaceId }: { b: any; run: FlowRunFull; workspaceId: string }) {
  const dl = async (kind: string, format: string) => {
    const res = await dsFlowsApi.download(workspaceId, run.id, kind, format);
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    const cd = res.headers?.["content-disposition"] as string | undefined;
    a.href = url;
    a.download = cd?.match(/filename="?([^";]+)"?/)?.[1] ?? `${kind}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {b.subtitle && <div className="text-xs text-muted-foreground mb-3">{b.subtitle}</div>}
      <div className="flex flex-wrap gap-2">
        {b.items.map((item: any, i: number) => (
          <button key={i} onClick={() => dl(item.kind, item.format)}
            className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              item.primary ? "bg-brand text-white border-brand hover:opacity-90" : "bg-muted text-foreground border-border hover:bg-muted/70")}>
            <Download className="w-3.5 h-3.5" />{item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Generic page renderer ───────────────────────────────────────────────────
function PageRenderer({ page, run, workspaceId }: { page: any; run: FlowRunFull; workspaceId: string }) {
  if (!page?.blocks?.length) return <p className="text-sm text-muted-foreground">No output for this stage.</p>;
  return (
    <div className="space-y-4">
      {page.blocks.map((b: any, i: number) => {
        switch (b.type) {
          case "kpis":      return <KpiBlock key={i} items={b.items} />;
          case "chart":     return <ChartBlock key={i} b={b} />;
          case "table":     return <TableBlock key={i} b={b} />;
          case "note":      return <NoteBlock key={i} b={b} />;
          case "bullets":   return <BulletsBlock key={i} b={b} />;
          case "checks":    return <ChecksBlock key={i} b={b} />;
          case "markdown":  return <MarkdownBlock key={i} b={b} />;
          case "downloads": return <DownloadsBlock key={i} b={b} run={run} workspaceId={workspaceId} />;
          default:          return null;
        }
      })}
    </div>
  );
}

// ─── Stage icon ──────────────────────────────────────────────────────────────
function StageIcon({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="w-4 h-4 text-brand animate-spin" />;
  if (status === "done")    return <CheckCircle2 className="w-4 h-4 text-brand" />;
  if (status === "error")   return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "skipped") return <MinusCircle className="w-4 h-4 text-muted-foreground/50" />;
  return <Circle className="w-4 h-4 text-muted-foreground/40" />;
}

// ─── Scope result (for revenue_growth, pricing, efficiency_cost) ─────────────
function ScopeResult({ stage }: { stage: any }) {
  const logs: string[] = stage?.logs ?? [];
  const signals = logs.filter((l: string) => !l.startsWith("Missing:"));
  const missing = logs.filter((l: string) => l.startsWith("Missing:")).map((l: string) => l.replace(/^Missing:\s*/, ""));
  return (
    <div className="space-y-4">
      {stage?.summary && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm font-semibold text-foreground mb-1">Scope analysis</div>
          <p className="text-sm text-muted-foreground">{stage.summary}</p>
        </div>
      )}
      {signals.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Signals found in your data
          </div>
          <ul className="space-y-1">
            {signals.map((s: string, i: number) => <li key={i} className="text-sm text-emerald-700 dark:text-emerald-400">• {s}</li>)}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4">
          <div className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> What would strengthen the analysis
          </div>
          <ul className="space-y-1">
            {missing.map((m: string, i: number) => <li key={i} className="text-sm text-amber-700 dark:text-amber-400">• {m}</li>)}
          </ul>
        </div>
      )}
      <div className="bg-muted/50 border border-border rounded-xl p-4 text-sm text-muted-foreground">
        This is a preliminary scope scan based on your data structure. A full modelling pipeline for this solution is in development.
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function GenericFlowWorkspace({ run, workspaceId }: { run: FlowRunFull; workspaceId: string }) {
  const stages = run.stages ?? [];
  const R = run.results ?? {};
  const isScope = stages.length === 1 && stages[0]?.key === "scope";

  const [picked, setPicked] = useState<string | null>(null);

  // auto-select: running stage → last done stage → first
  const auto = useMemo(() => {
    const running = stages.find((s: any) => s.status === "running");
    if (running) return running.key;
    const done = [...stages].reverse().find((s: any) => s.status === "done");
    if (done) return done.key;
    return stages[0]?.key ?? null;
  }, [stages]);

  const activeKey = picked ?? auto;
  const active = stages.find((s: any) => s.key === activeKey) ?? stages[0];
  const done = stages.filter((s: any) => ["done", "error", "skipped"].includes(s.status)).length;

  const stageResult = active ? R[active.key] : null;
  const hasPage = !!(stageResult?.page?.blocks?.length);

  return (
    <div className="grid lg:grid-cols-[210px_1fr] gap-3 items-start">
      {/* Sidebar */}
      <aside className="bg-card border border-border rounded-xl overflow-hidden lg:sticky lg:top-2">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan">Stages</span>
            <span className="text-muted-foreground">{done} of {stages.length}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all duration-500" style={{ width: `${stages.length ? (done / stages.length) * 100 : 0}%` }} />
          </div>
        </div>
        <ol>
          {stages.map((s: any, i: number) => (
            <li key={s.key}>
              <button
                onClick={() => setPicked(s.key)}
                className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-left border-l-2 transition-colors",
                  s.key === activeKey ? "border-brand bg-brand/10" : "border-transparent hover:bg-muted/50")}
              >
                <StageIcon status={s.status} />
                <span className={cn("flex-1 text-sm whitespace-nowrap",
                  s.key === activeKey ? "text-brand font-semibold" : s.status === "pending" ? "text-muted-foreground" : "text-foreground font-medium")}>
                  {i + 1}. {s.title}
                </span>
                {s.seconds > 0 && <span className="text-[10px] text-muted-foreground">{Math.round(s.seconds)}s</span>}
                <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground", s.key !== activeKey && "opacity-0")} />
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {/* Content */}
      <section className="min-w-0 space-y-3">
        {active && (
          <>
            <div>
              <h2 className="text-lg font-bold text-jman-midnight dark:text-foreground">{active.title}</h2>
              {active.summary && (
                <p className={cn("text-xs mt-0.5", active.status === "error" ? "text-red-600" : "text-muted-foreground")}>{active.summary}</p>
              )}
            </div>

            {active.status === "running" && (
              <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-brand" /> Running…
              </div>
            )}
            {active.status === "pending" && (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                Waiting for earlier stages to finish.
              </div>
            )}
            {active.status === "skipped" && (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                Skipped because an earlier stage failed.
              </div>
            )}
            {active.status === "error" && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {active.summary ?? "This stage failed."}
              </div>
            )}
            {active.status === "done" && (
              isScope
                ? <ScopeResult stage={active} />
                : hasPage
                  ? <PageRenderer page={stageResult.page} run={run} workspaceId={workspaceId} />
                  : <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                      {active.summary ? <p>{active.summary}</p> : "Stage complete — no visual output for this step."}
                    </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
