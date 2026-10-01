"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Download, FileText, Loader2, Send, Sparkles, Users, X } from "lucide-react";
import { dsFlowsApi } from "@/lib/api";
import { Markdown } from "@/components/shared/Markdown";
import { fmt, label } from "@/components/ds-flows/ChurnResults";
import type { FlowRunFull } from "@/components/ds-flows/FlowWorkspace";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* Executive view of a churn run: who is likely to churn, how many, why, and how to keep them — with filters that
   recalculate everything, a customer deep dive, and a chat. No model vocabulary on purpose: the technical detail lives
   in the Analysis view. */

// JMAN palette (template slide 51): berry / emerald for bad / good, amethyst for the middle, turquoise + light blue for series
const HIGH = "#A62660";
const MED = "#A16BDB";
const LOW = "#16978E";
const ACCENT = "#3411A3";
const ROSE = "#26D4F0";
const SOFT = "#71EAE1";
const AX = { fontSize: 11, fill: "#8683A8" };
const GRID = "rgba(25,16,91,0.10)";
const TT = { contentStyle: { background: "var(--card)", border: "1px solid var(--card-line)", borderRadius: 0, fontSize: 12, color: "var(--ink)" } };
const TIER_COLOR: Record<string, string> = { High: HIGH, Medium: MED, Low: LOW };
const TABS = ["Overview", "Customers", "Why they churn", "How to retain", "Ask", "Definitions"] as const;
const FILTER_TABS = ["Overview", "Customers", "How to retain"];
const SUGGESTIONS = [
  "Who should we call first, and why?",
  "Why are customers churning?",
  "Which customer groups are most at risk?",
  "What would saving a quarter of the high-risk revenue be worth?",
  "How can we keep the high-risk customers?",
];

const pct = (x: number | null | undefined, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);

const FRIENDLY: [RegExp, string][] = [
  [/suggested_leave/, "Said they may leave"], [/desire_to_cancel/, "Wanted to cancel"], [/auto_renew/, "Auto-renewal status"],
  [/accreditation/, "Accreditation progress"], [/engagement/, "Engagement"], [/last_years_price|last_year_price/, "Previous-year price"],
  [/discount/, "Discount level"], [/score_at_release/, "Renewal likelihood score"], [/anchoring/, "Anchoring"],
  [/registration/, "Time since registration"], [/membership_net|gross/, "Membership value"], [/proforma_account_stage/, "Account stage"], [/tenure/, "Tenure"],
];
const nice = (f: string) => FRIENDLY.find(([rx]) => rx.test(f.toLowerCase()))?.[1] ?? label(f);

const RULES: { rx: RegExp; reason: string; action: string }[] = [
  { rx: /suggested_leave|desire_to_cancel|switch|competitor/, reason: "Told us they may leave", action: "Senior owner calls before renewal to understand the issue and fix it" },
  { rx: /auto_renew/, reason: "Not set up for auto-renewal", action: "Move to auto-renewal and confirm the payment method" },
  { rx: /accreditation|engagement/, reason: "Stalled accreditation / low engagement", action: "Follow up on progress and assign a success contact" },
  { rx: /complain|dissatisf|negative/, reason: "Unresolved complaints", action: "Resolve open issues before the renewal conversation" },
  { rx: /discount/, reason: "Heavy discount on the renewal", action: "Review the offer; show the value delivered before discounting further" },
  { rx: /price|amount|gross|net|fee/, reason: "Price sensitivity", action: "Review pricing and packaging with the account owner" },
  { rx: /score_at_release|renewal_score|tenure|registration|anchor/, reason: "Weak renewal indicators", action: "Account review: confirm usage, value and renewal intent" },
];
function reasonsFor(drivers: string[]) {
  const out: { reason: string; action: string }[] = [];
  for (const d of drivers ?? []) {
    const feat = d.split(" = ")[0];
    const r = RULES.find((x) => x.rx.test(feat.toLowerCase())) ?? { reason: nice(feat), action: "Review the account with its owner" };
    if (!out.some((o) => o.reason === r.reason)) out.push(r);
  }
  return out.slice(0, 3);
}
const driverText = (d: string) => {
  const m = d.match(/^(.*?) = (.*)$/);
  if (!m) return nice(d);
  const binary = m[2] === "0" || m[2] === "1" || m[1].endsWith("__missing") || m[1].includes("=");
  return binary ? nice(m[1]) : `${nice(m[1])}: ${m[2]}`;
};

type Cust = { id: string; prob: number; tier: string; value: number | null; loss: number | null; drivers: string[]; due: string | null; seg: Record<string, string>; reasons: { reason: string; action: string }[] };

