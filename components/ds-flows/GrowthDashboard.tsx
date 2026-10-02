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
/* Executive view of a revenue_growth run. Same shell/mechanics as ChurnDashboard (same results shape — discover,
   eda, value, explain, hypotheses — since both run the same classification+value pipeline, just with a different
   label: "grew" instead of "churned"), but the framing is inverted on purpose: a high-tier account here is an
   UPSIDE to pursue, not a risk to prevent, so tone, color and copy all read as opportunity, not alarm. */

// JMAN palette. High = positive (teal), not alarming red — this is upside, not risk.
const OPP_HIGH = "#16978E";
const MED = "#A16BDB";
const OPP_LOW = "#8683A8";
const ACCENT = "#3411A3";
const ROSE = "#26D4F0";
const SOFT = "#71EAE1";
const AX = { fontSize: 11, fill: "#8683A8" };
const GRID = "rgba(25,16,91,0.10)";
const TT = { contentStyle: { background: "var(--card)", border: "1px solid var(--card-line)", borderRadius: 0, fontSize: 12, color: "var(--ink)" } };
const TIER_COLOR: Record<string, string> = { High: OPP_HIGH, Medium: MED, Low: OPP_LOW };
const TABS = ["Overview", "Accounts", "Why they grow", "How to pursue", "Ask", "Definitions"] as const;
const FILTER_TABS = ["Overview", "Accounts", "How to pursue"];
const SUGGESTIONS = [
  "Who should we pursue first, and why?",
  "Why are these accounts likely to grow?",
  "Which customer groups have the most upside?",
  "What would capturing a quarter of the high-opportunity revenue be worth?",
  "How can we convert the high-opportunity accounts?",
];

const pct = (x: number | null | undefined, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);

const nice = (f: string) => label(f);

