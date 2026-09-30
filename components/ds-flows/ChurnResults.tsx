"use client";

import { useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, Users, XCircle } from "lucide-react";
import { dsFlowsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FlowRun {
  id: number;
  status: string;
  title: string | null;
  dataset_name: string | null;
  headline: any;
  narrative: any;
  results: any;
  markdown: string | null;
  files: { enriched: boolean; accounts: boolean; dictionary: boolean; model: boolean };
}

// JMAN palette (hex: SVG chart attributes don't resolve CSS variables reliably)
const BRAND = "#4b1fb0";
const PINK = "#ff6196";
const MUTED = "#8a88a3";
const GRID = "rgba(120,120,150,0.25)";
const TIER_COLOR: Record<string, string> = { High: PINK, Medium: BRAND, Low: "#c9bff0" };
const TT = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };

export function fmt(x: number | null | undefined, opts: { pct?: boolean; digits?: number } = {}): string {
  if (x == null || Number.isNaN(x)) return "—";
  if (opts.pct) return `${(x * 100).toFixed(opts.digits ?? 1)}%`;
  const a = Math.abs(x);
  if (a >= 1e9) return `${(x / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(x / 1e3).toFixed(1)}K`;
  if (a >= 100) return Math.round(x).toLocaleString();
  return x.toFixed(opts.digits ?? (Number.isInteger(x) ? 0 : 2));
}

