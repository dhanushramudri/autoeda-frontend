"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, DollarSign, Loader2, Lock, Play, Trash2, TrendingDown, TrendingUp, Zap, type LucideIcon } from "lucide-react";

import { dsFlowsApi } from "@/lib/api";
import { useTour } from "@/hooks/useTourContext";
import { solutionsTour } from "@/lib/tourSteps";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { FlowWorkspace, type FlowRunFull } from "@/components/ds-flows/FlowWorkspace";
import { ChurnDashboard } from "@/components/ds-flows/ChurnDashboard";
import { GenericFlowWorkspace } from "@/components/ds-flows/GenericFlowWorkspace";
import { ForecastDashboard } from "@/components/ds-flows/ForecastDashboard";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Pre-run labels are deliberately hedged — these are surface-level data-structure signals, not proven results.
const SIGNAL_LABEL: Record<string, string> = { strong: "Strong signals", possible: "Signals found", weak: "Weak signals", not_detected: "Not detected" };

type FlowConfig = { icon: LucideIcon; iconGradient: string; watermarkColor: string };
const FLOW_CONFIG: Record<string, FlowConfig> = {
  churn:           { icon: TrendingDown, iconGradient: "from-rose-500 to-pink-600",     watermarkColor: "text-rose-200" },
  revenue_growth:  { icon: TrendingUp,   iconGradient: "from-emerald-500 to-teal-600",  watermarkColor: "text-emerald-200" },
  forecasting:     { icon: BarChart3,    iconGradient: "from-blue-500 to-indigo-600",   watermarkColor: "text-blue-200" },
  pricing:         { icon: DollarSign,   iconGradient: "from-amber-400 to-orange-500",  watermarkColor: "text-amber-200" },
  efficiency_cost: { icon: Zap,          iconGradient: "from-violet-500 to-purple-600", watermarkColor: "text-violet-200" },
};

// FastAPI returns `detail` as a string for our errors but as an array of {type, loc, msg, input} for validation
// errors (422) — never render it raw.
function errMsg(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const first = d[0]?.msg;
    return first ? `${fallback} (${first}). If you just updated the app, restart the backend.` : fallback;
  }
  return fallback;
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "completed" ? "bg-brand/10 text-brand"
    : status === "error" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
    : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
  return <span className={cn("px-2 py-0.5 rounded text-[10px] tracking-wide font-semibold uppercase", cls)}>{status}</span>;
}

