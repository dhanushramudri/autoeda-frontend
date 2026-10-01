"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, CheckCircle2, DollarSign, Loader2, Lock, Play, TrendingDown, TrendingUp, Zap, type LucideIcon } from "lucide-react";

import { dsFlowsApi } from "@/lib/api";
import { useTour } from "@/hooks/useTourContext";
import { solutionsTour } from "@/lib/tourSteps";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { FlowWorkspace, type FlowRunFull } from "@/components/ds-flows/FlowWorkspace";
import { ChurnDashboard } from "@/components/ds-flows/ChurnDashboard";

/* eslint-disable @typescript-eslint/no-explicit-any */
const VERDICT_LABEL: Record<string, string> = { strong: "Strong fit", possible: "Possible fit", weak: "Weak fit", not_detected: "Not detected" };

type FlowConfig = { icon: LucideIcon; gradient: string; iconGradient: string; glow: string; watermarkColor: string };
const FLOW_CONFIG: Record<string, FlowConfig> = {
  churn:           { icon: TrendingDown, gradient: "from-rose-50 via-pink-50 to-fuchsia-50 border-rose-200",     iconGradient: "from-rose-500 to-pink-600",     glow: "shadow-rose-200",    watermarkColor: "text-rose-300" },
  revenue_growth:  { icon: TrendingUp,   gradient: "from-emerald-50 via-green-50 to-teal-50 border-emerald-200", iconGradient: "from-emerald-500 to-teal-600",  glow: "shadow-emerald-200", watermarkColor: "text-emerald-300" },
  forecasting:     { icon: BarChart3,    gradient: "from-blue-50 via-sky-50 to-indigo-50 border-blue-200",       iconGradient: "from-blue-500 to-indigo-600",   glow: "shadow-blue-200",    watermarkColor: "text-blue-300" },
  pricing:         { icon: DollarSign,   gradient: "from-amber-50 via-yellow-50 to-orange-50 border-amber-200",  iconGradient: "from-amber-400 to-orange-500",  glow: "shadow-amber-200",   watermarkColor: "text-amber-300" },
  efficiency_cost: { icon: Zap,          gradient: "from-violet-50 via-purple-50 to-indigo-50 border-violet-200",iconGradient: "from-violet-500 to-purple-600", glow: "shadow-violet-200",  watermarkColor: "text-violet-300" },
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
  const [startError, setStartError] = useState<string | null>(null);
  // finished runs open on the executive dashboard; "Analysis" is the full technical workspace
  const [viewPick, setViewPick] = useState<"dashboard" | "analysis" | null>(null);
  useEffect(() => setViewPick(null), [activeRunId]);
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

  const startMutation = useMutation({
    mutationFn: () => dsFlowsApi.startRun(workspaceId, "churn"),
    onMutate: () => setStartError(null),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["ds-flow-runs", workspaceId] });
      router.replace(`/workspaces/${workspaceId}/ds-flows?run=${d.run_id}`);
    },
    onError: (e: any) => setStartError(errMsg(e, "Could not start the run")),
  });

  /* ---------------- run view ---------------- */
  if (activeRunId != null) {
    return (
      <div className="px-3 py-2 space-y-2">
        <button onClick={() => router.replace(`/workspaces/${workspaceId}/ds-flows`)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> All flows
        </button>
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
            {run.status === "completed" && run.headline && (
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
            {run.status === "completed" && run.headline && (viewPick ?? "dashboard") === "dashboard"
              ? <ChurnDashboard run={run} workspaceId={workspaceId} onAnalysis={() => setViewPick("analysis")} />
              : <FlowWorkspace run={run} workspaceId={workspaceId} />}
          </>
        )}
      </div>
    );
  }

  /* ---------------- start view ---------------- */
  const planErrorMsg = planError ? errMsg(planError, "Could not analyse the datasets") : undefined;

  return (
    <div className="px-6 py-6 space-y-6 min-w-0 overflow-x-hidden max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-jman-midnight dark:text-foreground">Solutions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Which analyses your data can support</p>
        </div>
        {plan?.runnable && (
          <div className="flex flex-col items-end gap-1">
            {startError && <span className="text-xs text-red-600">{startError}</span>}
            <button
              data-tour="run-analysis"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand text-brand-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Churn Analysis
            </button>
          </div>
        )}
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
          {plan.flows.map((f: any, i: number) => {
            const verdict: string = f.feasibility?.verdict ?? "";
            // Show as available when the data scan finds a strong or possible fit —
            // regardless of whether the flow's run pipeline is built yet.
            const available = verdict === "strong" || verdict === "possible";
            const cfg: FlowConfig = FLOW_CONFIG[f.key] ?? FLOW_CONFIG.churn;
            const Icon = cfg.icon;

            return (
              <div
                key={f.key}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3",
                  "transition-all duration-300 hover:-translate-y-1",
                  available
                    ? `bg-gradient-to-br ${cfg.gradient} shadow-md hover:shadow-lg ${cfg.glow}`
                    : "bg-card border-border opacity-50 grayscale"
                )}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Watermark icon */}
                <Icon className={cn("absolute -bottom-3 -right-3 w-20 h-20 opacity-[0.08]", cfg.watermarkColor)} strokeWidth={1.5} />

                {/* Icon badge */}
                <div className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm",
                  available ? `bg-gradient-to-br ${cfg.iconGradient}` : "bg-muted"
                )}>
                  {available
                    ? <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                    : <Lock className="w-4 h-4 text-muted-foreground" />}
                </div>

                {/* Label */}
                <div>
                  <div className="font-semibold text-sm text-foreground leading-tight">{f.category}</div>
                  {available ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {VERDICT_LABEL[verdict] ?? "Detectable"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground mt-1 block">Coming soon</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