const SUFFIXES: [string, string][] = [
  ["__missing", " (missing)"], ["__delta_prev", " (change vs previous)"], ["__days_before_period", " (days before period)"],
  ["__days_since_last", " (days since last)"], ["__events_last_90d", " (events, last 90 days)"], ["__n_events", " (number of events)"],
];
const titled = (s: string) => {
  const t = s.split("__").filter(Boolean).map((p) => p.replace(/_/g, " ")).join(": ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// readable feature names: "emails__crm_contractor_suggested_leave__yes__avg" -> "Emails: crm contractor suggested leave (share yes)"
export function label(f: string): string {
  if (f.includes("=") && !f.endsWith("__missing")) {
    const i = f.indexOf("=");
    return `${label(f.slice(0, i))}: ${f.slice(i + 1).trim() || "(blank)"}`;
  }
  for (const [suf, txt] of SUFFIXES) if (f.endsWith(suf)) return label(f.slice(0, -suf.length)) + txt;
  if (f.endsWith("__yes__avg")) return titled(f.slice(0, -10)) + " (share yes)";
  if (f.endsWith("__avg")) return titled(f.slice(0, -5)) + " (average)";
  return titled(f);
}
// "feature = value" driver strings: show the value only when it says something (not 0/1 flags)
const driverText = (d: string) => {
  const m = d.match(/^(.*?) = (.*)$/);
  if (!m) return label(d);
  const [, feat, val] = m;
  const binary = val === "0" || val === "1" || feat.endsWith("__missing") || feat.includes("=");
  return binary ? label(feat) : `${label(feat)} = ${val}`;
};

function Kpi({ title, value, sub, pink }: { title: string; value: string; sub?: string; pink?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className={cn("mt-1.5 text-2xl font-bold", pink ? "text-[#ff6196]" : "text-foreground")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl">
      {title && (
        <div className="px-4 pt-3.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            {head.map((h) => <th key={h} className="py-2 pr-4 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {r.map((c, j) => <td key={j} className="py-2 pr-4 text-foreground align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bar1({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-brand" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} /></div>
      <span className="text-muted-foreground w-10 text-right">{value.toFixed(3)}</span>
    </div>
  );
}

const TABS = ["Opportunity", "Drivers", "Patterns", "Model", "Checks", "Files"] as const;

export function ChurnResults({ run, workspaceId }: { run: FlowRun; workspaceId: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Opportunity");
  const [saveRate, setSaveRate] = useState(20);
  const r = run.results ?? {};
  const h = run.headline ?? {};
  const value = r.value;
  const nar = run.narrative;
  const hasValue = !!h.value_column;
  const high = value?.tiers?.find((t: any) => t.tier === "High");
  const bullets: string[] = nar?.executive_summary ? nar.executive_summary.split(/(?<=[.])\s+(?=[A-Z0-9])/) : [];
  const flags: string[] = (nar?.caveats ?? []).filter((c: string) => !c.startsWith("Excluded"));

  const download = async (kind: string, format: string) => {
    const res = await dsFlowsApi.download(workspaceId, run.id, kind, format);
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    const cd = res.headers?.["content-disposition"] as string | undefined;
    a.href = url;
    a.download = cd?.match(/filename="?([^";]+)"?/)?.[1] ?? `${kind}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const findings = (r.hypotheses?.hypotheses ?? []).filter((x: any) => x.verdict === "supported").slice(0, 8);
  const topFeatures = (r.explain?.top_features ?? []).slice(0, 10);
  const maxImp = Math.max(...topFeatures.map((t: any) => t.importance), 0.0001);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="High-risk accounts" value={h.high_risk_accounts != null ? h.high_risk_accounts.toLocaleString() : "—"} sub={hasValue ? `${fmt(h.high_risk_value)} ${h.value_column}` : undefined} pink />
        {hasValue && <Kpi title="Expected loss" value={fmt(h.expected_loss_total)} sub={`${h.value_column}, all ${h.population ?? "accounts"}`} pink />}
        <Kpi title="AUC" value={h.roc_auc != null ? h.roc_auc.toFixed(2) : "—"} sub={`${h.model ?? ""}, unseen accounts`} />
        <Kpi title="Top-10% lift" value={h.lift_top10 != null ? `${h.lift_top10.toFixed(1)}×` : "—"} sub={`catches ${fmt(h.recall_top10, { pct: true, digits: 0 })} of churners`} />
      </div>

      {h.data_used && (
        <p className="text-xs text-muted-foreground -mt-2">
          Data: <span className="text-foreground font-medium">{[h.data_used.base_table, ...(h.data_used.linked ?? [])].join(", ")}</span>
          {" "}· Outcome: <span className="text-foreground font-medium">{h.data_used.outcome_column}</span>
        </p>
      )}

      {bullets.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <ul className="space-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-foreground"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />{b}</li>
            ))}
          </ul>
          {flags.map((c, i) => (
            <div key={i} className="mt-3 flex gap-2 text-xs rounded-lg bg-[#ff6196]/10 border border-[#ff6196]/30 text-foreground px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#ff6196]" /><span>{c}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-3.5 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Opportunity" && value && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title={`Risk tiers · ${value.population}`} subtitle="High = top 10% by risk · Medium = next 20% · Low = the rest">
              <Table
                head={["Tier", "Accounts", "Avg risk", ...(hasValue ? [h.value_column, "Expected loss"] : [])]}
                rows={value.tiers.map((t: any) => [
                  <span key="t" className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: TIER_COLOR[t.tier] }} />{t.tier}</span>,
                  t.accounts.toLocaleString(), fmt(t.avg_probability, { pct: true }),
                  ...(hasValue ? [fmt(t.value), fmt(t.expected_loss)] : []),
                ])}
              />
            </Card>
            <Card title="Retention scenario" subtitle="Your assumption, not a model output">
              {hasValue && high ? (
                <>
                  <div className="flex items-center gap-4">
                    <input type="range" min={0} max={60} step={5} value={saveRate} onChange={(e) => setSaveRate(Number(e.target.value))} className="flex-1 accent-[#4b1fb0]" />
                    <span className="text-sm font-semibold text-foreground w-12 text-right">{saveRate}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Share of High-tier expected loss recovered.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/60 p-3"><div className="text-[11px] text-muted-foreground">High-tier expected loss</div><div className="text-lg font-bold">{fmt(high.expected_loss)}</div></div>
                    <div className="rounded-lg bg-brand/10 p-3"><div className="text-[11px] text-brand">Recovered</div><div className="text-lg font-bold text-brand">{fmt((high.expected_loss * saveRate) / 100)}</div></div>
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground">No revenue column found, so value at risk can't be sized.</p>}
            </Card>
          </div>

          <Card title="Who to call first" subtitle={`Top 15 by ${hasValue ? "expected loss" : "churn probability"}`}>
            <Table
              head={["Account", "Risk", "Tier", ...(hasValue ? [h.value_column, "Expected loss"] : []), "Main drivers"]}
              rows={value.top_accounts.slice(0, 15).map((a: any) => [
                a.entity, fmt(a.probability, { pct: true, digits: 0 }),
                <span key="t" style={{ color: TIER_COLOR[a.tier] }} className="font-semibold">{a.tier}</span>,
                ...(hasValue ? [fmt(a.value), fmt(a.expected_loss)] : []),
                <span key="d" className="text-muted-foreground">{(a.drivers ?? []).slice(0, 2).map(driverText).join(" · ") || "—"}</span>,
              ])}
            />
          </Card>

          {nar?.actions?.length > 0 && (
            <Card title="Recommended actions">
              <ul className="space-y-2">
                {nar.actions.slice(0, 4).map((a: any, i: number) => (
                  <li key={i} className="text-sm"><span className="font-semibold text-foreground">{a.driver}</span><span className="text-muted-foreground"> — {a.action}</span></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "Drivers" && (
        <div className="space-y-4">
          {topFeatures.length > 0 && (
            <Card title="What moves churn risk" subtitle="Drop in AUC when the feature is shuffled, on unseen accounts · associations, not proof of cause">
              <Table head={["Feature", "Direction", "Impact"]} rows={topFeatures.map((t: any) => [label(t.feature), t.direction, <Bar1 key="b" value={t.importance} max={maxImp} />])} />
            </Card>
          )}
          {findings.length > 0 && (
            <Card title="Findings" subtitle="Statistically tested, FDR-corrected, one row per account">
              <Table
                head={["Finding", "Churn: high vs low", "Effect"]}
                rows={findings.map((x: any) => [
                  x.statement,
                  x.churn_rate_high != null && x.churn_rate_low != null ? `${fmt(x.churn_rate_high, { pct: true })} vs ${fmt(x.churn_rate_low, { pct: true })}` : "—",
                  x.effect_label,
                ])}
              />
            </Card>
          )}
        </div>
      )}

      {tab === "Patterns" && r.eda && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {r.eda.churn_by_date?.length > 1 && (
              <Card title="Churn rate over time" subtitle={`Average ${fmt(r.eda.base_rate, { pct: true })}`}>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={r.eda.churn_by_date} margin={{ left: 0, right: 12 }}>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} minTickGap={40} />
                      <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip {...TT} formatter={(v: number) => fmt(v, { pct: true })} />
                      <Line type="monotone" dataKey="rate" stroke={BRAND} strokeWidth={2} dot={false} name="Churn rate" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            {r.eda.segments?.length > 0 && (
              <Card title="Where churn concentrates" subtitle="Segments furthest from average">
                <Table
                  head={["Segment", "Rows", "Churn", "vs avg"]}
                  rows={r.eda.segments.slice(0, 8).map((s: any) => [
                    `${s.dimension.replace(/_/g, " ")}: ${s.group}`, s.n.toLocaleString(), fmt(s.churn_rate, { pct: true }),
                    <span key="l" className={cn("font-semibold", s.lift > 1 ? "text-[#d6336c]" : "text-brand")}>{s.lift.toFixed(1)}×</span>,
                  ])}
                />
              </Card>
            )}
          </div>
          {r.eda.driver_bins?.length > 0 && (
            <Card title="Churn rate by driver level" subtitle="Five equal groups, low → high">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {r.eda.driver_bins.slice(0, 6).map((d: any) => (
                  <div key={d.feature}>
                    <div className="text-xs font-medium text-foreground mb-1">{label(d.feature)}</div>
                    <div className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={d.bins}>
                          <XAxis dataKey="bin" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                          <Tooltip {...TT} formatter={(v: number) => fmt(v, { pct: true })} labelFormatter={(b) => `Group ${b}`} />
                          <Bar dataKey="churn_rate" fill={BRAND} radius={[4, 4, 0, 0]} name="Churn rate" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "Model" && r.models && (
        <div className="space-y-4">
          <Card title="Model comparison" subtitle={`Selected on cross-validated PR-AUC · tested on ${r.select?.split?.holdout_entities?.toLocaleString() ?? ""} unseen accounts`}>
            <Table
              head={["Model", "AUC", "PR-AUC", "Top-10% lift", "Catches (top 10%)"]}
              rows={r.models.leaderboard.filter((b: any) => b.holdout).map((b: any) => [
                <span key="m" className={cn(b.selected && "font-semibold text-brand")}>{b.model}{b.selected ? " ✓" : ""}</span>,
                b.holdout.roc_auc?.toFixed(3) ?? "—", b.holdout.pr_auc?.toFixed(3) ?? "—",
                b.holdout.lift_top10 ? `${b.holdout.lift_top10.toFixed(1)}×` : "—", fmt(b.holdout.recall_top10, { pct: true, digits: 0 }),
              ])}
            />
            <p className="text-xs text-muted-foreground mt-3">
              Flag accounts at risk ≥ {r.models.operating_point.threshold.toFixed(2)}: precision {fmt(r.models.operating_point.precision, { pct: true, digits: 0 })}, recall {fmt(r.models.operating_point.recall, { pct: true, digits: 0 })}.
            </p>
          </Card>
          {value?.gain_table && (
            <Card title="Churners found by risk rank" subtitle="Unseen accounts in deciles, riskiest first">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={value.gain_table}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="decile" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip {...TT} formatter={(v: number) => fmt(v, { pct: true })} labelFormatter={(d) => `Decile ${d}`} />
                    <Area type="monotone" dataKey="cum_capture" stroke={BRAND} fill={BRAND} fillOpacity={0.12} name="Churners found (cumulative)" />
                    <Bar dataKey="churn_rate" fill={PINK} radius={[4, 4, 0, 0]} name="Churn rate in decile" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "Checks" && (
        <div className="space-y-4">
          {r.validate && (
            <Card title={`${r.validate.passed} of ${r.validate.total} checks passed`}>
              <ul className="divide-y divide-border">
                {r.validate.checks.map((c: any, i: number) => (
                  <li key={i} className="flex gap-3 py-2.5">
                    {c.status === "pass" ? <CheckCircle2 className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                      : c.status === "warn" ? <AlertTriangle className="w-4 h-4 text-[#ff6196] mt-0.5 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                    <div><div className="text-sm font-medium text-foreground">{c.check}</div><div className="text-xs text-muted-foreground">{c.detail}</div></div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(r.leakage?.excluded?.length > 0 || r.models?.quarantined?.length > 0) && (
            <Card title="Columns kept out of the model">
              <Table
                head={["Column", "Reason"]}
                rows={[
                  ...(r.leakage?.excluded ?? []).map((e: any) => [<code key={e.feature} className="text-xs">{e.feature}</code>, e.reason]),
                  ...(r.models?.quarantined ?? []).map((q: any) => [<code key={q.feature} className="text-xs">{q.feature}</code>, "Implausibly predictive — likely recorded at or after the decision"]),
                ]}
              />
            </Card>
          )}
        </div>
      )}

      {tab === "Files" && r.build && (
        <div className="space-y-4">
          <Card title="Download" subtitle="Original rows and columns unchanged; ds_ columns appended">
            <div className="flex flex-wrap gap-2">
              {run.files.enriched && <DlBtn icon={<Download className="w-3.5 h-3.5" />} text="Enriched data (.csv)" onClick={() => download("enriched", "csv")} primary />}
              {run.files.enriched && <DlBtn icon={<FileSpreadsheet className="w-3.5 h-3.5" />} text="Enriched (.xlsx)" onClick={() => download("enriched", "xlsx")} />}
              {run.files.accounts && <DlBtn icon={<Users className="w-3.5 h-3.5" />} text="One row per account" onClick={() => download("accounts", "csv")} />}
              {run.files.dictionary && <DlBtn icon={<FileText className="w-3.5 h-3.5" />} text="Data dictionary" onClick={() => download("dictionary", "csv")} />}
              {run.markdown && <DlBtn icon={<FileText className="w-3.5 h-3.5" />} text="Board report (.docx)" onClick={() => download("report", "docx")} />}
              {run.files.model && <DlBtn icon={<Download className="w-3.5 h-3.5" />} text="Model (.joblib)" onClick={() => download("model", "csv")} />}
            </div>
            <div className={cn("mt-4 text-xs rounded-lg px-3 py-2 flex items-center gap-2", r.build.integrity.ok ? "bg-brand/10 text-brand" : "bg-red-50 text-red-700")}>
              {r.build.integrity.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {r.build.integrity.ok
                ? `${r.build.enriched_rows.toLocaleString()} rows preserved · ${r.build.integrity.added_columns} columns added`
                : "The original data was altered — do not use this file."}
            </div>
          </Card>
          <Card title="Added columns">
            <Table head={["Column", "Meaning"]} rows={r.build.dictionary.map((d: any) => [<code key="c" className="text-xs">{d.column}</code>, d.description])} />
          </Card>
        </div>
      )}
    </div>
  );
}

function DlBtn({ icon, text, onClick, primary }: { icon: React.ReactNode; text: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
        primary ? "bg-brand text-brand-foreground border-brand hover:opacity-90" : "bg-card border-border text-foreground hover:bg-muted")}>
      {icon}{text}
    </button>
  );
}