function Spark({ data, color }: { data: any[]; color: string }) {
  return (
    <div style={{ height: 44, marginTop: 10 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs><linearGradient id="spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="rate" stroke={color} strokeWidth={2} fill="url(#spark)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ title, value, chip, tone = "neutral", neg, children, delay = 0 }: { title: string; value: string; chip?: string; tone?: string; neg?: boolean; children?: React.ReactNode; delay?: number }) {
  return (
    <div className="jd-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="t">{title}</div>
      <div className={`v ${neg ? "neg" : ""}`}>{value}</div>
      {chip && <span className={`jd-chip ${tone}`}>{chip}</span>}
      {children}
    </div>
  );
}

function Panel({ title, sub, children, right }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="jd-panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div><h2>{title}</h2>{sub && <p className="sub">{sub}</p>}</div>{right}
      </div>
      {children}
    </div>
  );
}

function RiskBar({ p, tier }: { p: number; tier: string }) {
  return (
    <>
      <div className="jd-bar"><i style={{ width: `${Math.round(p * 100)}%`, background: TIER_COLOR[tier] }} /></div>
      <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 3 }}>{pct(p)}</div>
    </>
  );
}

export function ChurnDashboard({ run, workspaceId, onAnalysis }: { run: FlowRunFull; workspaceId: string; onAnalysis: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [tier, setTier] = useState("All");
  const [reason, setReason] = useState("All");
  const [segKey, setSegKey] = useState("");
  const [segVal, setSegVal] = useState("All");
  const [minRev, setMinRev] = useState("");
  const [q, setQ] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [shown, setShown] = useState(25);
  const [sort, setSort] = useState<{ key: "prob" | "value" | "loss"; dir: 1 | -1 }>({ key: "loss", dir: -1 });
  const [save, setSave] = useState(25);
  const [open, setOpen] = useState<Cust | null>(null);
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const R = run.results ?? {};
  const H = run.headline ?? {};
  const value = R.value;
  const eda = R.eda;
  const valueCol: string | null = value?.value_column ?? null;
  const hasValue = !!valueCol;
  const total: number = value?.accounts_scored ?? 0;
  const churnRate: number | null = eda?.base_rate ?? R.understand?.churn_rate ?? null;
  const asOf = value?.as_of ? String(value.as_of).slice(0, 10) : null;
  const trend = (eda?.churn_by_date ?? []).map((d: any) => ({ date: String(d.date).slice(0, 7), rate: d.rate }));

  // every scored customer, from the server
  const { data: raw, isLoading: loadingCust } = useQuery({
    queryKey: ["ds-flow-customers", workspaceId, run.id],
    queryFn: () => dsFlowsApi.customers(workspaceId, run.id),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const { all, segCols } = useMemo(() => {
    if (raw) {
      const ix = Object.fromEntries(raw.columns.map((c, i) => [c, i]));
      const fixed = new Set(["account", "as_of_snapshot", "churn_probability", "risk_tier", "expected_value_at_risk", "driver_1", "driver_2", "driver_3", valueCol ?? "__none__"]);
      const segs = raw.columns.filter((c) => !fixed.has(c));
      const list: Cust[] = raw.rows.map((r) => {
        const drivers = ["driver_1", "driver_2", "driver_3"].map((k) => r[ix[k]]).filter((x) => typeof x === "string" && x);
        return {
          id: String(r[ix.account]), prob: Number(r[ix.churn_probability]), tier: String(r[ix.risk_tier]),
          value: valueCol && r[ix[valueCol]] != null ? Number(r[ix[valueCol]]) : null,
          loss: r[ix.expected_value_at_risk] != null ? Number(r[ix.expected_value_at_risk]) : null,
          drivers, due: ix.as_of_snapshot != null && r[ix.as_of_snapshot] ? String(r[ix.as_of_snapshot]).slice(0, 10) : null,
          seg: Object.fromEntries(segs.map((s) => [s, r[ix[s]] ?? ""])), reasons: reasonsFor(drivers),
        };
      });
      const ds = list.map((c) => c.due).filter(Boolean).sort() as string[];
      if (ds.length) {
        const mid = new Date(ds[Math.floor(ds.length / 2)] + "T00:00:00Z").getTime();
        const span = 3 * 365 * 864e5;
        for (const c of list) if (c.due && Math.abs(new Date(c.due + "T00:00:00Z").getTime() - mid) > span) c.due = null;
      }
      return { all: list, segCols: segs };
    }
    // fallback: the top customers kept in the run results
    const list: Cust[] = (value?.top_accounts ?? []).map((a: any) => ({
      id: String(a.entity), prob: a.probability, tier: a.tier, value: a.value ?? null, loss: a.expected_loss ?? null,
      drivers: a.drivers ?? [], due: null, seg: {}, reasons: reasonsFor(a.drivers ?? []),
    }));
    return { all: list, segCols: [] as string[] };
  }, [raw, value, valueCol]);

  const activeSeg = segKey || segCols[0] || "";
  const segValues = useMemo(() => Array.from(new Set(all.map((c) => c.seg[activeSeg]).filter(Boolean))).sort(), [all, activeSeg]);
  const reasonList = useMemo(() => Array.from(new Set(all.flatMap((c) => c.reasons.map((r) => r.reason)))).sort(), [all]);
  const filtersActive = tier !== "All" || reason !== "All" || segVal !== "All" || !!minRev || !!q.trim() || !!dueFrom || !!dueTo;

  const filtered = useMemo(() => {
    const min = minRev ? Number(minRev) : null;
    const ql = q.trim().toLowerCase();
    return all.filter((c) =>
      (tier === "All" || c.tier === tier) &&
      (reason === "All" || c.reasons.some((r) => r.reason === reason)) &&
      (segVal === "All" || c.seg[activeSeg] === segVal) &&
      (min == null || (c.value ?? 0) >= min) &&
      (!dueFrom || (!!c.due && c.due >= dueFrom)) && (!dueTo || (!!c.due && c.due <= dueTo)) &&
      (!ql || c.id.toLowerCase().includes(ql)));
  }, [all, tier, reason, segVal, activeSeg, minRev, q, dueFrom, dueTo]);

  // headline numbers follow the filters
  const M = useMemo(() => {
    const by = (t: string) => filtered.filter((c) => c.tier === t);
    const sum = (xs: Cust[], k: "value" | "loss") => xs.reduce((s, c) => s + (c[k] ?? 0), 0);
    const h = by("High"), m = by("Medium"), l = by("Low");
    return {
      n: filtered.length, expected: Math.round(filtered.reduce((s, c) => s + c.prob, 0)),
      high: h.length, med: m.length, low: l.length,
      revenue: sum(filtered, "value"), loss: sum(filtered, "loss"), highValue: sum(h, "value"), highLoss: sum(h, "loss"),
      tiers: [["High", h], ["Medium", m], ["Low", l]].map(([t, xs]: any) => ({ tier: t, "Revenue held": sum(xs, "value"), "Expected to be lost": sum(xs, "loss") })),
    };
  }, [filtered]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) * sort.dir), [filtered, sort]);
  const byReason = useMemo(() => {
    const m = new Map<string, { reason: string; action: string; n: number; revenue: number; loss: number }>();
    for (const c of filtered) {
      if (!c.reasons.length) continue;
      const r = c.reasons[0];
      const e = m.get(r.reason) ?? { reason: r.reason, action: r.action, n: 0, revenue: 0, loss: 0 };
      e.n += 1; e.revenue += c.value ?? 0; e.loss += c.loss ?? 0;
      m.set(r.reason, e);
    }
    return Array.from(m.values()).sort((a, b) => b.loss - a.loss);
  }, [filtered]);

  // renewal window: presets count forward from today (or from the first due date when all dates are in the past)
  const dues = useMemo(() => all.map((c) => c.due).filter(Boolean).sort() as string[], [all]);
  const hasDates = dues.length > 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  const base = asOf ?? todayIso;
  const anchor = dues.find((d) => d >= base) ?? dues[0] ?? base;
  const addMonths = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
  const setWindow = (months: number) => { setDueFrom(anchor); setDueTo(addMonths(anchor, months)); };
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; Customers: number; "Expected to churn": number; "Revenue at risk": number }>();
    for (const c of filtered) {
      if (!c.due) continue;
      const k = c.due.slice(0, 7);
      const e = m.get(k) ?? { month: k, Customers: 0, "Expected to churn": 0, "Revenue at risk": 0 };
      e.Customers += 1; e["Expected to churn"] += c.prob; e["Revenue at risk"] += c.loss ?? 0;
      m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => a.month.localeCompare(b.month)).map((e) => ({ ...e, "Expected to churn": Math.round(e["Expected to churn"]) }));
  }, [filtered]);
  const pickMonth = (k: string) => { setDueFrom(`${k}-01`); setDueTo(addMonths(`${k}-01`, 1)); };
  const windowText = dueFrom || dueTo ? ` renewing ${dueFrom ? "from " + dueFrom : ""}${dueTo ? " to " + dueTo : ""}` : "";

  const signs = (R.explain?.top_features ?? []).slice(0, 7).map((t: any) => ({ name: nice(t.feature), impact: t.importance, direction: t.direction as string }));
  const maxImpact = Math.max(...signs.map((s: any) => s.impact), 0.0001);
  const pairs = (R.hypotheses?.hypotheses ?? [])
    .filter((h: any) => h.verdict === "supported" && h.test === "Mann-Whitney U" && h.churn_rate_high != null && h.churn_rate_low != null)
    .slice(0, 6).map((h: any) => ({ name: nice(h.feature), "Below average": h.churn_rate_low, "Above average": h.churn_rate_high }));
  const segments = (eda?.segments ?? []).filter((s: any) => (s.lift ?? 0) > 1).slice(0, 8);
  const topSigns = signs.slice(0, 3).map((s: any) => s.name);
  const donut = [{ name: "High risk", value: M.high, c: HIGH }, { name: "Medium risk", value: M.med, c: MED }, { name: "Low risk", value: M.low, c: LOW }];
  const recovered = M.highLoss * save / 100;

  const risePct = (c: Cust) => (all.length ? all.filter((x) => x.prob < c.prob).length / all.length : null);
  const medianValue = useMemo(() => { const v = all.map((c) => c.value ?? 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; }, [all]);

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
  const exportFiltered = () => {
    const head = ["Customer", "Chance of churning", "Risk level", hasValue ? "Revenue" : "", hasValue ? "Expected loss" : "", "Renewal due", "Reasons", "Suggested action", ...segCols].filter(Boolean);
    const rows = sorted.map((c) => [c.id, (c.prob * 100).toFixed(1) + "%", c.tier, ...(hasValue ? [c.value ?? "", c.loss != null ? Math.round(c.loss) : ""] : []), c.due ?? "", c.reasons.map((r) => r.reason).join("; "), c.reasons[0]?.action ?? "", ...segCols.map((s) => c.seg[s] ?? "")]);
    const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "customers_filtered.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const resetFilters = () => { setDueFrom(""); setDueTo(""); setTier("All"); setReason("All"); setSegVal("All"); setMinRev(""); setQ(""); setShown(25); };

  const ask = async (text: string) => {
    const message = text.trim();
    if (!message || thinking) return;
    const history = msgs;
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setDraft("");
    setThinking(true);
    try {
      const { answer } = await dsFlowsApi.chat(workspaceId, run.id, message, history);
      setMsgs((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setMsgs((m) => [...m, { role: "assistant", content: typeof d === "string" ? d : "Sorry — I couldn't answer that just now. Please try again." }]);
    } finally {
      setThinking(false);
    }
  };
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, thinking]);
  useEffect(() => { setShown(25); }, [tier, reason, segVal, minRev, q, dueFrom, dueTo, sort]);

  const askAbout = (c: Cust) => { setOpen(null); setTab("Ask"); setDraft(`Tell me about customer ${c.id} and what we should do to keep them.`); };
  const Row = ({ c }: { c: Cust }) => (
    <tr key={c.id} onClick={() => setOpen(c)} style={{ cursor: "pointer" }}>
      <td style={{ fontWeight: 700 }}>{c.id}</td>
      <td style={{ minWidth: 100 }}><RiskBar p={c.prob} tier={c.tier} /></td>
      <td><span className={`jd-tag ${c.tier.toLowerCase()}`}>{c.tier}</span></td>
      {hasValue && <td className="num">{fmt(c.value)}</td>}
      {hasValue && <td className="num" style={{ fontWeight: 700 }}>{fmt(c.loss)}</td>}
      <td>{c.reasons.length ? c.reasons.map((r) => <span key={r.reason} className="jd-why">{r.reason}</span>) : <span className="jd-why">Several factors</span>}</td>
      <td style={{ maxWidth: 260 }}>{c.reasons[0]?.action ?? "Review the account with its owner"}</td>
    </tr>
  );
  const SortTh = ({ k, children }: { k: "prob" | "value" | "loss"; children: React.ReactNode }) => (
    <th className={k === "prob" ? "" : "num"} style={{ cursor: "pointer" }} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {children}{sort.key === k ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="jm-dash">
      <div className="jd-top">
        <div>
          <h1>Customer Churn Outlook</h1>
          <p>{total.toLocaleString()} customers due for renewal{asOf ? ` · data as of ${asOf}` : ""}</p>
        </div>
        <div className="jd-actions">
          {run.files.accounts && <button className="jd-btn" onClick={() => download("accounts", "csv")}><Users size={14} /> Customer list</button>}
          {run.markdown && <button className="jd-btn" onClick={() => download("report", "docx")}><FileText size={14} /> Report</button>}
          <button className="jd-btn" onClick={() => { setTab("Ask"); }}><Sparkles size={14} /> Ask</button>
          <button className="jd-btn" onClick={onAnalysis}><BarChart3 size={14} /> Analysis details</button>
        </div>
      </div>

      <div className="jd-tabs">
        {TABS.map((t) => <button key={t} className={`jd-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}><span className="ti" />{t}</button>)}
      </div>

      <div className="jd-layout">
        <div className="jd-main">
          {FILTER_TABS.includes(tab) && filtersActive && (
            <div className="jd-chip warn" style={{ alignSelf: "flex-start", margin: 0 }}>
              Filtered: {M.n.toLocaleString()} of {all.length.toLocaleString()} customers
              <button onClick={resetFilters} style={{ marginLeft: 10, textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}>Clear</button>
            </div>
          )}
          {loadingCust && FILTER_TABS.includes(tab) && <div className="jd-note" style={{ marginTop: 0 }}><Loader2 size={12} className="animate-spin" style={{ display: "inline", marginRight: 6 }} />Loading all customers…</div>}

          {tab === "Overview" && (
            <>
              <Panel title="The headline">
                <p className="jd-lead">
                  {filtersActive ? <>For the selected customers{windowText}, about </> : <>About </>}<b>{M.expected.toLocaleString()}</b> of the <b>{M.n.toLocaleString()}</b> customers due for renewal are expected to churn
                  {hasValue ? <>, putting roughly <b>{fmt(M.loss)}</b> of revenue at risk</> : null}.
                  {M.high ? <> <b>{M.high.toLocaleString()}</b> are high-risk{hasValue ? <> and hold <b>{fmt(M.highValue)}</b> of revenue</> : null}.</> : null}
                  {topSigns.length ? <> The strongest warning signs are {topSigns.join(", ")}.</> : null}
                </p>
              </Panel>

              <div className="jd-kpis">
                <Kpi title="Likely to churn" value={M.expected.toLocaleString()} chip={`${pct(M.n ? M.expected / M.n : null, 1)} of renewals`} tone="neg" neg />
                <Kpi title="High-risk customers" value={M.high.toLocaleString()} chip="need action now" tone="warn" delay={60} />
                {hasValue && <Kpi title="Revenue at risk" value={fmt(M.loss)} chip="expected loss" tone="neg" neg delay={120} />}
                {hasValue && <Kpi title="Revenue in high-risk accounts" value={fmt(M.highValue)} chip={`${pct(M.revenue ? M.highValue / M.revenue : null)} of renewal revenue`} tone="warn" delay={180} />}
                <Kpi title="Usual churn rate" value={pct(churnRate, 1)} chip="of past renewals" tone="neutral" delay={240}>{trend.length > 2 && <Spark data={trend} color={ACCENT} />}</Kpi>
              </div>

              <div className="jd-two">
                <Panel title="Customers by risk level" sub="Click a slice's level in the filters to focus on it">
                  <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                    <div style={{ width: 190, height: 190, position: "relative" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donut} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none" onClick={(d: any) => setTier(String(d?.name).split(" ")[0])} style={{ cursor: "pointer" }}>
                            {donut.map((d) => <Cell key={d.name} fill={d.c} />)}
                          </Pie>
                          <Tooltip {...TT} formatter={(v: number) => v.toLocaleString()} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>{M.n.toLocaleString()}</div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>customers</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      {donut.map((d) => (
                        <div key={d.name} onClick={() => setTier(d.name.split(" ")[0])} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--card-line)", fontSize: 13, cursor: "pointer" }}>
                          <i style={{ width: 10, height: 10, borderRadius: 3, background: d.c }} /><span style={{ flex: 1 }}>{d.name}</span>
                          <b>{d.value.toLocaleString()}</b><span style={{ color: "var(--ink-faint)", width: 44, textAlign: "right" }}>{pct(M.n ? d.value / M.n : null)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
                {hasValue && (
                  <Panel title="Revenue by risk level" sub="What each group is worth, and how much we expect to lose">
                    <div style={{ height: 230 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={M.tiers} barGap={6}>
                          <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="tier" tick={AX} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={(v) => fmt(v)} tick={AX} axisLine={false} tickLine={false} width={48} />
                          <Tooltip {...TT} formatter={(v: number) => fmt(v)} />
                          <Bar dataKey="Revenue held" fill={SOFT} radius={0} /><Bar dataKey="Expected to be lost" fill={HIGH} radius={0} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                )}
              </div>

              {monthly.length > 1 && (
                <Panel title="Expected churn by renewal month" sub="Customers expected to leave in each month their renewal falls due — click a bar to focus on that month">
                  <div style={{ height: 230 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} onClick={(e: any) => e?.activeLabel && pickMonth(e.activeLabel)} style={{ cursor: "pointer" }}>
                        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="month" tick={AX} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="l" tick={AX} axisLine={false} tickLine={false} width={40} />
                        {hasValue && <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => fmt(v)} tick={AX} axisLine={false} tickLine={false} width={48} />}
                        <Tooltip {...TT} formatter={(v: number, n: string) => (n === "Revenue at risk" ? fmt(v) : v.toLocaleString())} />
                        <Bar yAxisId="l" dataKey="Expected to churn" fill={ACCENT} radius={0} />
                        {hasValue && <Bar yAxisId="r" dataKey="Revenue at risk" fill={SOFT} radius={0} />}
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              )}

              <div className="jd-two">
                {trend.length > 2 && (
                  <Panel title="Churn rate over time" sub="Share of past renewals that churned, by period (all customers)">
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend}>
                          <defs><linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} /><stop offset="100%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="date" tick={AX} axisLine={false} tickLine={false} minTickGap={36} />
                          <YAxis tickFormatter={(v) => pct(v)} tick={AX} axisLine={false} tickLine={false} width={40} />
                          <Tooltip {...TT} formatter={(v: number) => pct(v, 1)} /><Area type="monotone" dataKey="rate" name="Churn rate" stroke={ACCENT} strokeWidth={2.5} fill="url(#trendfill)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                )}
                <Panel title="Customers to save first" sub="Highest expected revenue loss — click one for details" right={<button className="jd-reset" style={{ width: "auto", padding: "4px 10px" }} onClick={() => setTab("Customers")}>See all</button>}>
                  <table className="jd-table">
                    <tbody>
                      {[...filtered].sort((a, b) => (b.loss ?? b.prob) - (a.loss ?? a.prob)).slice(0, 5).map((c) => (
                        <tr key={c.id} onClick={() => setOpen(c)} style={{ cursor: "pointer" }}>
                          <td style={{ fontWeight: 700 }}>{c.id}</td>
                          <td style={{ width: 90 }}><RiskBar p={c.prob} tier={c.tier} /></td>
                          <td>{c.reasons[0]?.reason ?? "Several factors"}</td>
                          {hasValue && <td className="num" style={{ fontWeight: 700 }}>{fmt(c.loss)}</td>}
                        </tr>
                      ))}
                      {!filtered.length && <tr><td style={{ textAlign: "center", color: "var(--ink-faint)", padding: 20 }}>No customers match these filters.</td></tr>}
                    </tbody>
                  </table>
                </Panel>
              </div>
            </>
          )}

          {tab === "Customers" && (
            <Panel title="Customers" sub={`${filtered.length.toLocaleString()} customers — click a row for a deep dive, click a column to sort`}
              right={<button className="jd-reset" style={{ width: "auto", padding: "6px 12px", display: "inline-flex", gap: 6, alignItems: "center" }} onClick={exportFiltered}><Download size={13} /> Export these</button>}>
              <div style={{ overflowX: "auto" }}>
                <table className="jd-table">
                  <thead><tr><th>Customer</th><SortTh k="prob">Risk</SortTh><th>Level</th>{hasValue && <SortTh k="value">Revenue</SortTh>}{hasValue && <SortTh k="loss">Expected loss</SortTh>}<th>Why</th><th>Suggested action</th></tr></thead>
                  <tbody>
                    {sorted.slice(0, shown).map((c) => <Row key={c.id} c={c} />)}
                    {!sorted.length && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--ink-faint)" }}>No customers match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              {sorted.length > shown && <button className="jd-reset" style={{ marginTop: 12 }} onClick={() => setShown((s) => s + 50)}>Show 50 more ({(sorted.length - shown).toLocaleString()} left)</button>}
              <p className="jd-note">Reasons and suggested actions are shown for the customers with the strongest warning signs.</p>
            </Panel>
          )}

          {tab === "Why they churn" && (
            <>
              <div className="jd-two">
                <Panel title="Biggest warning signs" sub="The customer characteristics most strongly linked with leaving">
                  {signs.map((s: any) => (
                    <div key={s.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <b>{s.name}</b><span style={{ color: "var(--ink-soft)" }}>{s.direction?.startsWith("lower") ? "Lower → higher risk" : s.direction?.startsWith("higher") ? "Higher → higher risk" : "Linked to risk"}</span>
                      </div>
                      <div className="jd-bar" style={{ height: 8 }}><i style={{ width: `${Math.max(4, (s.impact / maxImpact) * 100)}%`, background: `linear-gradient(90deg,${ACCENT},${ROSE})` }} /></div>
                    </div>
                  ))}
                  <p className="jd-note">Associations found in your data, not proof of cause — test any retention action on a small group first.</p>
                </Panel>
                {pairs.length > 0 && (
                  <Panel title="Churners compared with the rest" sub="Share of customers who churned, split at the average value of each factor">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pairs} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid horizontal={false} stroke={GRID} /><XAxis type="number" tickFormatter={(v) => pct(v)} tick={AX} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" width={150} tick={{ ...AX, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                          <Tooltip {...TT} formatter={(v: number) => pct(v, 1)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Below average" fill={SOFT} radius={0} /><Bar dataKey="Above average" fill={ACCENT} radius={0} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                )}
              </div>
              {segments.length > 0 && (
                <Panel title="Where churn concentrates" sub="Customer groups that churn far more than average">
                  <table className="jd-table">
                    <thead><tr><th>Group</th><th className="num">Customers</th><th>Churn rate</th><th className="num">Vs average</th></tr></thead>
                    <tbody>
                      {segments.map((s: any) => (
                        <tr key={`${s.dimension}${s.group}`}>
                          <td style={{ fontWeight: 600 }}>{s.dimension.replace(/_/g, " ")}: {s.group}</td><td className="num">{s.n.toLocaleString()}</td>
                          <td style={{ minWidth: 160 }}><div className="jd-bar"><i style={{ width: `${Math.min(100, s.churn_rate * 100)}%`, background: HIGH }} /></div><div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 3 }}>{pct(s.churn_rate, 1)}</div></td>
                          <td className="num" style={{ fontWeight: 700, color: "var(--neg)" }}>{s.lift.toFixed(1)}×</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
            </>
          )}

          {tab === "How to retain" && (
            <>
              <div className="jd-three">
                {[
                  { t: "High", n: M.high, v: M.highValue, l: M.highLoss, title: "Act now", steps: ["A senior owner contacts each customer before their renewal date", "Fix the specific issue behind their warning signs", "Lead with value (service review, onboarding help) before discounts"] },
                  { t: "Medium", n: M.med, v: M.tiers[1]["Revenue held"], l: M.tiers[1]["Expected to be lost"], title: "Check in", steps: ["Scheduled check-in call or email", "Confirm auto-renewal and payment details", "Share a short summary of the value they get"] },
                  { t: "Low", n: M.low, v: M.tiers[2]["Revenue held"], l: M.tiers[2]["Expected to be lost"], title: "Keep it simple", steps: ["Standard renewal reminders", "Encourage auto-renewal", "Keep monitoring — risk is re-scored on every run"] },
                ].map((p) => (
                  <div key={p.t} className="jd-play" style={{ borderTop: `3px solid ${TIER_COLOR[p.t]}`, cursor: "pointer" }} onClick={() => { setTier(p.t); setTab("Customers"); }}>
                    <div className="h"><span>{p.t} risk · {p.title}</span><span className={`jd-tag ${p.t.toLowerCase()}`}>{p.t}</span></div>
                    <div className="n">{p.n.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-faint)" }}>customers</span></div>
                    {hasValue && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{fmt(p.v)} revenue · {fmt(p.l)} expected loss</div>}
                    <ul>{p.steps.map((s) => <li key={s}>{s}</li>)}</ul>
                  </div>
                ))}
              </div>
              {byReason.length > 0 && (
                <Panel title="What to do, by reason" sub="Click a reason to see those customers">
                  <table className="jd-table">
                    <thead><tr><th>Main reason</th><th className="num">Customers</th>{hasValue && <th className="num">Revenue</th>}{hasValue && <th>Expected loss</th>}<th>What to do</th></tr></thead>
                    <tbody>
                      {byReason.map((r) => (
                        <tr key={r.reason} onClick={() => { setReason(r.reason); setTab("Customers"); }} style={{ cursor: "pointer" }}>
                          <td style={{ fontWeight: 700 }}>{r.reason}</td><td className="num">{r.n}</td>
                          {hasValue && <td className="num">{fmt(r.revenue)}</td>}
                          {hasValue && <td style={{ minWidth: 150 }}><div className="jd-bar"><i style={{ width: `${(r.loss / byReason[0].loss) * 100}%`, background: HIGH }} /></div><div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 3 }}>{fmt(r.loss)}</div></td>}
                          <td style={{ maxWidth: 320 }}>{r.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
              {hasValue && (
                <Panel title="What saving customers is worth" sub="Your assumption — move the slider to see the effect (uses the filtered high-risk customers)">
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <input className="jd-slider" type="range" min={0} max={100} step={5} value={save} onChange={(e) => setSave(Number(e.target.value))} />
                    <b style={{ width: 52, textAlign: "right" }}>{save}%</b>
                  </div>
                  <p className="jd-note" style={{ marginTop: 4 }}>Share of the expected loss in high-risk accounts that we manage to keep.</p>
                  <div className="jd-three" style={{ marginTop: 12 }}>
                    <div className="jd-play"><div className="h">Expected loss in high-risk accounts</div><div className="n">{fmt(M.highLoss)}</div></div>
                    <div className="jd-play" style={{ borderTop: `3px solid ${LOW}` }}><div className="h">Revenue kept at {save}%</div><div className="n" style={{ color: "var(--pos)" }}>{fmt(recovered)}</div></div>
                    <div className="jd-play"><div className="h">Still at risk overall</div><div className="n">{fmt(M.loss - recovered)}</div></div>
                  </div>
                </Panel>
              )}
            </>
          )}

          {tab === "Ask" && (
            <Panel title="Ask about this analysis" sub="Plain-English answers, based only on this analysis. Mention a customer ID to ask about one customer.">
              <div style={{ minHeight: 260, maxHeight: 460, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "4px 2px" }}>
                {!msgs.length && (
                  <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                    Try one of these:
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {SUGGESTIONS.map((s) => <button key={s} className="jd-tab" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => ask(s)}>{s}</button>)}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "10px 14px", fontSize: 13.5, lineHeight: 1.6,
                    background: m.role === "user" ? "#19105B" : "var(--row)", color: m.role === "user" ? "#fff" : "var(--ink)" }}>
                    {m.role === "user" ? m.content : <Markdown content={m.content} />}
                  </div>
                ))}
                {thinking && <div style={{ alignSelf: "flex-start", padding: "10px 14px", background: "var(--row)", color: "var(--ink-soft)", fontSize: 13 }}><Loader2 size={14} className="animate-spin" style={{ display: "inline", marginRight: 8 }} />Thinking…</div>}
                <div ref={chatEnd} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); ask(draft); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask a question, e.g. “Which customers should we call this week?”"
                  style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--card-line)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }} />
                <button type="submit" disabled={!draft.trim() || thinking} className="jd-tab active" style={{ opacity: !draft.trim() || thinking ? 0.5 : 1 }}><Send size={14} /> Ask</button>
              </form>
              {msgs.length > 0 && <button className="jd-reset" style={{ marginTop: 10, width: "auto", padding: "5px 12px" }} onClick={() => setMsgs([])}>Clear conversation</button>}
            </Panel>
          )}

          {tab === "Definitions" && (
            <Panel title="Definitions" sub="How to read the numbers on this dashboard">
              <table className="jd-table">
                <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
                <tbody>
                  {[
                    ["Likely to churn", "Each customer has a chance of churning. Adding them up across all customers due for renewal gives the number expected to leave — an estimate, not a named list."],
                    ["High / Medium / Low risk", "High = the 10% of customers with the highest risk. Medium = the next 20%. Low = everyone else."],
                    ["Revenue at risk", "Each customer's renewal revenue multiplied by their chance of churning, added up. It does not say when the revenue would be lost."],
                    ["Usual churn rate", "The share of past renewals that did not renew."],
                    ["How reliable is it?", H.recall_top10 != null ? `Checked on customers the analysis had never seen: the 10% highest-risk list contains ${pct(H.recall_top10)} of the customers who actually churned (${(H.lift_top10 ?? 0).toFixed(1)} times better than picking at random).` : "Checked on customers the analysis had never seen."],
                    ["Warning signs", "Customer characteristics most strongly linked with leaving. They are associations, not proof of cause."],
                    ["Filters", "Risk level, reason, group, minimum revenue and customer search change every number on the Overview, Customers and How to retain tabs."],
                    ["Data used", (R.discover?.tables ?? []).filter((t: any) => t.role !== "dictionary").map((t: any) => `${t.name} (${t.rows.toLocaleString()} rows)`).join(", ") || "—"],
                  ].map(([k, v]) => <tr key={k}><td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{k}</td><td style={{ color: "var(--ink-soft)" }}>{v}</td></tr>)}
                </tbody>
              </table>
              {(run.narrative?.caveats ?? []).filter((c: string) => !c.startsWith("Excluded")).length > 0 && (
                <p className="jd-note">Data notes: {(run.narrative.caveats as string[]).filter((c) => !c.startsWith("Excluded")).join(" ")}</p>
              )}
            </Panel>
          )}
        </div>

        <aside className="jd-side">
          <div className="jd-refresh"><span className="dot" />Analysis run {new Date((run as any).updated_at ?? Date.now()).toLocaleDateString()}<br />{total.toLocaleString()} customers scored</div>
          {FILTER_TABS.includes(tab) ? (
            <>
              <h4>Filters</h4>
              {!raw && !loadingCust && <p className="jd-note" style={{ margin: "0 0 12px", color: "var(--neg)" }}>Only the top {all.length} customers are available for this run. Run the analysis again (on the updated backend) to load all customers with renewal dates and groups.</p>}
              <div className="jd-field"><label>Risk level</label>
                <select value={tier} onChange={(e) => setTier(e.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></div>
              {reasonList.length > 0 && <div className="jd-field"><label>Main reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)}><option>All</option>{reasonList.map((r) => <option key={r}>{r}</option>)}</select></div>}
              {segCols.length > 0 && (
                <div className="jd-field"><label>Group by</label>
                  <select value={activeSeg} onChange={(e) => { setSegKey(e.target.value); setSegVal("All"); }}>{segCols.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
                  <select style={{ marginTop: 6 }} value={segVal} onChange={(e) => setSegVal(e.target.value)}><option>All</option>{segValues.map((v) => <option key={v}>{v}</option>)}</select></div>
              )}
              {hasValue && <div className="jd-field"><label>Minimum revenue</label><input type="number" min={0} value={minRev} onChange={(e) => setMinRev(e.target.value)} placeholder="e.g. 2000" /></div>}
              {hasDates && (
                <div className="jd-field"><label>Renewal due</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    {[1, 2, 3, 6].map((n) => <button key={n} className="jd-reset" style={{ width: "auto", padding: "3px 8px" }} onClick={() => setWindow(n)}>{n} mo</button>)}
                  </div>
                  <input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
                  <input type="date" style={{ marginTop: 6 }} value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
                  <p className="jd-note" style={{ marginTop: 4 }}>Months count forward from {anchor}. Renewals are due between {dues[0]} and {dues[dues.length - 1]}.</p>
                </div>
              )}
              <div className="jd-field"><label>Find a customer</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer ID" /></div>
              <button className="jd-reset" onClick={resetFilters}>Reset filters</button>
              <p className="jd-note">{M.n.toLocaleString()} of {all.length.toLocaleString()} customers shown</p>
            </>
          ) : (
            <>
              <h4>At a glance</h4>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                <div><b style={{ color: HIGH }}>{(value?.tiers?.find((t: any) => t.tier === "High")?.accounts ?? 0).toLocaleString()}</b> high risk</div>
                <div><b style={{ color: MED }}>{(value?.tiers?.find((t: any) => t.tier === "Medium")?.accounts ?? 0).toLocaleString()}</b> medium risk</div>
                <div><b style={{ color: LOW }}>{(value?.tiers?.find((t: any) => t.tier === "Low")?.accounts ?? 0).toLocaleString()}</b> low risk</div>
              </div>
            </>
          )}
        </aside>
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,6,40,.45)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} className="jm-dash" style={{ width: "min(460px, 100%)", height: "100%", overflowY: "auto", boxShadow: "-20px 0 50px -20px rgba(0,0,0,.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-faint)" }}>Customer</div><div style={{ fontSize: 22, fontWeight: 800 }}>{open.id}</div></div>
              <button onClick={() => setOpen(null)} className="jd-reset" style={{ width: 34, height: 34, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </div>
            <div className="jd-panel" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: TIER_COLOR[open.tier] }}>{pct(open.prob)}</span>
                <span className={`jd-tag ${open.tier.toLowerCase()}`}>{open.tier} risk</span>
              </div>
              <div className="jd-bar" style={{ height: 8, margin: "8px 0" }}><i style={{ width: `${Math.round(open.prob * 100)}%`, background: TIER_COLOR[open.tier] }} /></div>
              <p className="jd-note" style={{ marginTop: 0 }}>Chance of churning · more likely to churn than {pct(risePct(open))} of customers due for renewal</p>
              {hasValue && (
                <div className="jd-two" style={{ marginTop: 12, gap: 10 }}>
                  <div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>REVENUE</div><div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(open.value)}</div><div className="jd-note" style={{ marginTop: 2 }}>{(open.value ?? 0) > medianValue ? "above" : "below"} the typical customer ({fmt(medianValue)})</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>EXPECTED LOSS</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--neg)" }}>{fmt(open.loss)}</div></div>
                </div>
              )}
            </div>
            {open.due && <p className="jd-note" style={{ margin: "0 0 12px" }}>Renewal due: <b>{open.due}</b></p>}
            <div className="jd-panel" style={{ marginBottom: 12 }}>
              <h2>Why they may leave</h2>
              {open.reasons.length ? open.reasons.map((r) => (
                <div key={r.reason} style={{ padding: "8px 0", borderBottom: "1px solid var(--card-line)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.reason}</div><div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>→ {r.action}</div>
                </div>
              )) : <p className="sub">A combination of smaller factors — no single reason stands out. Review the account with its owner.</p>}
              {open.drivers.length > 0 && <p className="jd-note">Details: {open.drivers.map(driverText).join(" · ")}</p>}
            </div>
            {Object.keys(open.seg).length > 0 && (
              <div className="jd-panel" style={{ marginBottom: 12 }}>
                <h2>About this customer</h2>
                <table className="jd-table"><tbody>{Object.entries(open.seg).filter(([, v]) => v).map(([k, v]) => <tr key={k}><td style={{ color: "var(--ink-soft)" }}>{k.replace(/_/g, " ")}</td><td style={{ fontWeight: 600 }}>{v}</td></tr>)}</tbody></table>
              </div>
            )}
            <button className="jd-tab active" style={{ width: "100%", justifyContent: "center" }} onClick={() => askAbout(open)}><Sparkles size={14} /> Ask about this customer</button>
          </div>
        </div>
      )}
    </div>
  );
}
