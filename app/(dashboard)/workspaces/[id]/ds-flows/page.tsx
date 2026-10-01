"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Lock, Play, TrendingDown } from "lucide-react";
import { dsFlowsApi } from "@/lib/api";
import { useTour } from "@/hooks/useTourContext";
import { solutionsTour } from "@/lib/tourSteps";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { FlowWorkspace, type FlowRunFull } from "@/components/ds-flows/FlowWorkspace";
import { ChurnDashboard } from "@/components/ds-flows/ChurnDashboard";

/* eslint-disable @typescript-eslint/no-explicit-any */
const VERDICT_STYLE: Record<string, string> = {
  strong: "bg-brand/10 text-brand",
  possible: "bg-[#ff6196]/10 text-[#C30D5C]",
  weak: "bg-muted text-muted-foreground",
  not_detected: "bg-muted text-muted-foreground",
};
const VERDICT_LABEL: Record<string, string> = { strong: "Strong fit", possible: "Possible fit", weak: "Weak fit", not_detected: "No fit" };

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

  // Last completed run per flow key (for inline card summary)
  const lastRunByFlow: Record<string, any> = {};
  (runs ?? []).forEach((r: any) => {
    if (!lastRunByFlow[r.flow_key] || new Date(r.created_at) > new Date(lastRunByFlow[r.flow_key].created_at)) {
      lastRunByFlow[r.flow_key] = r;
    }
  });

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : planError || !plan ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-red-600">
          {planErrorMsg ?? "Could not analyse the datasets."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plan.flows.map((f: any) => {
            const available = f.status === "available";
            const verdict: string = f.feasibility?.verdict ?? "";
            const lastRun = lastRunByFlow[f.key];
            const h = lastRun?.headline ?? {};
            const hasResult = lastRun?.status === "completed" && h.roc_auc != null;
            const isActive = lastRun?.status === "running" || lastRun?.status === "pending";

            return (
              <div
                key={f.key}
                className={cn(
                  "rounded-2xl border p-5 flex flex-col gap-4 transition-shadow",
                  available
                    ? "bg-card border-brand/40 shadow-sm"
                    : "bg-card border-border opacity-60"
                )}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {available ? (
                        <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                      ) : (
                        <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-base font-semibold text-foreground">{f.category}</span>
                    </div>
                    {available ? (
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", VERDICT_STYLE[verdict] ?? VERDICT_STYLE.weak)}>
                        {VERDICT_LABEL[verdict] ?? verdict}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Coming soon</span>
                    )}
                  </div>
                  {available && (
                    <span className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                      <TrendingDown className="w-4 h-4 text-brand" />
                    </span>
                  )}
                </div>

                {/* Run result inline */}
                {available && (
                  <div className="border-t border-border pt-3">
                    {isActive && (
                      <div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                          <div className="h-full bg-brand transition-all" style={{ width: `${(lastRun.progress.done / Math.max(lastRun.progress.total, 1)) * 100}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">Running…</span>
                      </div>
                    )}
                    {hasResult && (
                      <button
                        onClick={() => router.replace(`/workspaces/${workspaceId}/ds-flows?run=${lastRun.id}`)}
                        className="group w-full flex items-center justify-between text-left"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-foreground">
                            AUC {h.roc_auc.toFixed(2)} · {(h.high_risk_accounts ?? 0).toLocaleString()} high-risk accounts
                          </div>
                          <div className="text-[11px] text-muted-foreground">{new Date(lastRun.created_at).toLocaleDateString()}</div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand whitespace-nowrap">
                          View results <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </button>
                    )}
                    {!isActive && !hasResult && !lastRun && (
                      <span className="text-xs text-muted-foreground">No runs yet</span>
                    )}
                    {lastRun?.status === "error" && (
                      <span className="text-xs text-red-500">Last run failed</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