export default function DsFlowsPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const runParam = searchParams.get("run");
  const activeRunId = runParam ? Number(runParam) : null;
  const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set());
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});
  const [isLaunching, setIsLaunching] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<number | null>(null);
  const [runViewError, setRunViewError] = useState<string | null>(null);
  // finished runs open on the executive dashboard; "Analysis" is the full technical workspace
  const [viewPick, setViewPick] = useState<"dashboard" | "analysis" | null>(null);
  useEffect(() => { setViewPick(null); setIsLaunching(false); setRunViewError(null); }, [activeRunId]);
  const { startTour } = useTour();
  const userId = useAuthStore((s) => s.user?.id);

  // ?welcome=1 is set by the login redirect: clean the URL and show the short tour once per user per browser
  useEffect(() => {
    if (searchParams.get("welcome") !== "1") return;
    router.replace(`/workspaces/${workspaceId}/ds-flows`);
    const key = `autoeda_solutions_tour_v1_${userId ?? "user"}`; // bump v1 to re-show the tour to everyone
    let seen = false;
    try { seen = !!localStorage.getItem(key); } catch { /* storage unavailable */ }
    if (!seen) {
      try { localStorage.setItem(key, "1"); } catch { /* storage unavailable */ }
      const t = setTimeout(() => startTour(solutionsTour), 800);
      return () => clearTimeout(t);
    }
  }, [searchParams, router, workspaceId, userId, startTour]);

  // the server analyses every dataset in the workspace automatically — nothing to select
  const { data: plan, isLoading: planLoading, error: planError } = useQuery({
    queryKey: ["ds-flow-plan", workspaceId],
    queryFn: () => dsFlowsApi.scan(workspaceId),
    enabled: activeRunId == null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: runs } = useQuery({
    queryKey: ["ds-flow-runs", workspaceId],
    queryFn: () => dsFlowsApi.listRuns(workspaceId),
    refetchInterval: (q) => ((q.state.data as any[] | undefined)?.some((r) => r.status === "pending" || r.status === "running") ? 4000 : false),
  });

  const { data: run } = useQuery<FlowRunFull>({
    queryKey: ["ds-flow-run", workspaceId, activeRunId],
    queryFn: () => dsFlowsApi.getRun(workspaceId, activeRunId!),
    enabled: activeRunId != null,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      return s === "pending" || s === "running" ? 2000 : false;
    },
  });

  useEffect(() => {
    if (run?.status === "completed" || run?.status === "error") qc.invalidateQueries({ queryKey: ["ds-flow-runs", workspaceId] });
  }, [run?.status, qc, workspaceId]);

  const deleteRun = async (e: React.MouseEvent, runId: number) => {
    e.stopPropagation();
    if (deletingRunId != null) return;
    setDeletingRunId(runId);
    try {
      await dsFlowsApi.deleteRun(workspaceId, runId);
      qc.invalidateQueries({ queryKey: ["ds-flow-runs", workspaceId] });
    } catch {
      // silently ignore — run list will stay unchanged
    } finally {
      setDeletingRunId(null);
    }
  };

  const toggleFlow = (key: string) => {
    setSelectedFlows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const runSelected = async () => {
    if (selectedFlows.size === 0 || isLaunching) return;
    const keys = Array.from(selectedFlows);
    setIsLaunching(true);
    setRunErrors({});
    const errors: Record<string, string> = {};
    let lastRunId: number | null = null;
    for (const key of keys) {
      try {
        const d = await dsFlowsApi.startRun(workspaceId, key);
        lastRunId = d.run_id;
        qc.invalidateQueries({ queryKey: ["ds-flow-runs", workspaceId] });
      } catch (e: any) {
        errors[key] = errMsg(e, `Could not start ${key}`);
      }
    }
    setIsLaunching(false);
    if (Object.keys(errors).length) {
      setRunErrors(errors);
    } else {
      setSelectedFlows(new Set());
      if (lastRunId != null && keys.length === 1) {
        router.replace(`/workspaces/${workspaceId}/ds-flows?run=${lastRunId}`);
      } else {
        qc.invalidateQueries({ queryKey: ["ds-flow-runs", workspaceId] });
      }
    }
  };

  /* ---------------- run view ---------------- */
  if (activeRunId != null) {
    const runIsActive = run?.status === "running" || run?.status === "pending";

    const handleDeleteRun = async () => {
      if (!run || deletingRunId != null) return;
      setRunViewError(null);
      setDeletingRunId(run.id);
      try {
        await dsFlowsApi.deleteRun(workspaceId, run.id);
        qc.invalidateQueries({ queryKey: ["ds-flow-runs", workspaceId] });
        router.replace(`/workspaces/${workspaceId}/ds-flows`);
      } catch (e: any) {
        setRunViewError(errMsg(e, "Could not delete this run — try again"));
        setDeletingRunId(null);
      }
    };

    const handleRunAgain = async () => {
      if (!run || isLaunching) return;
      setRunViewError(null);
      setIsLaunching(true);
      try {
        const d = await dsFlowsApi.startRun(workspaceId, run.flow_key);
        // Navigate first so the new run's query fires immediately, then invalidate the list
        router.replace(`/workspaces/${workspaceId}/ds-flows?run=${d.run_id}`);
        qc.invalidateQueries({ queryKey: ["ds-flow-runs", workspaceId] });
      } catch (e: any) {
        setRunViewError(errMsg(e, "Could not start a new run — please try again"));
        setIsLaunching(false);
      }
    };

    return (
      <div className="px-3 py-2 space-y-2">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => router.replace(`/workspaces/${workspaceId}/ds-flows`)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> All flows
          </button>
          {run && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunAgain}
                disabled={isLaunching || runIsActive}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-brand-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {isLaunching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run again
              </button>
              <button
                onClick={handleDeleteRun}
                disabled={deletingRunId != null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-red-600 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition-colors"
              >
                {deletingRunId === run?.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete run
              </button>
            </div>
          )}
        </div>

        {runViewError && (
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {runViewError}
          </div>
        )}
        {!run ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-jman-midnight dark:text-foreground">{run.title}</h1>
              <StatusPill status={run.status} />
            </div>
            {run.status === "error" && run.error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">{run.error}</div>
            )}
            {(() => {
              const isForecast = run.flow_key === "forecasting";
              const Dashboard = isForecast ? ForecastDashboard : ChurnDashboard;
              const Analysis = isForecast ? GenericFlowWorkspace : FlowWorkspace;
              const hasDashboard = run.status === "completed" && !!run.headline;
              return (
                <>
                  {hasDashboard && (
                    <div className="flex gap-1.5">
                      {(["dashboard", "analysis"] as const).map((v) => (
                        <button key={v} onClick={() => setViewPick(v)}
                          className={cn("px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                            (viewPick ?? "dashboard") === v ? "bg-brand text-brand-foreground border-brand" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted")}>
                          {v === "dashboard" ? "Dashboard" : "Analysis"}
                        </button>
                      ))}
                    </div>
                  )}
                  {hasDashboard && (viewPick ?? "dashboard") === "dashboard"
                    ? <Dashboard run={run} workspaceId={workspaceId} onAnalysis={() => setViewPick("analysis")} />
                    : <Analysis run={run} workspaceId={workspaceId} />}
                </>
              );
            })()}
          </>
        )}
      </div>
    );
  }

  /* ---------------- start view ---------------- */
  const planErrorMsg = planError ? errMsg(planError, "Could not analyse the datasets") : undefined;

  // All runs grouped by flow key, newest first
  const runsByFlow: Record<string, any[]> = {};
  (runs ?? []).forEach((r: any) => {
    if (!runsByFlow[r.flow_key]) runsByFlow[r.flow_key] = [];
    runsByFlow[r.flow_key].push(r);
  });
  // Most-recent run per flow (for rank/verdict logic)
  const lastRunByFlow: Record<string, any> = {};
  Object.entries(runsByFlow).forEach(([key, rs]) => { lastRunByFlow[key] = rs[0]; });

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <div className="px-6 py-6 space-y-6 min-w-0 overflow-x-hidden max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-jman-midnight dark:text-foreground">Solutions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Initial scores are based on your data structure — run an analysis to get actual findings</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {Object.entries(runErrors).map(([key, msg]) => (
            <span key={key} className="text-xs text-red-600">{key}: {msg}</span>
          ))}
          <button
            data-tour="run-analysis"
            disabled={selectedFlows.size === 0 || isLaunching}
            onClick={runSelected}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand text-brand-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {isLaunching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {selectedFlows.size > 0 ? `Run selected (${selectedFlows.size})` : "Run analyses"}
          </button>
          {selectedFlows.size === 0 && !planLoading && !planError && (
            <span className="text-[11px] text-muted-foreground">Click cards below to select</span>
          )}
        </div>
      </div>

      {/* Cards */}
      {planLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : planError || !plan ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-red-600">
          {planErrorMsg ?? "Could not analyse the datasets."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...plan.flows]
            .sort((a: any, b: any) => {
              // Completed runs are promoted above unrun flows — their rank is based on actual analysis, not a signal scan.
              const aAnalysed = lastRunByFlow[a.key]?.status === "completed" ? 1 : 0;
              const bAnalysed = lastRunByFlow[b.key]?.status === "completed" ? 1 : 0;
              if (aAnalysed !== bAnalysed) return bAnalysed - aAnalysed;
              // Within the same tier (both analysed or both unrun): order by feasibility signal score.
              return (b.feasibility?.score ?? 0) - (a.feasibility?.score ?? 0);
            })
            .map((f: any, i: number) => {
            const verdict: string = f.feasibility?.verdict ?? "";
            const available = verdict === "strong" || verdict === "possible";
            const cfg: FlowConfig = FLOW_CONFIG[f.key] ?? FLOW_CONFIG.churn;
            const Icon = cfg.icon;
            const rankColors = ["bg-amber-400 text-white", "bg-slate-400 text-white", "bg-orange-400 text-white"];
            const isAnalysed = lastRunByFlow[f.key]?.status === "completed";
            // Medal emojis only after actual analysis; unrun cards show "~N" to signal this is an estimate.
            const rankLabel = isAnalysed
              ? (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`)
              : `~${i + 1}`;

            const isSelected = selectedFlows.has(f.key);
            const flowRuns: any[] = runsByFlow[f.key] ?? [];

            const sharedClass = cn(
              "relative overflow-hidden rounded-2xl border border-border bg-white dark:bg-card p-5 flex flex-col gap-3",
              "transition-all duration-300 hover:-translate-y-1",
              available
                ? "shadow-[0_2px_12px_0_rgba(0,0,0,0.07)] hover:shadow-[0_6px_20px_0_rgba(0,0,0,0.11)]"
                : "opacity-50 grayscale shadow-sm",
              isSelected && "ring-2 ring-brand ring-offset-1"
            );

            const cardTop = (
              <>
                {/* Watermark icon */}
                <Icon className={cn("absolute -bottom-3 -right-3 w-20 h-20 opacity-[0.08]", cfg.watermarkColor)} strokeWidth={1.5} />

                {/* Selection checkbox — available flows only */}
                {available && (
                  <div
                    onClick={e => { e.stopPropagation(); toggleFlow(f.key); }}
                    className={cn(
                      "absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-150 cursor-pointer z-10",
                      isSelected ? "bg-brand border-brand shadow-sm" : "bg-white/70 dark:bg-white/20 border-black/20 hover:border-brand/60"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                )}

                {/* Rank badge */}
                <div className={cn(
                  "absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shadow-sm",
                  !available
                    ? "bg-muted text-muted-foreground"
                    : isAnalysed && i < 3 ? rankColors[i]
                    : isAnalysed ? "bg-white/60 text-foreground"
                    : "bg-black/10 dark:bg-white/10 text-muted-foreground italic"
                )}>
                  {rankLabel}
                </div>

                {/* Icon badge */}
                <div className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm",
                  available ? `bg-gradient-to-br ${cfg.iconGradient}` : "bg-muted"
                )}>
                  {available
                    ? <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                    : <Lock className="w-4 h-4 text-muted-foreground" />}
                </div>

                {/* Label + verdict */}
                <div className="flex-1">
                  <div className="font-semibold text-sm text-foreground leading-tight">{f.category}</div>
                  {isAnalysed ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                      <span className="text-xs font-semibold text-brand">Analysed</span>
                    </div>
                  ) : available ? (
                    <>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          {SIGNAL_LABEL[verdict] ?? "Signals found"}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 mt-0.5 block leading-tight">
                        estimate · run to confirm
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground mt-1 block">Not detected</span>
                  )}
                </div>

                {/* Runs list */}
                {flowRuns.length > 0 && (
                  <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1">
                    {flowRuns.map((r: any) => {
                      const running = r.status === "running" || r.status === "pending";
                      return (
                        <div key={r.id} className="flex items-center gap-1 group/row">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.replace(`/workspaces/${workspaceId}/ds-flows?run=${r.id}`); }}
                            className="flex-1 flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors min-w-0"
                          >
                            {running
                              ? <Loader2 className="w-3 h-3 animate-spin text-brand flex-shrink-0" />
                              : <StatusPill status={r.status} />}
                            <span className="text-[10px] text-muted-foreground truncate">{timeAgo(r.created_at)}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover/row:opacity-100 flex-shrink-0 transition-opacity" />
                          </button>
                          <button
                            onClick={(e) => deleteRun(e, r.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex-shrink-0"
                            title="Delete run"
                          >
                            {deletingRunId === r.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );

            // Cards with runs: clicking the card body navigates to the latest run; run rows handle their own nav
            return flowRuns.length > 0 ? (
              <div
                key={f.key}
                onClick={() => router.replace(`/workspaces/${workspaceId}/ds-flows?run=${flowRuns[0].id}`)}
                className={cn(sharedClass, "cursor-pointer")}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {cardTop}
              </div>
            ) : available ? (
              <div
                key={f.key}
                onClick={() => toggleFlow(f.key)}
                className={cn(sharedClass, "cursor-pointer")}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {cardTop}
              </div>
            ) : (
              <div key={f.key} className={sharedClass} style={{ animationDelay: `${i * 60}ms` }}>
                {cardTop}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
