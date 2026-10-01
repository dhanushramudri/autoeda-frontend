"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, Download, FileSpreadsheet, FileText, Loader2, MinusCircle, Users, XCircle } from "lucide-react";
import { dsFlowsApi } from "@/lib/api";
import { Markdown } from "@/components/shared/Markdown";
import { cn } from "@/lib/utils";
import { fmt, label } from "@/components/ds-flows/ChurnResults";
import { PageRenderer, ScopeResult } from "@/components/ds-flows/GenericFlowWorkspace";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FlowStage {
  key: string;
  title: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  summary: string | null;
  logs: string[];
  seconds: number | null;
}
export interface FlowRunFull {
  id: number;
  flow_key: string;
  status: string;
  title: string | null;
  error: string | null;
  stages: FlowStage[];
  results: any;
  headline: any;
  narrative: any;
  markdown: string | null;
  files: { enriched: boolean; accounts: boolean; dictionary: boolean; model: boolean };
  working_dataset_id?: number | null;
  auto_eda_run_id?: number | null;
}

// JMAN palette (hex: SVG chart attributes don't resolve CSS variables reliably)
const BRAND = "#3411A3"; // jman-trypan
const PINK = "#ff6196";
const SOFT = "#B4AEFF"; // jman-midnight-300
const MUTED = "#8a88a3";
const GRID = "rgba(120,120,150,0.25)";
const TIER: Record<string, string> = { High: PINK, Medium: BRAND, Low: SOFT };
const TT = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };
const AX = { fontSize: 11, fill: MUTED };
const pct = (v: number | null | undefined, d = 1) => fmt(v, { pct: true, digits: d });

