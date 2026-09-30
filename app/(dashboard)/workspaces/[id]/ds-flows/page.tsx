"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, History, Loader2, Lock, Play, Trash2, TrendingDown, Workflow } from "lucide-react";
import { dsFlowsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FlowWorkspace, type FlowRunFull } from "@/components/ds-flows/FlowWorkspace";

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
      <div className="px-3 py-2 space-y-2">
        <button onClick={() => router.replace(`/workspaces/${workspaceId}/ds-flows`)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> All flows
        </button>
        {!run ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground">{run.title}</h1>
              <StatusPill status={run.status} />
            </div>
            {run.status === "error" && run.error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">{run.error}</div>
            )}
            <FlowWorkspace run={run} workspaceId={workspaceId} />
          </>
        )}
      </div>
    );
  }

  /* ---------------- start view ---------------- */
  const label = plan?.label;
  const tables: any[] = plan?.tables ?? [];
  const planErrorMsg = planError ? errMsg(planError, "Could not analyse the datasets") : undefined;
  const PHASE_NAMES = ["Discover & link", "Data checks", "Explore (EDA)", "Hypotheses", "Features", "Modeling", "Explain", "Validate", "Business impact", "Deliverables"];
  const ROLE_STYLE: Record<string, string> = { base: "bg-brand/10 text-brand", events: "bg-[#ff6196]/10 text-[#d6336c]", dictionary: "bg-muted text-muted-foreground", other: "bg-muted text-muted-foreground" };

  return (
    <div className="px-3 py-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Workflow className="w-5 h-5 text-brand" /><h1 className="text-xl font-bold text-foreground">Data Science Flows</h1></div>
        <div className="flex items-center gap-3">
          {startError && <span className="text-xs text-red-600">{startError}</span>}
          <button disabled={!plan?.runnable || startMutation.isPending} onClick={() => startMutation.mutate()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand text-brand-foreground disabled:opacity-50 hover:opacity-90">
            {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run churn analysis
          </button>
        </div>
      </div>

      {planLoading ? (
        <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-2.5 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Analysing your datasets…</div>
      ) : planError || !plan ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-red-600">{planErrorMsg ?? "Could not analyse the datasets."}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {plan.flows.map((f: any) => {
              const available = f.status === "available";
              return (
                <div key={f.key} className={cn("rounded-xl border p-3.5", available ? "bg-brand text-brand-foreground border-brand" : "bg-card border-border")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm font-semibold", !available && "text-foreground")}>{f.category}</span>
                    {!available && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", available ? "bg-white/20" : VERDICT_STYLE[f.feasibility.verdict])}>{VERDICT_LABEL[f.feasibility.verdict]}</span>
                    {!available && <span className="text-[10px] text-muted-foreground">coming soon</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Outcome found</h2>
              {plan.runnable && label ? (
                <>
                  <div className="text-xs text-muted-foreground mb-3"><span className="font-medium text-foreground">{label.column}</span> in <span className="font-medium text-foreground">{plan.base_table}</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    {[["Churned", label.counts?.churned, "text-[#ff6196]"], ["Retained", label.counts?.retained, "text-foreground"], ["Open", label.counts?.open, "text-brand"]].map(([t, v, c]: any) => (
                      <div key={t} className="rounded-lg bg-muted/60 p-2.5"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t}</div><div className={cn("text-lg font-bold", c)}>{(v ?? 0).toLocaleString()}</div></div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-[#d6336c]">{plan.reason ?? "Churn analysis needs a churn outcome in at least one dataset."}</p>}
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Data used{plan.link_key ? <span className="text-xs font-normal text-muted-foreground"> · linked on {plan.link_key}</span> : null}</h2>
              <ul className="space-y-1.5">
                {tables.map((t) => (
                  <li key={t.name} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="text-muted-foreground">{t.rows.toLocaleString()} rows</span>
                    <span className={cn("ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase", ROLE_STYLE[t.role] ?? ROLE_STYLE.other)}>{t.role}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">The run covers</h2>
              <div className="flex flex-wrap gap-1.5">
                {PHASE_NAMES.map((n, i) => <span key={n} className="px-2.5 py-1 rounded-full bg-muted/70 text-xs text-foreground"><span className="text-brand font-semibold">{i + 1}</span> {n}</span>)}
              </div>
            </div>
          </div>
        </>
      )}

      {runs && runs.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Runs</h2><span className="text-xs text-muted-foreground">{runs.length}</span></div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="px-4 py-2 font-semibold">Run</th><th className="py-2 font-semibold">Started</th><th className="py-2 font-semibold">AUC</th><th className="py-2 font-semibold">High-risk accounts</th><th className="py-2 font-semibold">Status</th><th className="w-10" /></tr></thead>
            <tbody>
              {runs.map((r: any) => (
                <tr key={r.id} onClick={() => router.replace(`/workspaces/${workspaceId}/ds-flows?run=${r.id}`)} className="border-b border-border/60 last:border-0 hover:bg-muted/40 cursor-pointer">
                  <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2 font-medium text-foreground"><TrendingDown className="w-3.5 h-3.5 text-brand" />{r.title}</span></td>
                  <td className="py-2.5 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2.5 text-foreground">{r.headline?.roc_auc != null ? r.headline.roc_auc.toFixed(2) : "—"}</td>
                  <td className="py-2.5 text-foreground">{r.headline?.high_risk_accounts != null ? r.headline.high_risk_accounts.toLocaleString() : "—"}</td>
                  <td className="py-2.5"><StatusPill status={r.status} />{(r.status === "running" || r.status === "pending") && <span className="ml-2 text-muted-foreground">{r.progress.done}/{r.progress.total}</span>}</td>
                  <td className="pr-3 text-right"><button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.id); }} className="p-1.5 text-muted-foreground hover:text-red-500" title="Delete run"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
