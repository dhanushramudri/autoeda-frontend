"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, History, Loader2, Lock, Play, Trash2, TrendingDown, Workflow } from "lucide-react";
import { dsFlowsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StageTimeline, type FlowStage } from "@/components/ds-flows/StageTimeline";
import { ChurnResults, type FlowRun } from "@/components/ds-flows/ChurnResults";

/* eslint-disable @typescript-eslint/no-explicit-any */
const VERDICT_STYLE: Record<string, string> = {
  strong: "bg-brand/10 text-brand",
  possible: "bg-[#ff6196]/10 text-[#d6336c]",
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
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase", cls)}>{status}</span>;
}

export default function DsFlowsPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const runParam = searchParams.get("run");
  const activeRunId = runParam ? Number(runParam) : null;
  const [startError, setStartError] = useState<string | null>(null);

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

  const { data: run } = useQuery<FlowRun & { stages: FlowStage[]; error: string | null }>({
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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dsFlowsApi.deleteRun(workspaceId, id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["ds-flow-runs", workspaceId] });
      if (id === activeRunId) router.replace(`/workspaces/${workspaceId}/ds-flows`);
    },
  });

  const running = run?.status === "pending" || run?.status === "running";

  /* ---------------- run view ---------------- */
  if (activeRunId != null) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-5">
        <button onClick={() => router.replace(`/workspaces/${workspaceId}/ds-flows`)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> All flows
        </button>
        {!run ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{run.title}</h1>
              <StatusPill status={run.status} />
            </div>
            {run.status === "error" && run.error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">{run.error}</div>
            )}
            {(running || run.status === "error" || !run.headline) && <StageTimeline stages={run.stages} />}
            {run.status === "completed" && run.headline && (
              <>
                <ChurnResults run={run} workspaceId={workspaceId} />
                <details className="bg-card border border-border rounded-xl">
                  <summary className="px-4 py-3 text-xs font-semibold text-foreground cursor-pointer">Stage log</summary>
                  <div className="p-3 pt-0"><StageTimeline stages={run.stages} compact /></div>
                </details>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  /* ---------------- start view ---------------- */
  const label = plan?.label;
  const linked = (plan?.tables ?? []).filter((t: any) => t.role === "events").map((t: any) => t.name);
  const churnFit = plan?.flows?.find((f: any) => f.key === "churn")?.feasibility;
  const planErrorMsg = planError ? errMsg(planError, "Could not analyse the datasets") : undefined;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Workflow className="w-5 h-5 text-brand" />
        <h1 className="text-2xl font-bold text-foreground">Data Science Flows</h1>
      </div>

      <section className="bg-card border border-border rounded-xl p-6">
        {planLoading ? (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Analysing your datasets…</div>
        ) : planError || !plan ? (
          <p className="text-sm text-red-600">{planErrorMsg ?? "Could not analyse the datasets."}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {plan.flows.map((f: any) => {
                const available = f.status === "available";
                return (
                  <span key={f.key} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
                    available ? "bg-brand text-brand-foreground border-brand" : "border-border text-muted-foreground")}>
                    {!available && <Lock className="w-3 h-3" />}{f.category}
                    <span className={cn("px-1.5 rounded-full text-[10px]", available ? "bg-white/20" : VERDICT_STYLE[f.feasibility.verdict])}>
                      {available ? VERDICT_LABEL[f.feasibility.verdict] : "soon"}
                    </span>
                  </span>
                );
              })}
            </div>

            {plan.runnable && label ? (
              <ul className="text-sm text-foreground space-y-1.5">
                <li>
                  <span className="text-muted-foreground">Outcome · </span>
                  <span className="font-medium">{label.column}</span> in <span className="font-medium">{plan.base_table}</span>
                </li>
                {linked.length > 0 && (
                  <li>
                    <span className="text-muted-foreground">Linked · </span>
                    <span className="font-medium">{linked.join(", ")}</span> on {plan.link_key}
                  </li>
                )}
                {churnFit?.signals?.[0] && <li className="text-xs text-muted-foreground">{churnFit.signals[0]}</li>}
              </ul>
            ) : (
              <p className="text-sm text-[#d6336c]">{plan.reason ?? "Churn analysis needs a churn outcome in at least one dataset."}</p>
            )}

            {startError && <p className="text-xs text-red-600">{startError}</p>}
            <button disabled={!plan.runnable || startMutation.isPending} onClick={() => startMutation.mutate()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-brand text-brand-foreground disabled:opacity-50 hover:opacity-90">
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run churn analysis
            </button>
          </div>
        )}
      </section>

      {runs && runs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2"><History className="w-4 h-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Runs</h2></div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {runs.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => router.replace(`/workspaces/${workspaceId}/ds-flows?run=${r.id}`)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{r.title}</span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleString()}
                    {r.headline?.roc_auc != null && ` · AUC ${r.headline.roc_auc.toFixed(2)} · ${r.headline.high_risk_accounts ?? 0} high-risk accounts`}
                    {(r.status === "running" || r.status === "pending") && ` · ${r.progress.done}/${r.progress.total} stages`}
                  </div>
                </button>
                <button onClick={() => deleteMutation.mutate(r.id)} className="p-1.5 text-muted-foreground hover:text-red-500" title="Delete run"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