/* ------------------------------------------------------------------ small UI kit */
function Card({ title, subtitle, children, right }: { title?: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl">
      {title && (
        <div className="px-4 pt-3.5 flex items-start justify-between gap-3">
          <div><h3 className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan">{title}</h3>{subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}</div>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
function Kpi({ title, value, sub, pink }: { title: string; value: string; sub?: string; pink?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan">{title}</div>
      <div className={cn("mt-1.5 text-2xl font-bold", pink ? "text-[#ff6196]" : "text-jman-midnight dark:text-foreground")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
function Tbl({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-white bg-jman-midnight">{head.map((h) => <th key={h} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border/60 last:border-0 even:bg-muted/40">{r.map((c, j) => <td key={j} className="px-3 py-2 text-foreground align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function Grid({ cols = 4, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  return <div className={cn("grid gap-3", cols === 4 ? "grid-cols-2 lg:grid-cols-4" : cols === 3 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2")}>{children}</div>;
}
function Bars({ items, max, format = (v: number) => v.toFixed(3), color = BRAND }: { items: { name: string; value: number; note?: string }[]; max?: number; format?: (v: number) => string; color?: string }) {
  const m = max ?? Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.name}>
          <div className="flex justify-between text-xs mb-0.5"><span className="text-foreground truncate pr-3">{i.name}</span><span className="text-muted-foreground flex-shrink-0">{i.note ?? format(i.value)}</span></div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (i.value / m) * 100)}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}
function Pill({ v }: { v: string }) {
  const cls = v === "supported" || v === "pass" || v === "done" ? "bg-brand/10 text-brand"
    : v === "weak" || v === "quarantined" || v === "warn" ? "bg-[#ff6196]/10 text-[#C30D5C]" : "bg-muted text-muted-foreground";
  return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide", cls)}>{v}</span>;
}
function Note({ children, tone = "pink" }: { children: React.ReactNode; tone?: "pink" | "plain" }) {
  return (
    <div className={cn("flex gap-2 text-xs rounded-lg px-3 py-2", tone === "pink" ? "bg-[#ff6196]/10 border border-[#ff6196]/30 text-foreground" : "bg-muted/60 text-muted-foreground")}>
      {tone === "pink" && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#ff6196]" />}<span>{children}</span>
    </div>
  );
}
const Chart = ({ h = 220, children }: { h?: number; children: React.ReactElement }) => <div style={{ height: h }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;

/* ------------------------------------------------------------------ step pages */
function DiscoverStep({ r }: any) {
  const lc = r.label_counts;
  const split = [{ name: "Churned", value: lc.churned, c: PINK }, { name: "Retained", value: lc.retained, c: BRAND }, { name: "Open (scored)", value: lc.unlabeled, c: SOFT }];
  return (
    <div className="space-y-4">
      <Grid><Kpi title="Churned" value={lc.churned.toLocaleString()} pink /><Kpi title="Retained" value={lc.retained.toLocaleString()} /><Kpi title="Open renewals" value={lc.unlabeled.toLocaleString()} sub="scored, not trained on" /><Kpi title="Columns built" value={String(r.merged_columns)} sub={`${r.merged_rows.toLocaleString()} rows`} /></Grid>
      <Grid cols={2}>
        <Card title="How the outcome was built" subtitle={`from ${r.label.column} in ${r.base_table}`}>
          <div className="flex items-center gap-4">
            <div className="w-40 h-40"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={split} dataKey="value" innerRadius={42} outerRadius={70} paddingAngle={2}>{split.map((s) => <Cell key={s.name} fill={s.c} />)}</Pie><Tooltip {...TT} formatter={(v: number) => v.toLocaleString()} /></PieChart></ResponsiveContainer></div>
            <ul className="text-xs space-y-1.5">{split.map((s) => <li key={s.name} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.c }} />{s.name}: {s.value.toLocaleString()}</li>)}
              <li className="text-muted-foreground pt-1">Churned = {r.label.churned.join(", ")} · Retained = {r.label.retained.join(", ")}{r.label.open.length ? ` · Open = ${r.label.open.join(", ")}` : ""}</li></ul>
          </div>
        </Card>
        <Card title="Detected columns">
          <Tbl head={["Role", "Column"]} rows={[["Account key", r.link_key ?? "—"], ["Period", r.period_col ?? "—"], ["Revenue", r.value_col ?? "—"], ["Outcome", r.label.column]]} />
        </Card>
      </Grid>
      <Card title="Tables and how they link">
        <Tbl head={["Table", "Rows", "Role"]} rows={r.tables.map((t: any) => [t.name, t.rows.toLocaleString(), <Pill key="p" v={t.role} />])} />
        {r.attached.length > 0 && (
          <div className="mt-4"><div className="text-xs font-semibold mb-2">Share of rows with linked history</div>
            <Bars items={r.attached.map((a: any) => ({ name: `${a.table} (${a.features} features)`, value: a.accounts_covered_pct, note: `${a.accounts_covered_pct.toFixed(0)}%` }))} max={100} /></div>
        )}
      </Card>
      {r.log.length > 0 && <Card title="What was done"><ul className="space-y-1 text-xs text-muted-foreground">{r.log.map((l: string, i: number) => <li key={i}>• {l}</li>)}</ul></Card>}
    </div>
  );
}

function UnderstandStep({ r }: any) {
  const q = r.quality;
  return (
    <div className="space-y-4">
      <Grid><Kpi title="Rows" value={r.rows.toLocaleString()} sub={`${r.columns} columns`} /><Kpi title="Accounts" value={r.entities.toLocaleString()} sub={r.is_panel ? `~${r.rows_per_entity_median.toFixed(0)} rows each` : undefined} /><Kpi title="Churn rate" value={pct(r.churn_rate)} sub={`${r.positives.toLocaleString()} churned rows`} pink /><Kpi title="Period" value={r.snapshots ? `${r.snapshots} snapshots` : "—"} sub={r.date_min ? `${String(r.date_min).slice(0, 10)} → ${String(r.date_max).slice(0, 10)}` : undefined} /></Grid>
      <Grid cols={2}>
        {q && <Card title="Data quality" subtitle={`Overall ${q.overall}/100`}><Bars max={100} format={(v) => `${v.toFixed(0)}`} items={[{ name: "Overall", value: q.overall }, { name: "Completeness", value: q.completeness }, { name: "Consistency", value: q.consistency }, { name: "Uniqueness", value: q.uniqueness }]} />
          {q.issues?.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{q.issues.map((i: string, k: number) => <li key={k}>• {i}</li>)}</ul>}</Card>}
        <Card title="Most incomplete columns" subtitle="Share of missing values">
          {r.missing_top.length ? <Bars max={100} format={(v) => `${v.toFixed(1)}%`} color={PINK} items={r.missing_top.map((m: any) => ({ name: m.column, value: m.pct }))} /> : <p className="text-sm text-muted-foreground">No missing values.</p>}
        </Card>
      </Grid>
      {r.issues.length > 0 && r.issues.map((i: string, k: number) => <Note key={k}>{i}</Note>)}
    </div>
  );
}

function LeakageStep({ r }: any) {
  const data = (r.top_univariate ?? []).slice(0, 14).map((u: any) => ({ name: label(u.feature), v: Math.max(u.auc, 1 - u.auc) }));
  return (
    <div className="space-y-4">
      {r.probe && <Note>A model on all remaining features reached AUC {r.probe.auc_with.toFixed(2)}, which is implausible for churn. Removed: {r.probe.removed.map((x: any) => label(x.feature)).join(", ")}.</Note>}
      <Grid cols={3}><Kpi title="Features screened" value={String(r.candidate_features)} /><Kpi title="Kept out (leaks)" value={String(r.excluded.length)} pink /><Kpi title="Text columns checked" value={String(r.categorical_checked ?? 0)} /></Grid>
      <Card title="How well each feature alone separates churned from retained" subtitle="Above 0.80 needs a check; above 0.90 is excluded as a leak">
        <Chart h={Math.max(240, data.length * 26)}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 24 }}>
            <CartesianGrid horizontal={false} stroke={GRID} /><XAxis type="number" domain={[0.5, 1]} tick={AX} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={200} tick={AX} axisLine={false} tickLine={false} />
            <Tooltip {...TT} formatter={(v: number) => v.toFixed(3)} /><ReferenceLine x={0.8} stroke={PINK} strokeDasharray="4 3" /><ReferenceLine x={0.9} stroke="#C30D5C" />
            <Bar dataKey="v" name="Single-feature AUC" radius={[0, 6, 6, 0]}>{data.map((d: any, i: number) => <Cell key={i} fill={d.v >= 0.9 ? "#C30D5C" : d.v >= 0.8 ? PINK : BRAND} />)}</Bar>
          </BarChart>
        </Chart>
      </Card>
      <Card title="Columns kept out of the model">
        {r.excluded.length ? <Tbl head={["Column", "Why"]} rows={r.excluded.map((e: any) => [<code key="c" className="text-xs">{e.feature}</code>, e.reason])} /> : <p className="text-sm text-muted-foreground">No leaking columns found.</p>}
      </Card>
      {r.warnings.length > 0 && <Card title="Worth checking"><ul className="space-y-1 text-xs">{r.warnings.map((w: any, i: number) => <li key={i}><span className="font-medium">{label(w.feature)}</span> — {w.note}</li>)}</ul></Card>}
    </div>
  );
}

function Heat({ c }: { c: { features: string[]; matrix: (number | null)[][] } }) {
  const n = c.features.length;
  const name = (f: string) => (f === "__churned" ? "Churned (label)" : label(f));
  const col = (v: number | null) => (v == null ? "transparent" : v >= 0 ? `rgba(255,97,150,${Math.min(1, Math.abs(v))})` : `rgba(75,31,176,${Math.min(1, Math.abs(v))})`);
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `200px repeat(${n}, 34px)` }}>
        <div />{c.features.map((_, j) => <div key={j} className="text-[10px] text-center text-muted-foreground">{j + 1}</div>)}
        {c.features.map((f, i) => (
          <div key={f} className="contents">
            <div className="text-[11px] text-foreground truncate pr-2 leading-[30px]" title={name(f)}>{i + 1}. {name(f)}</div>
            {c.matrix[i].map((v, j) => <div key={j} title={`${name(f)} × ${name(c.features[j])}: ${v == null ? "—" : v.toFixed(2)}`} className="h-[30px] flex items-center justify-center text-[9px] rounded-sm" style={{ background: col(v), color: v != null && Math.abs(v) > 0.55 ? "#fff" : MUTED }}>{v == null ? "" : v.toFixed(1)}</div>)}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground"><span className="w-3 h-3 rounded-sm" style={{ background: BRAND }} />negative<span className="w-3 h-3 rounded-sm ml-3" style={{ background: PINK }} />positive (Spearman)</div>
    </div>
  );
}

function EdaStep({ r }: any) {
  return (
    <div className="space-y-4">
      {r.churn_by_date?.length > 1 && (
        <Card title="Churn rate over time" subtitle={`Average ${pct(r.base_rate)}`}>
          <Chart h={230}><LineChart data={r.churn_by_date} margin={{ left: 0, right: 12 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="date" tick={AX} axisLine={false} tickLine={false} minTickGap={40} /><YAxis tickFormatter={(v) => pct(v, 0)} tick={AX} axisLine={false} tickLine={false} width={40} /><Tooltip {...TT} formatter={(v: number) => pct(v)} /><ReferenceLine y={r.base_rate} stroke={PINK} strokeDasharray="4 3" /><Line type="monotone" dataKey="rate" stroke={BRAND} strokeWidth={2} dot={false} name="Churn rate" /></LineChart></Chart>
        </Card>
      )}
      {r.segments?.length > 0 && (
        <Card title="Where churn concentrates" subtitle="Segments furthest from the average rate">
          <Tbl head={["Segment", "Rows", "Churn rate", ""]} rows={r.segments.slice(0, 10).map((s: any) => [`${s.dimension.replace(/_/g, " ")}: ${s.group}`, s.n.toLocaleString(), pct(s.churn_rate), <div key="b" className="min-w-[120px]"><Bars items={[{ name: "", value: s.churn_rate, note: `${s.lift.toFixed(1)}×` }]} max={1} color={s.lift > 1 ? PINK : BRAND} /></div>])} />
        </Card>
      )}
      {r.distributions?.length > 0 && (
        <Card title="Distributions: churned vs retained" subtitle="Share of each group at each value, for the strongest drivers">
          <div className="grid lg:grid-cols-2 gap-5">
            {r.distributions.map((d: any) => (
              <div key={d.feature}><div className="text-xs font-medium mb-1">{label(d.feature)}</div>
                <Chart h={150}><BarChart data={d.bins} barGap={0} barCategoryGap={1}><XAxis dataKey="x" tick={AX} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} minTickGap={24} /><Tooltip {...TT} formatter={(v: number) => pct(v)} labelFormatter={(x) => `≈ ${fmt(Number(x))}`} /><Bar dataKey="retained" fill={BRAND} name="Retained" /><Bar dataKey="churned" fill={PINK} name="Churned" /></BarChart></Chart></div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: BRAND }} />Retained</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: PINK }} />Churned</span></div>
        </Card>
      )}
      {r.driver_bins?.length > 0 && (
        <Card title="Churn rate by driver level" subtitle="Five equal groups, low → high">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{r.driver_bins.slice(0, 6).map((d: any) => (
            <div key={d.feature}><div className="text-xs font-medium mb-1">{label(d.feature)}</div>
              <Chart h={100}><BarChart data={d.bins}><XAxis dataKey="bin" tick={AX} axisLine={false} tickLine={false} /><Tooltip {...TT} formatter={(v: number) => pct(v)} labelFormatter={(b) => `Group ${b}`} /><Bar dataKey="churn_rate" fill={BRAND} radius={[4, 4, 0, 0]} name="Churn rate" /></BarChart></Chart></div>
          ))}</div>
        </Card>
      )}
      {r.correlation?.features?.length > 2 && <Card title="Correlations" subtitle="Strongest drivers and the churn label"><Heat c={r.correlation} /></Card>}
      <Grid cols={2}>
        {r.outliers?.length > 0 && <Card title="Outliers" subtitle="Share of values outside 1.5 × IQR"><Bars max={Math.max(...r.outliers.map((o: any) => o.outlier_pct), 0.01)} format={(v) => pct(v)} color={PINK} items={r.outliers.map((o: any) => ({ name: label(o.feature), value: o.outlier_pct }))} /></Card>}
        {r.value && <Card title="Revenue view" subtitle={r.value.column}><Tbl head={["", "Retained", "Churned"]} rows={[["Average", fmt(r.value.mean_retained), fmt(r.value.mean_churned)], ["Median", fmt(r.value.median_retained), fmt(r.value.median_churned)]]} /><p className="text-xs text-muted-foreground mt-3">Churned rows hold {pct(r.value.churned_value_share)} of total {r.value.column}.</p></Card>}
      </Grid>
      {r.profile?.length > 0 && <Card title="Column profile" subtitle="Strongest drivers"><Tbl head={["Feature", "Missing", "Mean", "Std", "Min", "Max", "Skew"]} rows={r.profile.map((p: any) => [label(p.feature), `${p.missing_pct.toFixed(1)}%`, fmt(p.mean), fmt(p.std), fmt(p.min), fmt(p.max), p.skew == null ? "—" : p.skew.toFixed(1)])} /></Card>}
    </div>
  );
}

function HypothesesStep({ r }: any) {
  const items = r.hypotheses.map((h: any) => ({ ...h, name: label(h.feature) }));
  return (
    <div className="space-y-4">
      <Grid cols={3}><Kpi title="Tested" value={String(r.total)} /><Kpi title="Supported" value={String(r.supported)} sub="meaningful effect, FDR-corrected" /><Kpi title="Accounts used" value={r.tested_on_rows.toLocaleString()} sub="one row per account" /></Grid>
      <Card title="Effect size of each finding" subtitle="0 = no difference, 1 = perfect separation">
        <Chart h={Math.max(220, items.length * 26)}><BarChart data={items} layout="vertical" margin={{ left: 10, right: 24 }}><CartesianGrid horizontal={false} stroke={GRID} /><XAxis type="number" domain={[0, 1]} tick={AX} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={210} tick={AX} axisLine={false} tickLine={false} /><Tooltip {...TT} formatter={(v: number) => v.toFixed(2)} /><Bar dataKey="effect" name="Effect" radius={[0, 6, 6, 0]}>{items.map((h: any, i: number) => <Cell key={i} fill={h.verdict === "supported" ? BRAND : h.verdict === "quarantined" ? SOFT : PINK} />)}</Bar></BarChart></Chart>
      </Card>
      <Card title="Findings">
        <Tbl head={["Finding", "Churn: high vs low", "Effect", "q-value", "Verdict"]} rows={r.hypotheses.map((h: any) => [h.statement, h.churn_rate_high != null && h.churn_rate_low != null ? `${pct(h.churn_rate_high)} vs ${pct(h.churn_rate_low)}` : "—", h.effect_label, h.q_value < 0.001 ? "<0.001" : h.q_value.toFixed(3), <Pill key="v" v={h.verdict} />])} />
      </Card>
    </div>
  );
}

function FeaturesStep({ r }: any) {
  const kinds = Object.entries(r.kinds ?? {}).map(([k, v]) => ({ name: k, v: v as number }));
  return (
    <div className="space-y-4">
      <Grid cols={3}><Kpi title="Original features" value={String(r.base_features)} /><Kpi title="Engineered" value={String(r.created_count)} pink /><Kpi title="Total" value={String(r.total_features)} /></Grid>
      {kinds.length > 0 && <Card title="What was created"><Chart h={170}><BarChart data={kinds} layout="vertical" margin={{ left: 10 }}><XAxis type="number" tick={AX} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={130} tick={AX} axisLine={false} tickLine={false} /><Tooltip {...TT} /><Bar dataKey="v" fill={BRAND} radius={[0, 6, 6, 0]} name="Features" /></BarChart></Chart></Card>}
      <Card title="New features" subtitle={`Showing ${Math.min(r.created.length, 40)} of ${r.created_count}`}><Tbl head={["Feature", "Type", "Meaning"]} rows={r.created.map((c: any) => [label(c.feature), c.kind, c.note])} /></Card>
    </div>
  );
}

function SelectStep({ r }: any) {
  const sp = r.split;
  const drops = Object.entries(r.dropped_by_reason ?? {}).map(([k, v]) => ({ name: k, value: v as number }));
  return (
    <div className="space-y-4">
      <Grid><Kpi title="Started with" value={String(r.start_features)} /><Kpi title="Kept" value={String(r.selected)} pink /><Kpi title="Train" value={sp.train_rows.toLocaleString()} sub={`${sp.train_entities.toLocaleString()} accounts`} /><Kpi title="Holdout" value={sp.holdout_rows.toLocaleString()} sub={`${sp.holdout_entities.toLocaleString()} unseen accounts`} /></Grid>
      <Note tone="plain">{sp.kind === "entity-disjoint" ? "Train and holdout never share an account, so the test measures how the model does on customers it has never seen." : "Stratified random split."} Holdout has {sp.holdout_positives.toLocaleString()} churned rows.</Note>
      <Grid cols={2}>
        <Card title="Why features were dropped"><Bars color={PINK} format={(v) => String(v)} items={drops} /></Card>
        <Card title="Strongest features by mutual information"><Bars items={r.top_mutual_information.slice(0, 10).map((m: any) => ({ name: label(m.feature), value: m.mi }))} /></Card>
      </Grid>
      {r.dropped_sample?.length > 0 && <Card title="Examples of dropped features"><Tbl head={["Feature", "Reason"]} rows={r.dropped_sample.slice(0, 12).map((d: any) => [label(d.feature), d.reason])} /></Card>}
    </div>
  );
}

function ModelsStep({ r, all }: any) {
  const rows = r.leaderboard.filter((b: any) => b.holdout);
  const cmp = rows.map((b: any) => ({ name: b.model.replace(" (prevalence)", ""), AUC: b.holdout.roc_auc, "PR-AUC": b.holdout.pr_auc }));
  const cal = (r.calibration?.bins ?? []).map((b: any) => ({ predicted: b.predicted, observed: b.observed, ideal: b.predicted }));
  const gain = all.value?.gain_table;
  return (
    <div className="space-y-4">
      {r.quarantined?.length > 0 && <Note>First model reached AUC {r.quarantined[0].auc_with.toFixed(2)}, which is implausible for churn. Retrained without {r.quarantined.map((q: any) => q.feature).join(", ")}.</Note>}
      <Card title="Model comparison" subtitle={`Selected on cross-validated PR-AUC (${r.cv_folds} folds) · tested on unseen accounts`}>
        <Tbl head={["Model", "AUC", "PR-AUC", "Top-10% lift", "Catches (top 10%)", "Time"]} rows={rows.map((b: any) => [<span key="m" className={cn(b.selected && "font-semibold text-brand")}>{b.model}{b.selected ? " ✓ selected" : ""}</span>, b.holdout.roc_auc?.toFixed(3), b.holdout.pr_auc?.toFixed(3), b.holdout.lift_top10 ? `${b.holdout.lift_top10.toFixed(1)}×` : "—", pct(b.holdout.recall_top10, 0), `${b.train_seconds ?? 0}s`])} />
      </Card>
      <Grid cols={2}>
        <Card title="AUC and PR-AUC by model"><Chart h={220}><BarChart data={cmp}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="name" tick={AX} axisLine={false} tickLine={false} /><YAxis domain={[0, 1]} tick={AX} axisLine={false} tickLine={false} width={30} /><Tooltip {...TT} formatter={(v: number) => v.toFixed(3)} /><Bar dataKey="AUC" fill={BRAND} radius={[4, 4, 0, 0]} /><Bar dataKey="PR-AUC" fill={PINK} radius={[4, 4, 0, 0]} /></BarChart></Chart></Card>
        {gain && <Card title="Churners found by risk rank" subtitle="Unseen accounts in deciles, riskiest first"><Chart h={220}><ComposedChart data={gain}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="decile" tick={AX} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v) => pct(v, 0)} tick={AX} axisLine={false} tickLine={false} width={40} /><Tooltip {...TT} formatter={(v: number) => pct(v)} labelFormatter={(d) => `Decile ${d}`} /><Area type="monotone" dataKey="cum_capture" stroke={BRAND} fill={BRAND} fillOpacity={0.12} name="Churners found (cumulative)" /><Bar dataKey="churn_rate" fill={PINK} radius={[4, 4, 0, 0]} name="Churn rate in decile" /></ComposedChart></Chart></Card>}
      </Grid>
      {cal.length > 0 && (
        <Card title="Calibration" subtitle={`Error ${r.calibration.ece_before.toFixed(3)} → ${r.calibration.ece_after.toFixed(3)} after calibration · closer to the diagonal is better`}>
          <Chart h={230}><LineChart data={cal} margin={{ left: 0, right: 12 }}><CartesianGrid stroke={GRID} /><XAxis dataKey="predicted" type="number" domain={[0, "auto"]} tickFormatter={(v) => pct(v, 0)} tick={AX} /><YAxis tickFormatter={(v) => pct(v, 0)} tick={AX} width={40} /><Tooltip {...TT} formatter={(v: number) => pct(v)} /><Line dataKey="ideal" stroke={MUTED} strokeDasharray="4 3" dot={false} name="Perfect" /><Line dataKey="observed" stroke={BRAND} strokeWidth={2} name="Observed churn" /></LineChart></Chart>
        </Card>
      )}
      <Note tone="plain">Flag accounts at risk ≥ {r.operating_point.threshold.toFixed(2)}: precision {pct(r.operating_point.precision, 0)}, recall {pct(r.operating_point.recall, 0)} (threshold set on training data only).</Note>
    </div>
  );
}

function ExplainStep({ r }: any) {
  const top = r.top_features.slice(0, 12);
  return (
    <div className="space-y-4">
      <Card title="What moves churn risk" subtitle="Drop in AUC when the feature is shuffled, on unseen accounts · associations, not proof of cause">
        <Chart h={Math.max(240, top.length * 28)}><BarChart data={top.map((t: any) => ({ ...t, name: label(t.feature) }))} layout="vertical" margin={{ left: 10, right: 24 }}><CartesianGrid horizontal={false} stroke={GRID} /><XAxis type="number" tick={AX} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={220} tick={AX} axisLine={false} tickLine={false} /><Tooltip {...TT} formatter={(v: number, _n: string, p: any) => [v.toFixed(4), p.payload.direction]} /><Bar dataKey="importance" fill={BRAND} radius={[0, 6, 6, 0]} name="AUC drop" /></BarChart></Chart>
      </Card>
      <Card title="Direction"><Tbl head={["Feature", "Direction", "Impact"]} rows={top.map((t: any) => [label(t.feature), t.direction, t.importance.toFixed(4)])} /></Card>
      <Note tone="plain">Per-account reasons use {r.attribution_method === "shap" ? "SHAP values" : r.attribution_method} for the {r.driver_rows.toLocaleString()} highest-priority rows.</Note>
    </div>
  );
}

function ValueStep({ r, h }: any) {
  const [save, setSave] = useState(20);
  const hasV = !!r.value_column;
  const high = r.tiers.find((t: any) => t.tier === "High");
  const pie = r.tiers.map((t: any) => ({ name: t.tier, value: hasV ? t.expected_loss : t.accounts }));
  const drv = (d: string) => { const m = d.match(/^(.*?) = (.*)$/); if (!m) return label(d); const bin = m[2] === "0" || m[2] === "1" || m[1].endsWith("__missing") || m[1].includes("="); return bin ? label(m[1]) : `${label(m[1])} = ${m[2]}`; };
  return (
    <div className="space-y-4">
      <Grid><Kpi title="High-risk accounts" value={high?.accounts.toLocaleString() ?? "—"} sub={hasV && high ? `${fmt(high.value)} ${r.value_column}` : undefined} pink />{hasV && <Kpi title="Expected loss" value={fmt(r.expected_loss_total)} sub={`${r.value_column}, all ${r.population}`} pink />}<Kpi title="Accounts scored" value={r.accounts_scored.toLocaleString()} sub={r.population} /><Kpi title="AUC" value={h.roc_auc?.toFixed(2) ?? "—"} sub={h.model} /></Grid>
      <Grid cols={2}>
        <Card title={`Risk tiers · ${r.population}`} subtitle="High = top 10% by risk · Medium = next 20% · Low = the rest">
          <Tbl head={["Tier", "Accounts", "Avg risk", ...(hasV ? [r.value_column, "Expected loss"] : [])]} rows={r.tiers.map((t: any) => [<span key="t" className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: TIER[t.tier] }} />{t.tier}</span>, t.accounts.toLocaleString(), pct(t.avg_probability), ...(hasV ? [fmt(t.value), fmt(t.expected_loss)] : [])])} />
          <Chart h={150}><PieChart><Pie data={pie} dataKey="value" innerRadius={38} outerRadius={62} paddingAngle={2}>{pie.map((p: any) => <Cell key={p.name} fill={TIER[p.name]} />)}</Pie><Tooltip {...TT} formatter={(v: number) => fmt(v)} /></PieChart></Chart>
        </Card>
        <Card title="Retention scenario" subtitle="Your assumption, not a model output">
          {hasV && high ? (<><div className="flex items-center gap-4"><input type="range" min={0} max={60} step={5} value={save} onChange={(e) => setSave(Number(e.target.value))} className="flex-1 accent-[#4b1fb0]" /><span className="text-sm font-semibold w-12 text-right">{save}%</span></div><p className="text-xs text-muted-foreground mt-1">Share of High-tier expected loss recovered.</p>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted/60 p-3"><div className="text-[11px] text-muted-foreground">High-tier expected loss</div><div className="text-lg font-bold">{fmt(high.expected_loss)}</div></div><div className="rounded-lg bg-brand/10 p-3"><div className="text-[11px] text-brand">Recovered</div><div className="text-lg font-bold text-brand">{fmt((high.expected_loss * save) / 100)}</div></div></div></>) : <p className="text-sm text-muted-foreground">No revenue column found, so value at risk can't be sized.</p>}
        </Card>
      </Grid>
      <Card title="Who to call first" subtitle={`Top 15 by ${hasV ? "expected loss" : "risk"}`}>
        <Tbl head={["Account", "Risk", "Tier", ...(hasV ? [r.value_column, "Expected loss"] : []), "Main drivers"]} rows={r.top_accounts.slice(0, 15).map((a: any) => [a.entity, pct(a.probability, 0), <span key="t" className="font-semibold" style={{ color: TIER[a.tier] }}>{a.tier}</span>, ...(hasV ? [fmt(a.value), fmt(a.expected_loss)] : []), <span key="d" className="text-muted-foreground">{(a.drivers ?? []).slice(0, 2).map(drv).join(" · ") || "—"}</span>])} />
      </Card>
    </div>
  );
}

function ValidateStep({ r }: any) {
  return (
    <div className="space-y-4">
      <Grid cols={3}><Kpi title="Passed" value={`${r.passed} of ${r.total}`} /><Kpi title="Warnings" value={String(r.checks.filter((c: any) => c.status === "warn").length)} pink /><Kpi title="Failed" value={String(r.checks.filter((c: any) => c.status === "fail").length)} /></Grid>
      <Card><ul className="divide-y divide-border">{r.checks.map((c: any, i: number) => (
        <li key={i} className="flex gap-3 py-2.5">{c.status === "pass" ? <CheckCircle2 className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" /> : c.status === "warn" ? <AlertTriangle className="w-4 h-4 text-[#ff6196] mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
          <div><div className="text-sm font-medium">{c.check}</div><div className="text-xs text-muted-foreground">{c.detail}</div></div></li>))}</ul></Card>
    </div>
  );
}

function DlBtn({ icon, text, onClick, primary }: { icon: React.ReactNode; text: string; onClick: () => void; primary?: boolean }) {
  return <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors", primary ? "bg-brand text-brand-foreground border-brand hover:opacity-90" : "bg-card border-border text-foreground hover:bg-muted")}>{icon}{text}</button>;
}

function BuildStep({ r, run, dl }: any) {
  const pv = r.preview ?? [];
  const cols = pv.length ? Object.keys(pv[0]) : [];
  return (
    <div className="space-y-4">
      <Grid cols={3}><Kpi title="Rows" value={r.enriched_rows.toLocaleString()} sub="all original rows kept" /><Kpi title="Columns" value={String(r.enriched_columns)} sub={`${r.integrity.added_columns} added`} pink /><Kpi title="Accounts file" value={r.account_file_rows.toLocaleString()} sub="one row per account" /></Grid>
      <Card title="Download" subtitle="Original rows and columns unchanged; ds_ columns appended">
        <div className="flex flex-wrap gap-2">
          {run.files.enriched && <DlBtn primary icon={<Download className="w-3.5 h-3.5" />} text="Enriched data (.csv)" onClick={() => dl("enriched", "csv")} />}
          {run.files.enriched && <DlBtn icon={<FileSpreadsheet className="w-3.5 h-3.5" />} text="Enriched (.xlsx)" onClick={() => dl("enriched", "xlsx")} />}
          {run.files.accounts && <DlBtn icon={<Users className="w-3.5 h-3.5" />} text="One row per account" onClick={() => dl("accounts", "csv")} />}
          {run.files.dictionary && <DlBtn icon={<FileText className="w-3.5 h-3.5" />} text="Data dictionary" onClick={() => dl("dictionary", "csv")} />}
          {run.files.model && <DlBtn icon={<Download className="w-3.5 h-3.5" />} text="Model (.joblib)" onClick={() => dl("model", "csv")} />}
        </div>
        <div className={cn("mt-4 text-xs rounded-lg px-3 py-2 flex items-center gap-2", r.integrity.ok ? "bg-brand/10 text-brand" : "bg-red-50 text-red-700")}>{r.integrity.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{r.integrity.ok ? "Format check passed: original data unchanged." : "The original data was altered — do not use this file."}</div>
      </Card>
      {pv.length > 0 && <Card title="Preview of added columns"><Tbl head={cols} rows={pv.map((row: any) => cols.map((c) => String(row[c] ?? "")))} /></Card>}
      <Card title="Added columns"><Tbl head={["Column", "Type", "Meaning"]} rows={r.dictionary.map((d: any) => [<code key="c" className="text-xs">{d.column}</code>, d.type, d.description])} /></Card>
    </div>
  );
}

function ReportStep({ run, dl }: any) {
  const h = run.headline ?? {};
  const nar = run.narrative;
  const bullets: string[] = nar?.executive_summary ? nar.executive_summary.split(/(?<=[.])\s+(?=[A-Z0-9])/) : [];
  const flags: string[] = (nar?.caveats ?? []).filter((c: string) => !c.startsWith("Excluded"));
  return (
    <div className="space-y-4">
      <Grid><Kpi title="High-risk accounts" value={h.high_risk_accounts?.toLocaleString() ?? "—"} sub={h.value_column ? `${fmt(h.high_risk_value)} ${h.value_column}` : undefined} pink />{h.value_column && <Kpi title="Expected loss" value={fmt(h.expected_loss_total)} sub={`${h.value_column}, all ${h.population ?? "accounts"}`} pink />}<Kpi title="AUC" value={h.roc_auc?.toFixed(2) ?? "—"} sub={`${h.model ?? ""}, unseen accounts`} /><Kpi title="Top-10% lift" value={h.lift_top10 ? `${h.lift_top10.toFixed(1)}×` : "—"} sub={`catches ${pct(h.recall_top10, 0)} of churners`} /></Grid>
      {bullets.length > 0 && <Card title="Summary"><ul className="space-y-1.5">{bullets.map((b, i) => <li key={i} className="flex gap-2.5 text-sm"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />{b}</li>)}</ul>{flags.map((c, i) => <div key={i} className="mt-3"><Note>{c}</Note></div>)}</Card>}
      {nar?.actions?.length > 0 && <Card title="Recommended actions"><ul className="space-y-2">{nar.actions.map((a: any, i: number) => <li key={i} className="text-sm"><span className="font-semibold">{a.driver}</span><span className="text-muted-foreground"> — {a.action}</span></li>)}</ul></Card>}
      {run.markdown && (
        <Card title="Report" right={<DlBtn icon={<FileText className="w-3.5 h-3.5" />} text="Download (.docx)" onClick={() => dl("report", "docx")} />}>
          <details><summary className="text-xs text-brand cursor-pointer">Read the full report</summary><div className="mt-3"><Markdown content={run.markdown} /></div></details>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ real AutoEDA pages, embedded */

function Embedded({ datasetId, path, workspaceId }: { datasetId: number; path: string; workspaceId: string }) {
  // "@auto" = the Auto EDA page (the same agent-written report as the Auto EDA feature), scoped to this flow's table
  const src = path === "@auto" ? `/workspaces/${workspaceId}/auto-eda?dataset_id=${datasetId}&embed=1`
    : path === "@hyp" ? `/workspaces/${workspaceId}/hypotheses?dataset_id=${datasetId}&embed=1`
    : path === "@scout" ? `/workspaces/${workspaceId}/scout?embed=1`
    : `/datasets/${datasetId}/${path}${path.includes("?") ? "&" : "?"}embed=1`;
  return <iframe key={src} src={src} title={path} className="w-full rounded-xl border border-border bg-background" style={{ height: "max(600px, calc(100vh - 130px))" }} />;
}

/* ------------------------------------------------------------------ workspace shell */
function StageIcon({ s }: { s: FlowStage["status"] }) {
  if (s === "running") return <Loader2 className="w-4 h-4 text-brand animate-spin" />;
  if (s === "done") return <CheckCircle2 className="w-4 h-4 text-brand" />;
  if (s === "error") return <XCircle className="w-4 h-4 text-red-500" />;
  if (s === "skipped") return <MinusCircle className="w-4 h-4 text-muted-foreground/50" />;
  return <Circle className="w-4 h-4 text-muted-foreground/40" />;
}

/* ------------------------------------------------------------------ the 10 phases of the project
   The engine keeps finer internal stages (for progress and error handling); the screen groups them into the
   phases of a standard data-science project. Each real AutoEDA page is embedded once, in the phase it belongs to. */
type Tab = { label: string; embed?: string; stage?: string };
type Phase = { id: string; title: string; stages: string[]; embedFirst: boolean; tabs: Tab[] };

const PHASES: Phase[] = [
  { id: "discover", title: "Discover & link", stages: ["discover"], embedFirst: false, tabs: [{ label: "Overview", stage: "discover" }] },
  { id: "checks", title: "Data checks", stages: ["understand", "leakage"], embedFirst: true,
    tabs: [{ label: "Profile", embed: "profile" }, { label: "Overview", embed: "overview" }, { label: "Data summary", stage: "understand" }, { label: "Leakage audit", stage: "leakage" }] },
  { id: "eda", title: "Explore (EDA)", stages: ["eda"], embedFirst: true,
    tabs: [{ label: "Auto EDA report", embed: "@auto" }, { label: "Analysis", embed: "analysis" }, { label: "Distributions", embed: "distributions" },
      { label: "Correlations", embed: "correlations" }, { label: "Missing", embed: "missing" }, { label: "Outliers", embed: "outliers" },
      { label: "Time series", embed: "timeseries" }, { label: "Flow results", stage: "eda" }] },
  { id: "hyp", title: "Hypotheses", stages: ["hypotheses"], embedFirst: true, tabs: [{ label: "Hypotheses (AI)", embed: "@hyp" }, { label: "Statistical tests", stage: "hypotheses" }] },
  { id: "features", title: "Features", stages: ["features", "select"], embedFirst: false, tabs: [{ label: "Feature engineering", stage: "features" }, { label: "Feature selection", stage: "select" }] },
  { id: "model", title: "Modeling", stages: ["models"], embedFirst: false, tabs: [{ label: "Model comparison", stage: "models" }] },
  { id: "explain", title: "Explain", stages: ["explain"], embedFirst: true, tabs: [{ label: "Feature importance", embed: "feature-importance?target=churned" }, { label: "Drivers", stage: "explain" }] },
  { id: "validate", title: "Validate", stages: ["validate"], embedFirst: false, tabs: [{ label: "Checks", stage: "validate" }] },
  { id: "impact", title: "Business impact", stages: ["value"], embedFirst: false, tabs: [{ label: "Revenue at risk", stage: "value" }] },
  { id: "deliver", title: "Deliverables", stages: ["build", "report"], embedFirst: false,
    tabs: [{ label: "Summary", stage: "report" }, { label: "Files", stage: "build" }, { label: "Ask Scout", embed: "@scout" }] },
];

/* Forecasting runs a genuinely different pipeline (one time series, no classification label), so its stages don't
   map onto PHASES above — but it gets the same real Auto EDA / Hypotheses AI agents (see runner.py execute_forecast_run),
   pointed at the prepared series instead of a churn-style feature table. Stage bodies without a bespoke Step component
   render through PageRenderer, using the `page` spec each forecast stage already returns. */
const FORECAST_PHASES: Phase[] = [
  { id: "prepare", title: "Prepare the series", stages: ["detect"], embedFirst: false, tabs: [{ label: "Overview", stage: "detect" }] },
  { id: "eda", title: "Explore (EDA)", stages: ["explore"], embedFirst: true,
    tabs: [{ label: "Auto EDA report", embed: "@auto" }, { label: "Analysis", stage: "explore" }] },
  { id: "hyp", title: "Hypotheses", stages: ["explore"], embedFirst: true, tabs: [{ label: "Hypotheses (AI)", embed: "@hyp" }] },
  { id: "model", title: "Backtest models", stages: ["models"], embedFirst: false, tabs: [{ label: "Model comparison", stage: "models" }] },
  { id: "forecast", title: "Forecast", stages: ["forecast"], embedFirst: false, tabs: [{ label: "Forecast", stage: "forecast" }] },
  { id: "validate", title: "Validate", stages: ["validate"], embedFirst: false, tabs: [{ label: "Checks", stage: "validate" }] },
  { id: "deliver", title: "Deliverables", stages: ["deliver", "report"], embedFirst: false,
    tabs: [{ label: "Summary", stage: "report" }, { label: "Files", stage: "deliver" }] },
];

/* Dynamic phase selection: recognised pipelines get a tailored, labelled grouping; anything else (a future flow
   type) still works — one phase per stage, rendered generically through PageRenderer. Nothing here is hardcoded
   to a specific flow_key, only to the stage *keys* a pipeline actually produces. */
function pickPhases(stages: FlowStage[]): Phase[] {
  const keys = new Set(stages.map((s) => s.key));
  if (keys.has("discover")) return PHASES;
  if (keys.has("detect")) return FORECAST_PHASES;
  return stages.map((s) => ({ id: s.key, title: s.title, stages: [s.key], embedFirst: false, tabs: [{ label: s.title, stage: s.key }] }));
}

function phaseStatus(ss: FlowStage[]): FlowStage["status"] {
  if (ss.some((s) => s.status === "error")) return "error";
  if (ss.some((s) => s.status === "running")) return "running";
  if (ss.every((s) => s.status === "done")) return "done";
  if (ss.every((s) => s.status === "skipped")) return "skipped";
  return ss.some((s) => s.status === "done") ? "running" : "pending";
}

export function FlowWorkspace({ run, workspaceId }: { run: FlowRunFull; workspaceId: string }) {
  const [pickedPhase, setPickedPhase] = useState<string | null>(null);
  const [pickedTab, setPickedTab] = useState<{ phase: string; label: string } | null>(null);
  const R = run.results ?? {};
  const running = run.status === "pending" || run.status === "running";
  const byKey = useMemo(() => Object.fromEntries(run.stages.map((s) => [s.key, s])), [run.stages]);
  const isClassificationPipeline = useMemo(() => run.stages.some((s) => s.key === "discover"), [run.stages]);
  const PHASE_SET = useMemo(() => pickPhases(run.stages), [run.stages]);

  const phases = useMemo(() => PHASE_SET.map((p) => {
    const ss = p.stages.map((k) => byKey[k]).filter(Boolean) as FlowStage[];
    return { ...p, ss, status: phaseStatus(ss), seconds: ss.reduce((t, s) => t + (s.seconds ?? 0), 0), summary: ss.map((s) => s.summary).filter(Boolean).join(" · ") };
  }), [byKey, PHASE_SET]);

  // follow progress until the user picks a phase; when finished, open the deliverables
  const auto = useMemo(() => {
    if (running) return phases.find((p) => p.status === "running")?.id ?? [...phases].reverse().find((p) => p.status === "done")?.id ?? phases[0].id;
    return run.status === "completed" ? "deliver" : [...phases].reverse().find((p) => p.status === "error")?.id ?? phases[0].id;
  }, [running, phases, run.status]);
  const phase = phases.find((p) => p.id === (pickedPhase ?? auto)) ?? phases[0];
  const finished = phases.filter((p) => ["done", "error", "skipped"].includes(p.status)).length;

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

  // the real pages read the saved working table: available once that phase has finished (the EDA phase shows live)
  const embedsReady = !!run.working_dataset_id && (phase.status === "done" || phase.id === "eda");
  const tabs = phase.tabs.filter((t) => !t.embed || embedsReady);
  const defaultTab = phase.embedFirst && embedsReady ? tabs[0] : tabs.find((t) => t.stage) ?? tabs[0];
  const activeTab = tabs.find((t) => pickedTab?.phase === phase.id && t.label === pickedTab.label) ?? defaultTab;

  const stageBody = (key: string) => {
    const st = byKey[key];
    const r = R[key];
    const wait = (
      <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
        {st?.status === "running" ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Running…</span>
          : st?.status === "pending" ? "Waiting for the earlier steps to finish."
          : st?.status === "skipped" ? "Skipped because an earlier step failed."
          : st?.status === "error" ? `This step failed. ${st.summary ?? ""}` : "No data for this step."}
      </div>
    );
    if (isClassificationPipeline) {
      if (key === "report") return st?.status === "done" || run.narrative ? <ReportStep run={run} dl={dl} /> : wait;
      if (!r) return wait;
      switch (key) {
        case "discover": return <DiscoverStep r={r} />;
        case "understand": return <UnderstandStep r={r} />;
        case "leakage": return <LeakageStep r={r} />;
        case "eda": return <EdaStep r={r} />;
        case "hypotheses": return <HypothesesStep r={r} />;
        case "features": return <FeaturesStep r={r} />;
        case "select": return <SelectStep r={r} />;
        case "models": return <ModelsStep r={r} all={R} />;
        case "explain": return <ExplainStep r={r} />;
        case "value": return <ValueStep r={r} h={run.headline ?? R.models?.holdout_metrics ?? {}} />;
        case "validate": return <ValidateStep r={r} />;
        case "build": return <BuildStep r={r} run={run} dl={dl} />;
        default: return wait;
      }
    }
    // Any other pipeline (forecasting today, future flow types tomorrow): no bespoke Step component exists for
    // these stage keys, so render the stage's own `page` spec through the generic block renderer.
    if (key === "scope") return st?.status === "done" ? <ScopeResult stage={st} /> : wait;
    if (st?.status !== "done") return wait;
    return r?.page?.blocks?.length
      ? <PageRenderer page={r.page} run={run} workspaceId={workspaceId} />
      : <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">{st?.summary ?? "Stage complete — no visual output for this step."}</div>;
  };

  return (
    <div className="grid lg:grid-cols-[210px_1fr] gap-3 items-start">
      <aside className="bg-card border border-border rounded-xl overflow-x-auto overflow-y-auto lg:max-h-[calc(100vh-1rem)] lg:sticky lg:top-2">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex justify-between text-xs mb-1.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan">Phases</span><span className="text-muted-foreground">{finished} of {phases.length}</span></div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-brand transition-all duration-500" style={{ width: `${(finished / phases.length) * 100}%` }} /></div>
        </div>
        <ol className="min-w-max">
          {phases.map((p, i) => (
            <li key={p.id}>
              <button onClick={() => setPickedPhase(p.id)} className={cn("w-full flex items-center gap-2 px-3 py-2 text-left border-l-2 transition-colors", p.id === phase.id ? "border-brand bg-brand/10" : "border-transparent hover:bg-muted/50")}>
                <StageIcon s={p.status} />
                <span className={cn("flex-1 text-sm whitespace-nowrap", p.id === phase.id ? "text-brand font-semibold" : p.status === "pending" ? "text-muted-foreground" : "text-foreground font-medium")}>{i + 1}. {p.title}</span>
                {p.seconds > 0 && <span className="text-[10px] text-muted-foreground">{Math.round(p.seconds)}s</span>}
                <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground", p.id !== phase.id && "opacity-0")} />
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <section className="min-w-0 space-y-2">
        <div>
          <h2 className="text-lg font-bold text-jman-midnight dark:text-foreground flex items-center gap-2">{phase.title}{phase.status !== "done" && <Pill v={phase.status} />}</h2>
          {phase.summary && <p className={cn("text-xs mt-0.5", phase.status === "error" ? "text-red-600" : "text-muted-foreground")}>{phase.summary}</p>}
        </div>
        {tabs.length > 1 && (
          <div className="flex gap-0 border-b border-border overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.label} onClick={() => setPickedTab({ phase: phase.id, label: t.label })}
                className={cn("px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                  activeTab?.label === t.label ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        {activeTab?.embed && run.working_dataset_id
          ? <Embedded datasetId={run.working_dataset_id} path={activeTab.embed} workspaceId={workspaceId} />
          : activeTab?.stage ? stageBody(activeTab.stage) : stageBody(phase.stages[0])}
      </section>
    </div>
  );
}
