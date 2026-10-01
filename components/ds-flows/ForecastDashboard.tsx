"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, FileText, Loader2, Sparkles } from "lucide-react";
import { dsFlowsApi } from "@/lib/api";
import { Markdown } from "@/components/shared/Markdown";
import { PageRenderer } from "@/components/ds-flows/GenericFlowWorkspace";
import type { FlowRunFull } from "@/components/ds-flows/FlowWorkspace";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* Executive view of a forecasting run — same jm-dash shell and Dashboard/Analysis pattern as
   ChurnDashboard, but built around a time series instead of scored accounts: what's coming, how
   confident the model is, and why. The technical step-by-step lives in the Analysis view. */

const TABS = ["Overview", "Forecast", "Model & accuracy", "Ask", "Definitions"] as const;
const SUGGESTIONS = [
  "What's the forecast for the next few periods?",
  "How reliable is this forecast?",
  "Why did you pick this model?",
  "What could make the forecast wrong?",
];

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

export function ForecastDashboard({ run, workspaceId, onAnalysis }: { run: FlowRunFull; workspaceId: string; onAnalysis: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const R = run.results ?? {};
  const H = run.headline ?? {};
  const detect = R.detect;
  const forecastPage = R.forecast?.page;
  const modelsPage = R.models?.page;
  const narrative: any = run.narrative ?? {};
  const bullets: string[] = narrative.executive_summary ? String(narrative.executive_summary).split(/(?<=\.)\s+/) : [];
  const actions: { driver: string; action: string }[] = narrative.actions ?? [];
  const caveats: string[] = narrative.caveats ?? [];

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

  return (
    <div className="jm-dash">
      <div className="jd-top">
        <div>
          <h1>Forecast Outlook</h1>
          <p>{H.key_result ?? "Forecast ready"}{detect?.table ? ` · ${detect.table}` : ""}</p>
        </div>
        <div className="jd-actions">
          {run.markdown && <button className="jd-btn" onClick={() => download("report", "docx")}><FileText size={14} /> Report</button>}
          <button className="jd-btn" onClick={() => setTab("Ask")}><Sparkles size={14} /> Ask</button>
          <button className="jd-btn" onClick={onAnalysis}><BarChart3 size={14} /> Analysis details</button>
        </div>
      </div>

      <div className="jd-tabs">
        {TABS.map((t) => <button key={t} className={`jd-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}><span className="ti" />{t}</button>)}
      </div>

      <div className="jd-layout">
        <div className="jd-main">
          {tab === "Overview" && (
            <>
              <Panel title="In short" sub="What the forecast means and how much to trust it">
                <div className="jd-brief">
                  {bullets.map((b, i) => (
                    <div key={i} className="row" style={{ borderColor: "#3411A3" }}>
                      <div className="x">{b}</div>
                    </div>
                  ))}
                  {!bullets.length && H.key_result && (
                    <div className="row" style={{ borderColor: "#3411A3" }}><div className="x">{H.key_result}</div></div>
                  )}
                </div>
                <p className="jd-note">A forecast extends patterns in the data; it cannot anticipate events the data has not seen.</p>
              </Panel>
              {forecastPage ? <PageRenderer page={forecastPage} run={run} workspaceId={workspaceId} /> : (
                <div className="jd-note">Forecast not ready yet.</div>
              )}
              {actions.length > 0 && (
                <Panel title="Recommended actions" sub="What to do with this forecast">
                  <table className="jd-table">
                    <thead><tr><th>Driver</th><th>Action</th></tr></thead>
                    <tbody>
                      {actions.map((a, i) => (
                        <tr key={i}><td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{a.driver}</td><td>{a.action}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
            </>
          )}

          {tab === "Forecast" && (
            forecastPage
              ? <PageRenderer page={forecastPage} run={run} workspaceId={workspaceId} />
              : <div className="jd-note">Forecast not ready yet.</div>
          )}

          {tab === "Model & accuracy" && (
            modelsPage
              ? <PageRenderer page={modelsPage} run={run} workspaceId={workspaceId} />
              : <div className="jd-note">Model comparison not ready yet.</div>
          )}

          {tab === "Ask" && (
            <Panel title="Ask about this forecast" sub="Plain-English answers, based only on this analysis.">
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
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask a question, e.g. “How reliable is this forecast?”"
                  style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--card-line)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }} />
                <button type="submit" disabled={!draft.trim() || thinking} className="jd-tab active" style={{ opacity: !draft.trim() || thinking ? 0.5 : 1 }}>Ask</button>
              </form>
              {msgs.length > 0 && <button className="jd-reset" style={{ marginTop: 10, width: "auto", padding: "5px 12px" }} onClick={() => setMsgs([])}>Clear conversation</button>}
            </Panel>
          )}

          {tab === "Definitions" && (
            <Panel title="Definitions" sub="How to read this forecast">
              <table className="jd-table">
                <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
                <tbody>
                  {[
                    ["Forecast", "The model's best estimate for each future period, based on patterns in the history."],
                    ["80% / 95% range", "How far the actual value could realistically land. Wider ranges mean more uncertainty, especially further into the future."],
                    ["sMAPE (error)", "How far off the model's backtested predictions were, on average, as a percentage. Lower is better."],
                    ["Vs naive baseline", "How much more accurate the chosen model is than simply repeating the last known value."],
                    ["Backtest", "The model is tested on past periods it was not shown, to check how well it predicts before trusting it with the future."],
                    ["Data used", detect?.table ? `${detect.table} (${detect.periods ?? "?"} periods)` : "—"],
                  ].map(([k, v]) => <tr key={k}><td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{k}</td><td style={{ color: "var(--ink-soft)" }}>{v}</td></tr>)}
                </tbody>
              </table>
              {caveats.length > 0 && <p className="jd-note">Notes: {caveats.join(" ")}</p>}
            </Panel>
          )}
        </div>

        <aside className="jd-side">
          <div className="jd-refresh"><span className="dot" />Analysis run {new Date((run as any).updated_at ?? Date.now()).toLocaleDateString()}<br />{R.models?.best ? `Model: ${R.models.best}` : ""}</div>
          <h4>At a glance</h4>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            {H.model && <div><b>{H.model}</b> selected model</div>}
            {H.smape != null && <div><b>{(H.smape * 100).toFixed(1)}%</b> average error</div>}
            {H.next_total != null && <div><b>{H.next_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> forecast total</div>}
            {H.growth != null && <div><b>{(H.growth * 100).toFixed(1)}%</b> vs previous period</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
