"use client";

import { useState } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import {
  AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, Lightbulb, ShieldAlert, ShieldCheck, TrendingDown, Users, XCircle,
} from "lucide-react";
import { dsFlowsApi } from "@/lib/api";
import { Markdown } from "@/components/shared/Markdown";
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

const BRAND = "hsl(var(--brand))";
const MUTED = "hsl(var(--muted-foreground))";
const TIER_COLOR: Record<string, string> = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };

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
const label = (f: string) => f.replace(/__/g, " · ").replace(/_/g, " ");

function Kpi({ title, value, sub, icon, tone }: { title: string; value: string; sub?: string; icon: React.ReactNode; tone?: "danger" | "brand" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-semibold uppercase tracking-wide">{title}</span>
        <span className={cn(tone === "danger" && "text-red-500", tone === "brand" && "text-brand")}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Card({ title, subtitle, children, className }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl", className)}>
      {title && (
        <div className="px-4 pt-3.5 pb-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-4 pt-2">{children}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number | React.ReactNode)[][] }) {
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

const TT = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };

function Verdict({ v }: { v: string }) {
  const cls =
    v === "supported" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
    : v === "refuted" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
    : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase", cls)}>{v}</span>;
}

const TABS = ["Opportunity", "Drivers", "Data & patterns", "Models", "Trust checks", "Deliverables", "Full report"] as const;

export function ChurnResults({ run, workspaceId }: { run: FlowRun; workspaceId: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Opportunity");
  const [saveRate, setSaveRate] = useState(20);
  const r = run.results ?? {};
  const h = run.headline ?? {};
  const value = r.value;
  const nar = run.narrative;
  const hasValue = !!h.value_column;

  const high = value?.tiers?.find((t: any) => t.tier === "High");
  const saved = high?.expected_loss != null ? (high.expected_loss * saveRate) / 100 : null;

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

  return (
    <div className="space-y-5">
      {/* headline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi title="Churn rate" value={fmt(h.churn_rate, { pct: true })} sub={`${(h.accounts ?? 0).toLocaleString()} accounts · ${(h.rows ?? 0).toLocaleString()} rows`} icon={<TrendingDown className="w-4 h-4" />} />
        <Kpi title="Model accuracy (AUC)" value={h.roc_auc != null ? h.roc_auc.toFixed(2) : "—"} sub={`${h.model ?? ""} · unseen accounts`} icon={<ShieldCheck className="w-4 h-4" />} tone="brand" />
        <Kpi title="Top-10% lift" value={h.lift_top10 != null ? `${h.lift_top10.toFixed(1)}×` : "—"} sub={`catches ${fmt(h.recall_top10, { pct: true, digits: 0 })} of churners`} icon={<Users className="w-4 h-4" />} tone="brand" />
        <Kpi title="High-risk accounts" value={h.high_risk_accounts != null ? h.high_risk_accounts.toLocaleString() : "—"} sub={hasValue ? `${fmt(h.high_risk_value)} ${h.value_column}` : undefined} icon={<ShieldAlert className="w-4 h-4" />} tone="danger" />
        {hasValue && <Kpi title="Value at risk" value={fmt(h.expected_loss_total)} sub={`probability-weighted ${h.value_column}`} icon={<AlertTriangle className="w-4 h-4" />} tone="danger" />}
      </div>

      {h.data_used && (
        <p className="text-xs text-muted-foreground -mt-2">
          Built from <span className="text-foreground font-medium">{[h.data_used.base_table, ...(h.data_used.linked ?? [])].join(" + ")}</span>
          {" "}· outcome <span className="text-foreground font-medium">{h.data_used.outcome_column}</span>
          {" "}({(h.data_used.churned ?? 0).toLocaleString()} churned, {(h.data_used.retained ?? 0).toLocaleString()} retained
          {h.data_used.open ? `, ${h.data_used.open.toLocaleString()} open renewals scored` : ""})
        </p>
      )}

      {/* what we found */}
      {nar && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-semibold text-foreground">What we found</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">{nar.source === "llm" ? "AI-worded · numbers from computed results" : "Generated from computed results"}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{nar.executive_summary}</p>
          {nar.caveats?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {nar.caveats.map((c: string, i: number) => (
                <div key={i} className="flex gap-2 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* tabs */}
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
            <Card title={`Risk tiers — ${value.population}`} subtitle={value.tier_definition}>
              <Table
                head={["Tier", "Accounts", "Avg probability", ...(hasValue ? [h.value_column, "Expected at risk"] : [])]}
                rows={value.tiers.map((t: any) => [
                  <span key="t" className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: TIER_COLOR[t.tier] }} />{t.tier}</span>,
                  t.accounts.toLocaleString(), fmt(t.avg_probability, { pct: true }),
                  ...(hasValue ? [fmt(t.value), fmt(t.expected_loss)] : []),
                ])}
              />
              <div className="h-40 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={value.tiers} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="tier" width={60} tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} />
                    <Tooltip {...TT} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey={hasValue ? "expected_loss" : "accounts"} radius={[0, 6, 6, 0]} name={hasValue ? "Expected at risk" : "Accounts"}>
                      {value.tiers.map((t: any) => <Cell key={t.tier} fill={TIER_COLOR[t.tier]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="What if we save some of the high-risk accounts?" subtitle="An assumption you control — not a model output">
              {hasValue && high ? (
                <>
                  <div className="flex items-center gap-4">
                    <input type="range" min={0} max={60} step={5} value={saveRate} onChange={(e) => setSaveRate(Number(e.target.value))} className="flex-1 accent-[hsl(var(--brand))]" />
                    <span className="text-sm font-semibold text-foreground w-12 text-right">{saveRate}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Share of expected {h.value_column} loss in the High tier that a retention programme recovers.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/60 p-3"><div className="text-[11px] text-muted-foreground">High-tier expected loss</div><div className="text-lg font-bold">{fmt(high.expected_loss)}</div></div>
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3"><div className="text-[11px] text-emerald-700 dark:text-emerald-400">Recovered at {saveRate}%</div><div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{fmt(saved)}</div></div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">As of {value.as_of}. Expected loss = churn probability × {h.value_column}, summed over the tier.</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No revenue column was selected, so value at risk can’t be sized. Re-run with a revenue / ARR column to see it.</p>
              )}
            </Card>
          </div>

          <Card title="Who to call first" subtitle={`Top 25 accounts by ${hasValue ? "expected value at risk" : "churn probability"}, with the main reasons`}>
            <Table
              head={["Account", "Probability", "Tier", ...(hasValue ? [h.value_column, "At risk"] : []), "Main risk drivers"]}
              rows={value.top_accounts.map((a: any) => [
                a.entity, fmt(a.probability, { pct: true, digits: 0 }),
                <span key="t" style={{ color: TIER_COLOR[a.tier] }} className="font-semibold">{a.tier}</span>,
                ...(hasValue ? [fmt(a.value), fmt(a.expected_loss)] : []),
                <span key="d" className="text-muted-foreground">{(a.drivers ?? []).map(label).join(" · ") || "—"}</span>,
              ])}
            />
          </Card>

          {nar?.actions?.length > 0 && (
            <Card title="Recommended retention actions" subtitle="Tied to the strongest drivers found">
              <ul className="space-y-2.5">
                {nar.actions.map((a: any, i: number) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-brand/10 text-brand text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div><span className="font-semibold text-foreground">{a.driver}</span><span className="text-muted-foreground"> — {a.action}</span></div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "Drivers" && (
        <div className="space-y-4">
          {r.explain && (
            <Card title="What moves churn risk" subtitle={r.explain.importance_method}>
              <div style={{ height: Math.max(220, r.explain.top_features.slice(0, 12).length * 28) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.explain.top_features.slice(0, 12).map((t: any) => ({ ...t, name: label(t.feature) }))} layout="vertical" margin={{ left: 10, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                    <Tooltip {...TT} formatter={(v: number, _n: string, p: any) => [v.toFixed(4), p.payload.direction]} />
                    <Bar dataKey="importance" fill={BRAND} radius={[0, 6, 6, 0]} name="AUC drop" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table head={["Feature", "Direction"]} rows={r.explain.top_features.slice(0, 8).map((t: any) => [label(t.feature), t.direction])} />
            </Card>
          )}
          {r.hypotheses && (
            <Card title={`Hypotheses tested — ${r.hypotheses.supported} of ${r.hypotheses.total} supported`} subtitle={`${r.hypotheses.correction}. Tested on ${r.hypotheses.tested_on_rows.toLocaleString()} rows${r.hypotheses.one_row_per_entity ? " (one row per account, so repeated snapshots don't inflate significance)" : ""}.`}>
              <Table
                head={["Hypothesis", "Verdict", "Effect", "q-value", "Churn: high vs low"]}
                rows={r.hypotheses.hypotheses.map((x: any) => [
                  x.statement, <Verdict key="v" v={x.verdict} />, x.effect_label, x.q_value < 0.001 ? "<0.001" : x.q_value.toFixed(3),
                  x.churn_rate_high != null && x.churn_rate_low != null ? `${fmt(x.churn_rate_high, { pct: true })} vs ${fmt(x.churn_rate_low, { pct: true })}` : "—",
                ])}
              />
            </Card>
          )}
        </div>
      )}

      {tab === "Data & patterns" && r.eda && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {r.eda.churn_by_date && (
              <Card title="Churn rate over time" subtitle={`Base rate ${fmt(r.eda.base_rate, { pct: true })}`}>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={r.eda.churn_by_date} margin={{ left: 0, right: 12 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip {...TT} formatter={(v: number) => fmt(v, { pct: true })} />
                      <Line type="monotone" dataKey="rate" stroke={BRAND} strokeWidth={2} dot={{ r: 2 }} name="Churn rate" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            {r.eda.segments?.length > 0 && (
              <Card title="Where churn concentrates" subtitle="Segments furthest from the average rate">
                <Table
                  head={["Segment", "Accounts/rows", "Churn rate", "vs average"]}
                  rows={r.eda.segments.slice(0, 8).map((s: any) => [
                    `${s.dimension}: ${s.group}`, s.n.toLocaleString(), fmt(s.churn_rate, { pct: true }),
                    <span key="l" className={cn("font-semibold", s.lift > 1 ? "text-red-500" : "text-emerald-600")}>{s.lift.toFixed(1)}×</span>,
                  ])}
                />
              </Card>
            )}
          </div>
          {r.eda.driver_bins?.length > 0 && (
            <Card title="Churn rate by driver level" subtitle="Each driver split into five equal-sized groups, low → high">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {r.eda.driver_bins.slice(0, 6).map((d: any) => (
                  <div key={d.feature}>
                    <div className="text-xs font-medium text-foreground mb-1">{label(d.feature)}</div>
                    <div className="h-28">
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
          {r.understand && (
            <Card title="Data profile">
              <Table
                head={["Item", "Value"]}
                rows={[
                  ["Rows × columns", `${r.understand.rows.toLocaleString()} × ${r.understand.columns}`],
                  ["Accounts", `${r.understand.entities.toLocaleString()}${r.understand.is_panel ? ` (panel: ~${r.understand.rows_per_entity_median.toFixed(0)} snapshots each)` : ""}`],
                  ["Period", r.understand.date_min ? `${r.understand.date_min} → ${r.understand.date_max}` : "—"],
                  ["Churned rows", `${r.understand.positives.toLocaleString()} (${fmt(r.understand.churn_rate, { pct: true })})`],
                  ["Data quality score", r.understand.quality ? `${r.understand.quality.overall}/100` : "—"],
                  ["Features", r.features ? `${r.features.base_features} original + ${r.features.created_count} engineered → ${r.select?.selected} selected` : "—"],
                ]}
              />
            </Card>
          )}
        </div>
      )}

      {tab === "Models" && r.models && (
        <div className="space-y-4">
          <Card title="Model comparison" subtitle={`Chosen on ${r.models.selection_metric}; judged on accounts held out from training (${r.select?.split?.holdout_entities?.toLocaleString()} accounts)`}>
            <Table
              head={["Model", "CV PR-AUC", "Holdout AUC", "Holdout PR-AUC", "Top-10% lift", "Recall @ top 10%", "Time"]}
              rows={r.models.leaderboard.filter((b: any) => b.holdout).map((b: any) => [
                <span key="m" className={cn(b.selected && "font-semibold text-brand")}>{b.model}{b.selected ? " ✓ selected" : ""}{b.baseline ? " (naive baseline)" : ""}</span>,
                b.cv ? b.cv.pr_auc.toFixed(3) : "—", b.holdout.roc_auc?.toFixed(3) ?? "—", b.holdout.pr_auc?.toFixed(3) ?? "—",
                b.holdout.lift_top10 ? `${b.holdout.lift_top10.toFixed(1)}×` : "—", fmt(b.holdout.recall_top10, { pct: true, digits: 0 }), `${b.train_seconds ?? 0}s`,
              ])}
            />
          </Card>
          <div className="grid lg:grid-cols-2 gap-4">
            {value?.gain_table && (
              <Card title="Gain: how quickly we find churners" subtitle="Accounts ranked by risk, in deciles — on unseen accounts">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={value.gain_table}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="decile" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip {...TT} formatter={(v: number) => fmt(v, { pct: true })} labelFormatter={(d) => `Decile ${d} (1 = riskiest)`} />
                      <Area type="monotone" dataKey="cum_capture" stroke={BRAND} fill={BRAND} fillOpacity={0.12} name="Churners captured (cumulative)" />
                      <Bar dataKey="churn_rate" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Churn rate in decile" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            <Card title="Are the probabilities trustworthy?" subtitle={`Calibration error ${r.models.calibration.ece_before.toFixed(3)} → ${r.models.calibration.ece_after.toFixed(3)} after calibration`}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r.models.calibration.bins} margin={{ left: 0, right: 12 }}>
                    <CartesianGrid stroke="hsl(var(--border))" />
                    <XAxis dataKey="predicted" type="number" domain={[0, "auto"]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: MUTED }} label={{ value: "Predicted", position: "insideBottom", offset: -2, fontSize: 11, fill: MUTED }} />
                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: MUTED }} width={40} />
                    <Tooltip {...TT} formatter={(v: number) => fmt(v, { pct: true })} />
                    <Line type="monotone" dataKey="observed" stroke={BRAND} strokeWidth={2} dot name="Observed churn" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">Points on the diagonal mean “a 20% score really churns about 20% of the time”.</p>
            </Card>
          </div>
          {r.select && (
            <Card title="How the data was prepared" subtitle={`${r.select.split.kind} split · ${r.select.split.train_rows.toLocaleString()} training rows / ${r.select.split.holdout_rows.toLocaleString()} holdout rows`}>
              <Table head={["Step", "Result"]} rows={[
                ["Feature engineering", r.features ? `${r.features.created_count} new features (${Object.entries(r.features.kinds).map(([k, v]) => `${v} ${k}`).join(", ") || "none needed"})` : "—"],
                ["Feature selection", `${r.select.selected} of ${r.select.start_features} kept — dropped: ${Object.entries(r.select.dropped_by_reason).map(([k, v]) => `${v} ${k}`).join(", ")}`],
                ["Operating point", `Flag at probability ≥ ${r.models.operating_point.threshold.toFixed(2)} → precision ${fmt(r.models.operating_point.precision, { pct: true, digits: 0 })}, recall ${fmt(r.models.operating_point.recall, { pct: true, digits: 0 })} (threshold set on training data only)`],
              ]} />
            </Card>
          )}
        </div>
      )}

      {tab === "Trust checks" && (
        <div className="space-y-4">
          {r.validate && (
            <Card title={`Validation — ${r.validate.passed} of ${r.validate.total} checks passed`}>
              <ul className="divide-y divide-border">
                {r.validate.checks.map((c: any, i: number) => (
                  <li key={i} className="flex gap-3 py-2.5">
                    {c.status === "pass" ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      : c.status === "warn" ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                    <div><div className="text-sm font-medium text-foreground">{c.check}</div><div className="text-xs text-muted-foreground">{c.detail}</div></div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {r.leakage && (
            <Card title="Data leakage audit" subtitle="Columns that contain information from after the outcome make a model look perfect and fail in production">
              {r.leakage.excluded.length === 0 ? <p className="text-sm text-muted-foreground">No leaking columns found.</p> : (
                <Table head={["Excluded column", "Why"]} rows={r.leakage.excluded.map((e: any) => [<code key="c" className="text-xs">{e.feature}</code>, e.reason])} />
              )}
              {r.models?.quarantined?.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-foreground mb-1.5">Quarantined — the first model was implausibly accurate</div>
                  <Table head={["Feature", "Why"]} rows={r.models.quarantined.map((q: any) => [<code key="c" className="text-xs">{q.feature}</code>, q.reason])} />
                </div>
              )}
              {r.leakage.warnings.length > 0 && (
                <div className="mt-3 space-y-1">{r.leakage.warnings.map((w: any, i: number) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">⚠ {w.feature}: {w.note}</div>)}</div>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "Deliverables" && r.build && (
        <div className="space-y-4">
          <Card title="Download" subtitle="The enriched file keeps every original row and column in the original order, and appends the ds_ columns below">
            <div className="flex flex-wrap gap-2">
              {run.files.enriched && <><DlBtn icon={<Download className="w-3.5 h-3.5" />} text="Enriched data (.csv)" onClick={() => download("enriched", "csv")} primary />
                <DlBtn icon={<FileSpreadsheet className="w-3.5 h-3.5" />} text="Enriched (.xlsx)" onClick={() => download("enriched", "xlsx")} /></>}
              {run.files.accounts && <DlBtn icon={<Users className="w-3.5 h-3.5" />} text="One row per account (.csv)" onClick={() => download("accounts", "csv")} />}
              {run.files.dictionary && <DlBtn icon={<FileText className="w-3.5 h-3.5" />} text="Data dictionary (.csv)" onClick={() => download("dictionary", "csv")} />}
              {run.markdown && <><DlBtn icon={<FileText className="w-3.5 h-3.5" />} text="Board report (.docx)" onClick={() => download("report", "docx")} />
                <DlBtn icon={<FileText className="w-3.5 h-3.5" />} text="Report (.md)" onClick={() => download("report", "md")} /></>}
              {run.files.model && <DlBtn icon={<Download className="w-3.5 h-3.5" />} text="Trained model (.joblib)" onClick={() => download("model", "csv")} />}
            </div>
            <div className={cn("mt-4 text-xs rounded-lg px-3 py-2 flex items-center gap-2",
              r.build.integrity.ok ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 text-red-700")}>
              {r.build.integrity.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {r.build.integrity.ok
                ? `Format check passed: ${r.build.enriched_rows.toLocaleString()} rows preserved, original columns and values unchanged, ${r.build.integrity.added_columns} columns added.`
                : "Format check failed — the original data was altered. Do not use this file."}
            </div>
          </Card>
          <Card title="Data dictionary" subtitle="Give this to whoever queries the data — a person, a BI tool or an LLM">
            <Table head={["Column", "Type", "Meaning"]} rows={r.build.dictionary.map((d: any) => [<code key="c" className="text-xs">{d.column}</code>, d.type, d.description])} />
          </Card>
        </div>
      )}

      {tab === "Full report" && (
        <Card>
          {run.markdown ? <Markdown content={run.markdown} /> : <p className="text-sm text-muted-foreground">The report is written when the flow finishes.</p>}
        </Card>
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