function reasonsFor(drivers: string[]) {
  // We don't yet know the specific growth-driver vocabulary the way churn's RULES encode "why customers leave" —
  // rather than guess wrong reasons, name the driver plainly and point to a generic next step.
  const out: { reason: string; action: string }[] = [];
  for (const d of drivers ?? []) {
    const feat = d.split(" = ")[0];
    const r = { reason: nice(feat), action: "Prioritise for an upsell / cross-sell conversation" };
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

type Acct = { id: string; name: string; prob: number; tier: string; value: number | null; gain: number | null; drivers: string[]; due: string | null; seg: Record<string, string>; reasons: { reason: string; action: string }[] };

function Spark({ data, color }: { data: any[]; color: string }) {
  return (
    <div style={{ height: 44, marginTop: 10 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs><linearGradient id="sparkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="rate" stroke={color} strokeWidth={2} fill="url(#sparkg)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ title, value, chip, tone = "neutral", children, delay = 0 }: { title: string; value: string; chip?: string; tone?: string; children?: React.ReactNode; delay?: number }) {
  return (
    <div className="jd-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="t">{title}</div>
      <div className="v">{value}</div>
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

function OppBar({ p, tier }: { p: number; tier: string }) {
  return (
    <>
      <div className="jd-bar"><i style={{ width: `${Math.round(p * 100)}%`, background: TIER_COLOR[tier] }} /></div>
      <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 3 }}>{pct(p)}</div>
    </>
  );
}

export function GrowthDashboard({ run, workspaceId, onAnalysis }: { run: FlowRunFull; workspaceId: string; onAnalysis: () => void }) {
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
  const [sort, setSort] = useState<{ key: "prob" | "value" | "gain"; dir: 1 | -1 }>({ key: "gain", dir: -1 });
  const [save, setSave] = useState(25);
  const [open, setOpen] = useState<Acct | null>(null);
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const R = run.results ?? {};
  const derived = !!R.discover?.label?.derived;
  const horizon = String(R.discover?.label?.column ?? "").match(/(\d+)m$/)?.[1] ?? "12";
  const H = run.headline ?? {};
  const value = R.value;
  const eda = R.eda;
  const valueCol: string | null = value?.value_column ?? null;
  const hasValue = !!valueCol;
  const total: number = value?.accounts_scored ?? 0;
  const growthRate: number | null = eda?.base_rate ?? R.understand?.churn_rate ?? null;
  const asOf = value?.as_of ? String(value.as_of).slice(0, 10) : null;
  const trend = (eda?.churn_by_date ?? []).map((d: any) => ({ date: String(d.date).slice(0, 7), rate: d.rate }));

  const { data: raw, isLoading: loadingAcct } = useQuery({
    queryKey: ["ds-flow-customers", workspaceId, run.id],
    queryFn: () => dsFlowsApi.customers(workspaceId, run.id),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const { all, segCols } = useMemo(() => {
    if (raw) {
      const ix = Object.fromEntries(raw.columns.map((c, i) => [c, i]));
      const fixed = new Set(["account", "as_of_snapshot", "churn_probability", "risk_tier", "expected_value_at_risk", "driver_1", "driver_2", "driver_3", "customer_name", valueCol ?? "__none__"]);
      const segs = raw.columns.filter((c) => !fixed.has(c));
      const list: Acct[] = raw.rows.map((r) => {
        const drivers = ["driver_1", "driver_2", "driver_3"].map((k) => r[ix[k]]).filter((x) => typeof x === "string" && x);
        return {
          id: String(r[ix.account]), name: ix.customer_name != null && r[ix.customer_name] ? String(r[ix.customer_name]) : "", prob: Number(r[ix.churn_probability]), tier: String(r[ix.risk_tier]),
          value: valueCol && r[ix[valueCol]] != null ? Number(r[ix[valueCol]]) : null,
          gain: r[ix.expected_value_at_risk] != null ? Number(r[ix.expected_value_at_risk]) : null,
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
    const list: Acct[] = (value?.top_accounts ?? []).map((a: any) => ({
      id: String(a.entity), name: "", prob: a.probability, tier: a.tier, value: a.value ?? null, gain: a.expected_loss ?? null,
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
      (!ql || c.id.toLowerCase().includes(ql) || c.name.toLowerCase().includes(ql)));
  }, [all, tier, reason, segVal, activeSeg, minRev, q, dueFrom, dueTo]);

  const M = useMemo(() => {
    const by = (t: string) => filtered.filter((c) => c.tier === t);
    const sum = (xs: Acct[], k: "value" | "gain") => xs.reduce((s, c) => s + (c[k] ?? 0), 0);
    const h = by("High"), m = by("Medium"), l = by("Low");
    return {
      n: filtered.length, expected: Math.round(filtered.reduce((s, c) => s + c.prob, 0)),
      high: h.length, med: m.length, low: l.length,
      revenue: sum(filtered, "value"), gain: sum(filtered, "gain"), highValue: sum(h, "value"), highGain: sum(h, "gain"),
      tiers: [["High", h], ["Medium", m], ["Low", l]].map(([t, xs]: any) => ({ tier: t, "Current revenue": sum(xs, "value"), "Growth opportunity": sum(xs, "gain") })),
    };
  }, [filtered]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) * sort.dir), [filtered, sort]);
  const byReason = useMemo(() => {
    const m = new Map<string, { reason: string; action: string; n: number; revenue: number; gain: number }>();
    for (const c of filtered) {
      if (!c.reasons.length) continue;
      const r = c.reasons[0];
      const e = m.get(r.reason) ?? { reason: r.reason, action: r.action, n: 0, revenue: 0, gain: 0 };
      e.n += 1; e.revenue += c.value ?? 0; e.gain += c.gain ?? 0;
      m.set(r.reason, e);
    }
    return Array.from(m.values()).sort((a, b) => b.gain - a.gain);
  }, [filtered]);

  const dues = useMemo(() => all.map((c) => c.due).filter(Boolean).sort() as string[], [all]);
  const hasDates = dues.length > 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  const base = asOf ?? todayIso;
  const anchor = dues.find((d) => d >= base) ?? dues[0] ?? base;
  const addMonths = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
  const setWindow = (months: number) => { setDueFrom(anchor); setDueTo(addMonths(anchor, months)); };
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; Accounts: number; "Expected to grow": number; "Revenue opportunity": number }>();
    for (const c of filtered) {
      if (!c.due) continue;
      const k = c.due.slice(0, 7);
      const e = m.get(k) ?? { month: k, Accounts: 0, "Expected to grow": 0, "Revenue opportunity": 0 };
      e.Accounts += 1; e["Expected to grow"] += c.prob; e["Revenue opportunity"] += c.gain ?? 0;
      m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => a.month.localeCompare(b.month)).map((e) => ({ ...e, "Expected to grow": Math.round(e["Expected to grow"]) }));
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
  const donut = [{ name: "High opportunity", value: M.high, c: OPP_HIGH }, { name: "Medium opportunity", value: M.med, c: MED }, { name: "Low opportunity", value: M.low, c: OPP_LOW }];
  const captured = M.highGain * save / 100;

  const risePct = (c: Acct) => (all.length ? all.filter((x) => x.prob < c.prob).length / all.length : null);
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
    const head = ["Customer", "Chance of growing", "Opportunity level", hasValue ? "Revenue" : "", hasValue ? "Growth opportunity" : "", "Renewal due", "Signals", "Suggested action", ...segCols].filter(Boolean);
    const rows = sorted.map((c) => [c.id, (c.prob * 100).toFixed(1) + "%", c.tier, ...(hasValue ? [c.value ?? "", c.gain != null ? Math.round(c.gain) : ""] : []), c.due ?? "", c.reasons.map((r) => r.reason).join("; "), c.reasons[0]?.action ?? "", ...segCols.map((s) => c.seg[s] ?? "")]);
    const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "accounts_filtered.csv"; a.click();
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

  const askAbout = (c: Acct) => { setOpen(null); setTab("Ask"); setDraft(`Tell me about customer ${c.name || c.id} and the best way to grow this account.`); };
  const Row = ({ c }: { c: Acct }) => (
    <tr key={c.id} onClick={() => setOpen(c)} style={{ cursor: "pointer" }}>
      <td style={{ fontWeight: 700 }}>{c.name || c.id}{c.name && <div style={{ fontWeight: 400, fontSize: 10.5, color: "var(--ink-faint)" }}>{c.id.slice(0, 12)}</div>}</td>
      <td style={{ minWidth: 100 }}><OppBar p={c.prob} tier={c.tier} /></td>
      <td><span className={`jd-tag opp-${c.tier.toLowerCase()}`}>{c.tier}</span></td>
      {hasValue && <td className="num">{fmt(c.value)}</td>}
      {hasValue && <td className="num" style={{ fontWeight: 700 }}>{fmt(c.gain)}</td>}
      <td>{c.reasons.length ? c.reasons.map((r) => <span key={r.reason} className="jd-why">{r.reason}</span>) : <span className="jd-why">Several factors</span>}</td>
      <td style={{ maxWidth: 260 }}>{c.reasons[0]?.action ?? "Review the account with its owner"}</td>
    </tr>
  );
  const SortTh = ({ k, children }: { k: "prob" | "value" | "gain"; children: React.ReactNode }) => (
    <th className={k === "prob" ? "" : "num"} style={{ cursor: "pointer" }} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {children}{sort.key === k ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="jm-dash">
      <div className="jd-top">
        <div>
          <h1>Revenue Growth Outlook</h1>
          <p>{total.toLocaleString()} {derived ? "active customers" : "customers due for renewal"}{asOf ? ` · data as of ${asOf}` : ""}</p>
        </div>
        <div className="jd-actions">
          {run.files.accounts && <button className="jd-btn" onClick={() => download("accounts", "csv")}><Users size={14} /> Account list</button>}
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
              Filtered: {M.n.toLocaleString()} of {all.length.toLocaleString()} accounts
              <button onClick={resetFilters} style={{ marginLeft: 10, textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}>Clear</button>
            </div>
          )}
          {loadingAcct && FILTER_TABS.includes(tab) && <div className="jd-note" style={{ marginTop: 0 }}><Loader2 size={12} className="animate-spin" style={{ display: "inline", marginRight: 6 }} />Loading all accounts…</div>}

          {tab === "Overview" && (
            <>
              <Panel title="In short" sub={filtersActive ? `Based on the accounts you have selected${windowText}` : "Based on all accounts due for renewal"}>
                <div className="jd-brief">
                  <div className="row" style={{ borderColor: OPP_HIGH }}>
                    <div className="k">What to expect</div>
                    <div className="x">
                      About <b>{M.expected.toLocaleString()}</b> of <b>{M.n.toLocaleString()}</b> accounts
                      {M.expected > 0 ? <> (roughly <b>1 in {Math.max(1, Math.round(M.n / M.expected))}</b>)</> : null} are likely to grow{derived ? ` within the next ${horizon} months` : " at renewal"}.
                    </div>
                  </div>
                  {hasValue && (
                    <div className="row" style={{ borderColor: MED }}>
                      <div className="k">Growth opportunity</div>
                      <div className="x">These accounts could add about <b>{fmt(M.gain)}</b> of incremental revenue if we act on it.</div>
                    </div>
                  )}
                  {M.high > 0 && (
                    <div className="row" style={{ borderColor: ACCENT }}>
                      <div className="k">Who to pursue first</div>
                      <div className="x"><b>{M.high.toLocaleString()}</b> accounts are high-opportunity{hasValue ? <> and together hold <b>{fmt(M.highValue)}</b> of revenue</> : null}. A personal upsell conversation with each is the best place to start.</div>
                    </div>
                  )}
                  {(topSigns.length > 0 || byReason.length > 0) && (
                    <div className="row" style={{ borderColor: OPP_LOW }}>
                      <div className="k">Why they're likely to grow</div>
                      <div className="x">
                        {byReason.length > 0 ? <>The most common signal is <b>{byReason[0].reason.toLowerCase()}</b>. </> : null}
                        {topSigns.length > 0 ? <>The strongest signals in the data are {topSigns.join(", ").toLowerCase()}.</> : null}
                      </div>
                    </div>
                  )}
                </div>
                <p className="jd-note">These are estimates based on how accounts behaved historically, not a guarantee.</p>
              </Panel>

              <div className="jd-kpis">
                <Kpi title="Likely to grow" value={M.expected.toLocaleString()} chip={`${pct(M.n ? M.expected / M.n : null, 1)} of accounts`} tone="pos" />
                <Kpi title="High-opportunity accounts" value={M.high.toLocaleString()} chip="pursue now" tone="pos" delay={60} />
                {hasValue && <Kpi title="Revenue opportunity" value={fmt(M.gain)} chip="expected upside" tone="pos" delay={120} />}
                {hasValue && <Kpi title="Revenue in high-opportunity accounts" value={fmt(M.highValue)} chip={`${pct(M.revenue ? M.highValue / M.revenue : null)} of total revenue`} tone="neutral" delay={180} />}
                <Kpi title="Usual growth rate" value={pct(growthRate, 1)} chip="historical baseline" tone="neutral" delay={240}>{trend.length > 2 && <Spark data={trend} color={ACCENT} />}</Kpi>
              </div>

              <div className="jd-two">
                <Panel title="Accounts by opportunity level" sub="Click a slice's level in the filters to focus on it">
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
                        <div style={{ fontSize: 22, fontWeight: 800 }}>{M.n.toLocaleString()}</div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>accounts</div>
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
                  <Panel title="Revenue by opportunity level" sub="What each group is worth today, and the upside on top">
                    <div style={{ height: 230 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={M.tiers} barGap={6}>
                          <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="tier" tick={AX} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={(v) => fmt(v)} tick={AX} axisLine={false} tickLine={false} width={48} />
                          <Tooltip {...TT} formatter={(v: number) => fmt(v)} />
                          <Bar dataKey="Current revenue" fill={SOFT} radius={0} /><Bar dataKey="Growth opportunity" fill={OPP_HIGH} radius={0} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => <span style={{ color: "var(--ink)" }}>{v}</span>} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                )}
              </div>

              {monthly.length > 1 && (
                <Panel title="Expected growth by renewal month" sub="Accounts expected to grow in each month their renewal falls due — click a bar to focus on that month">
                  <div style={{ height: 230 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} onClick={(e: any) => e?.activeLabel && pickMonth(e.activeLabel)} style={{ cursor: "pointer" }}>
                        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="month" tick={AX} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="l" tick={AX} axisLine={false} tickLine={false} width={40} />
                        {hasValue && <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => fmt(v)} tick={AX} axisLine={false} tickLine={false} width={48} />}
                        <Tooltip {...TT} formatter={(v: number, n: string) => (n === "Revenue opportunity" ? fmt(v) : v.toLocaleString())} />
                        <Bar yAxisId="l" dataKey="Expected to grow" fill={ACCENT} radius={0} />
                        {hasValue && <Bar yAxisId="r" dataKey="Revenue opportunity" fill={SOFT} radius={0} />}
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => <span style={{ color: "var(--ink)" }}>{v}</span>} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              )}

              <div className="jd-two">
                {trend.length > 2 && (
                  <Panel title="Growth rate over time" sub="Share of accounts that grew, by period (all accounts)">
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend}>
                          <defs><linearGradient id="trendfillg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} /><stop offset="100%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="date" tick={AX} axisLine={false} tickLine={false} minTickGap={36} />
                          <YAxis tickFormatter={(v) => pct(v)} tick={AX} axisLine={false} tickLine={false} width={40} />
                          <Tooltip {...TT} formatter={(v: number) => pct(v, 1)} /><Area type="monotone" dataKey="rate" name="Growth rate" stroke={ACCENT} strokeWidth={2.5} fill="url(#trendfillg)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                )}
                <Panel title="Accounts to pursue first" sub="Highest expected revenue opportunity — click one for details" right={<button className="jd-reset" style={{ width: "auto", padding: "4px 10px" }} onClick={() => setTab("Accounts")}>See all</button>}>
                  <table className="jd-table">
                    <tbody>
                      {[...filtered].sort((a, b) => (b.gain ?? b.prob) - (a.gain ?? a.prob)).slice(0, 5).map((c) => (
                        <tr key={c.id} onClick={() => setOpen(c)} style={{ cursor: "pointer" }}>
                          <td style={{ fontWeight: 700 }}>{c.name || c.id}</td>
                          <td style={{ width: 90 }}><OppBar p={c.prob} tier={c.tier} /></td>
                          <td>{c.reasons[0]?.reason ?? "Several factors"}</td>
                          {hasValue && <td className="num" style={{ fontWeight: 700 }}>{fmt(c.gain)}</td>}
                        </tr>
                      ))}
                      {!filtered.length && <tr><td style={{ textAlign: "center", color: "var(--ink-faint)", padding: 20 }}>No accounts match these filters.</td></tr>}
                    </tbody>
                  </table>
                </Panel>
              </div>
            </>
          )}

          {tab === "Accounts" && (
            <Panel title="Accounts" sub={`${filtered.length.toLocaleString()} accounts — click a row for a deep dive, click a column to sort`}
              right={<button className="jd-reset" style={{ width: "auto", padding: "6px 12px", display: "inline-flex", gap: 6, alignItems: "center" }} onClick={exportFiltered}><Download size={13} /> Export these</button>}>
              <div style={{ overflowX: "auto" }}>
                <table className="jd-table">
                  <thead><tr><th>Customer</th><SortTh k="prob">Likelihood</SortTh><th>Level</th>{hasValue && <SortTh k="value">Revenue</SortTh>}{hasValue && <SortTh k="gain">Opportunity</SortTh>}<th>Why</th><th>Suggested action</th></tr></thead>
                  <tbody>
                    {sorted.slice(0, shown).map((c) => <Row key={c.id} c={c} />)}
                    {!sorted.length && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--ink-faint)" }}>No accounts match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              {sorted.length > shown && <button className="jd-reset" style={{ marginTop: 12 }} onClick={() => setShown((s) => s + 50)}>Show 50 more ({(sorted.length - shown).toLocaleString()} left)</button>}
              <p className="jd-note">Signals and suggested actions are shown for the accounts with the strongest growth signals.</p>
            </Panel>
          )}

          {tab === "Why they grow" && (
            <>
              <div className="jd-two">
                <Panel title="Biggest growth signals" sub="The account characteristics most strongly linked with growing">
                  {signs.map((s: any) => (
                    <div key={s.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <b>{s.name}</b><span style={{ color: "var(--ink-soft)" }}>{s.direction?.startsWith("lower") ? "Lower → more growth" : s.direction?.startsWith("higher") ? "Higher → more growth" : "Linked to growth"}</span>
                      </div>
                      <div className="jd-bar" style={{ height: 8 }}><i style={{ width: `${Math.max(4, (s.impact / maxImpact) * 100)}%`, background: `linear-gradient(90deg,${ACCENT},${ROSE})` }} /></div>
                    </div>
                  ))}
                  <p className="jd-note">Associations found in your data, not proof of cause — test any upsell play on a small group first.</p>
                </Panel>
                {pairs.length > 0 && (
                  <Panel title="High-growth accounts compared with the rest" sub="Share of accounts that grew, split at the average value of each factor">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pairs} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid horizontal={false} stroke={GRID} /><XAxis type="number" tickFormatter={(v) => pct(v)} tick={AX} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" width={150} tick={{ ...AX, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                          <Tooltip {...TT} formatter={(v: number) => pct(v, 1)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => <span style={{ color: "var(--ink)" }}>{v}</span>} />
                          <Bar dataKey="Below average" fill={SOFT} radius={0} /><Bar dataKey="Above average" fill={ACCENT} radius={0} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                )}
              </div>
              {segments.length > 0 && (
                <Panel title="Where growth concentrates" sub="Customer groups that grow far more than average">
                  <table className="jd-table">
                    <thead><tr><th>Group</th><th className="num">Accounts</th><th>Growth rate</th><th className="num">Vs average</th></tr></thead>
                    <tbody>
                      {segments.map((s: any) => (
                        <tr key={`${s.dimension}${s.group}`}>
                          <td style={{ fontWeight: 600 }}>{s.dimension.replace(/_/g, " ")}: {s.group}</td><td className="num">{s.n.toLocaleString()}</td>
                          <td style={{ minWidth: 160 }}><div className="jd-bar"><i style={{ width: `${Math.min(100, s.churn_rate * 100)}%`, background: OPP_HIGH }} /></div><div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 3 }}>{pct(s.churn_rate, 1)}</div></td>
                          <td className="num" style={{ fontWeight: 700, color: OPP_HIGH }}>{s.lift.toFixed(1)}×</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
            </>
          )}

          {tab === "How to pursue" && (
            <>
              <div className="jd-three">
                {[
                  { t: "High", n: M.high, v: M.highValue, l: M.highGain, title: "Pursue now", steps: ["A senior owner reaches out before the renewal with a specific upsell/cross-sell offer", "Lead with the value already delivered, then introduce the expansion opportunity", "Track the conversation to a concrete next step, not just an email"] },
                  { t: "Medium", n: M.med, v: M.tiers[1]["Current revenue"], l: M.tiers[1]["Growth opportunity"], title: "Nurture", steps: ["Scheduled check-in call or email surfacing the opportunity", "Share relevant case studies or product updates", "Re-score next run — opportunity can shift as usage changes"] },
                  { t: "Low", n: M.low, v: M.tiers[2]["Current revenue"], l: M.tiers[2]["Growth opportunity"], title: "Monitor", steps: ["Standard renewal cadence, no special outreach needed yet", "Keep an eye out for new signals (new product usage, team growth)", "Re-score on every run — this can change"] },
                ].map((p) => (
                  <div key={p.t} className="jd-play" style={{ borderTop: `3px solid ${TIER_COLOR[p.t]}`, cursor: "pointer" }} onClick={() => { setTier(p.t); setTab("Accounts"); }}>
                    <div className="h"><span>{p.t} opportunity · {p.title}</span><span className={`jd-tag opp-${p.t.toLowerCase()}`}>{p.t}</span></div>
                    <div className="n">{p.n.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-faint)" }}>accounts</span></div>
                    {hasValue && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{fmt(p.v)} current revenue · {fmt(p.l)} opportunity</div>}
                    <ul>{p.steps.map((s) => <li key={s}>{s}</li>)}</ul>
                  </div>
                ))}
              </div>
              {byReason.length > 0 && (
                <Panel title="What to do, by signal" sub="Click a signal to see those accounts">
                  <table className="jd-table">
                    <thead><tr><th>Main signal</th><th className="num">Accounts</th>{hasValue && <th className="num">Revenue</th>}{hasValue && <th>Opportunity</th>}<th>What to do</th></tr></thead>
                    <tbody>
                      {byReason.map((r) => (
                        <tr key={r.reason} onClick={() => { setReason(r.reason); setTab("Accounts"); }} style={{ cursor: "pointer" }}>
                          <td style={{ fontWeight: 700 }}>{r.reason}</td><td className="num">{r.n}</td>
                          {hasValue && <td className="num">{fmt(r.revenue)}</td>}
                          {hasValue && <td style={{ minWidth: 150 }}><div className="jd-bar"><i style={{ width: `${(r.gain / byReason[0].gain) * 100}%`, background: OPP_HIGH }} /></div><div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 3 }}>{fmt(r.gain)}</div></td>}
                          <td style={{ maxWidth: 320 }}>{r.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
              {hasValue && (
                <Panel title="What capturing this opportunity is worth" sub="Your assumption — move the slider to see the effect (uses the filtered high-opportunity accounts)">
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <input className="jd-slider" type="range" min={0} max={100} step={5} value={save} onChange={(e) => setSave(Number(e.target.value))} />
                    <b style={{ width: 52, textAlign: "right" }}>{save}%</b>
                  </div>
                  <p className="jd-note" style={{ marginTop: 4 }}>Share of the growth opportunity in high-opportunity accounts that we actually convert.</p>
                  <div className="jd-three" style={{ marginTop: 12 }}>
                    <div className="jd-play"><div className="h">Opportunity in high-opportunity accounts</div><div className="n">{fmt(M.highGain)}</div></div>
                    <div className="jd-play" style={{ borderTop: `3px solid ${OPP_HIGH}` }}><div className="h">Revenue captured at {save}%</div><div className="n" style={{ color: "var(--pos)" }}>{fmt(captured)}</div></div>
                    <div className="jd-play"><div className="h">Still untapped</div><div className="n">{fmt(M.gain - captured)}</div></div>
                  </div>
                </Panel>
              )}
            </>
          )}

          {tab === "Ask" && (
            <Panel title="Ask about this analysis" sub="Plain-English answers, based only on this analysis. Mention a customer ID to ask about one account.">
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
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask a question, e.g. “Which accounts should we call this week?”"
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
                    ["Likely to grow", "Each account has a chance of growing (converting, cross-selling or expanding). Adding them up gives the number expected to grow — an estimate, not a named list."],
                    ["High / Medium / Low opportunity", "High = roughly the 10% of accounts with the highest chance of growing. Medium = roughly the next 20%. Low = everyone else."],
                    ["Revenue opportunity", "Each account's revenue multiplied by its chance of growing, added up. It does not say when the growth would land."],
                    ["Usual growth rate", "The share of accounts that grew historically."],
                    ["How reliable is it?", H.recall_top10 != null ? `Checked on accounts the analysis had never seen: the 10% highest-opportunity list contains ${pct(H.recall_top10)} of the accounts that actually grew (${(H.lift_top10 ?? 0).toFixed(1)} times better than picking at random).` : "Checked on accounts the analysis had never seen."],
                    ["Growth signals", "Account characteristics most strongly linked with growing. They are associations, not proof of cause."],
                    ["Filters", "Opportunity level, signal, group, minimum revenue and account search change every number on the Overview, Accounts and How to pursue tabs."],
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
          <div className="jd-refresh"><span className="dot" />Analysis run {new Date((run as any).updated_at ?? Date.now()).toLocaleDateString()}<br />{total.toLocaleString()} accounts scored</div>
          {FILTER_TABS.includes(tab) ? (
            <>
              <h4>Filters</h4>
              {!raw && !loadingAcct && <p className="jd-note" style={{ margin: "0 0 12px", color: "var(--neg)" }}>Only the top {all.length} accounts are available for this run. Run the analysis again (on the updated backend) to load all accounts with renewal dates and groups.</p>}
              <div className="jd-field"><label>Opportunity level</label>
                <select value={tier} onChange={(e) => setTier(e.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></div>
              {reasonList.length > 0 && <div className="jd-field"><label>Main signal</label>
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
              <div className="jd-field"><label>Find a customer</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer name or ID" /></div>
              <button className="jd-reset" onClick={resetFilters}>Reset filters</button>
              <p className="jd-note">{M.n.toLocaleString()} of {all.length.toLocaleString()} accounts shown</p>
            </>
          ) : (
            <>
              <h4>At a glance</h4>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                <div><b style={{ color: OPP_HIGH }}>{(value?.tiers?.find((t: any) => t.tier === "High")?.accounts ?? 0).toLocaleString()}</b> high opportunity</div>
                <div><b style={{ color: MED }}>{(value?.tiers?.find((t: any) => t.tier === "Medium")?.accounts ?? 0).toLocaleString()}</b> medium opportunity</div>
                <div><b style={{ color: OPP_LOW }}>{(value?.tiers?.find((t: any) => t.tier === "Low")?.accounts ?? 0).toLocaleString()}</b> low opportunity</div>
              </div>
            </>
          )}
        </aside>
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,6,40,.45)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} className="jm-dash" style={{ width: "min(460px, 100%)", height: "100%", overflowY: "auto", boxShadow: "-20px 0 50px -20px rgba(0,0,0,.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-faint)" }}>Customer</div><div style={{ fontSize: 22, fontWeight: 800 }}>{open.name || open.id}</div></div>
              <button onClick={() => setOpen(null)} className="jd-reset" style={{ width: 34, height: 34, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </div>
            <div className="jd-panel" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: TIER_COLOR[open.tier] }}>{pct(open.prob)}</span>
                <span className={`jd-tag opp-${open.tier.toLowerCase()}`}>{open.tier} opportunity</span>
              </div>
              <div className="jd-bar" style={{ height: 8, margin: "8px 0" }}><i style={{ width: `${Math.round(open.prob * 100)}%`, background: TIER_COLOR[open.tier] }} /></div>
              <p className="jd-note" style={{ marginTop: 0 }}>Chance of growing · more likely to grow than {pct(risePct(open))} of accounts due for renewal</p>
              {hasValue && (
                <div className="jd-two" style={{ marginTop: 12, gap: 10 }}>
                  <div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>REVENUE</div><div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(open.value)}</div><div className="jd-note" style={{ marginTop: 2 }}>{(open.value ?? 0) > medianValue ? "above" : "below"} the typical account ({fmt(medianValue)})</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>GROWTH OPPORTUNITY</div><div style={{ fontSize: 20, fontWeight: 800, color: OPP_HIGH }}>{fmt(open.gain)}</div></div>
                </div>
              )}
            </div>
            {open.due && <p className="jd-note" style={{ margin: "0 0 12px" }}>Renewal due: <b>{open.due}</b></p>}
            <div className="jd-panel" style={{ marginBottom: 12 }}>
              <h2>Why they're likely to grow</h2>
              {open.reasons.length ? open.reasons.map((r) => (
                <div key={r.reason} style={{ padding: "8px 0", borderBottom: "1px solid var(--card-line)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.reason}</div><div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>→ {r.action}</div>
                </div>
              )) : <p className="sub">A combination of smaller factors — no single signal stands out. Review the account with its owner.</p>}
              {open.drivers.length > 0 && <p className="jd-note">Details: {open.drivers.map(driverText).join(" · ")}</p>}
            </div>
            {Object.keys(open.seg).length > 0 && (
              <div className="jd-panel" style={{ marginBottom: 12 }}>
                <h2>About this customer</h2>
                <table className="jd-table"><tbody>{Object.entries(open.seg).filter(([, v]) => v).map(([k, v]) => <tr key={k}><td style={{ color: "var(--ink-soft)" }}>{k.replace(/_/g, " ")}</td><td style={{ fontWeight: 600 }}>{v}</td></tr>)}</tbody></table>
              </div>
            )}
            <button className="jd-tab active" style={{ width: "100%", justifyContent: "center" }} onClick={() => askAbout(open)}><Sparkles size={14} /> Ask about this account</button>
          </div>
        </div>
      )}
    </div>
  );
}
