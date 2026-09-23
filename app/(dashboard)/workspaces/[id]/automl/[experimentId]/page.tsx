"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { experimentsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { cn } from "@/lib/utils";
import type { Experiment, ExperimentRun } from "@/types";
import {
  ArrowLeft, Cpu, Loader2, CheckCircle2, XCircle, Clock3, Download, Trash2, Trophy, Sparkles, Wand2,
} from "lucide-react";

const STATUS_CFG: Record<Experiment["status"], { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  queued: { label: "Waiting for your laptop", cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400", icon: Clock3 },
  running: { label: "Training", cls: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400", icon: Loader2 },
  completed: { label: "Completed", cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  failed: { label: "Failed", cls: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400", icon: XCircle },
};

const CLASSIFICATION_METRICS: [string, string][] = [["accuracy", "Accuracy"], ["precision", "Precision"], ["recall", "Recall"], ["f1", "F1"]];
const REGRESSION_METRICS: [string, string][] = [["r2", "R²"], ["rmse", "RMSE"], ["mae", "MAE"]];

function primaryMetricKey(exp: Experiment): string {
  const isRegression = exp.problem_type === "regression" || exp.runs.some((r) => "r2" in (r.metrics || {}));
  return isRegression ? "r2" : "accuracy";
}

function sortedRuns(exp: Experiment): ExperimentRun[] {
  const key = primaryMetricKey(exp);
  return [...exp.runs].sort((a, b) => {
    if (a.status !== "completed") return 1;
    if (b.status !== "completed") return -1;
    return (b.metrics?.[key] ?? -Infinity) - (a.metrics?.[key] ?? -Infinity);
  });
}

function formatMetric(key: string, value: number | undefined): string {
  if (value == null) return "—";
  if (key === "accuracy" || key === "precision" || key === "recall" || key === "f1") return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(3);
}

function DownloadButton({ experimentId, run }: { experimentId: number; run: ExperimentRun }) {
  const download = useMutation({
    mutationFn: () => experimentsApi.downloadArtifact(experimentId, run.id),
    onSuccess: (res) => {
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = run.artifact_filename || `${run.algorithm}.joblib`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
  if (!run.has_artifact) return null;
  return (
    <button
      onClick={() => download.mutate()}
      disabled={download.isPending}
      title="Download trained model"
      className="p-1.5 text-muted-foreground hover:text-brand transition disabled:opacity-50"
    >
      {download.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
    </button>
  );
}

export default function ExperimentDetailPage() {
  const { id: workspaceId, experimentId } = useParams<{ id: string; experimentId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const expId = Number(experimentId);

  const { data: exp, isLoading } = useQuery<Experiment>({
    queryKey: queryKeys.experiments.detail(expId),
    queryFn: () => experimentsApi.get(expId).then((r) => r.data),
    refetchInterval: (query) =>
      query.state.data && (query.state.data.status === "queued" || query.state.data.status === "running") ? 3000 : false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => experimentsApi.delete(expId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.list(workspaceId) });
      router.push(`/workspaces/${workspaceId}/automl`);
    },
  });

  if (isLoading || !exp) return <div className="p-6 max-w-4xl mx-auto"><PageSpinner /></div>;

  const cfg = STATUS_CFG[exp.status];
  const StatusIcon = cfg.icon;
  const isRegression = exp.problem_type === "regression" || exp.runs.some((r) => "r2" in (r.metrics || {}));
  const metricCols = isRegression ? REGRESSION_METRICS : CLASSIFICATION_METRICS;
  const runs = sortedRuns(exp);
  const primaryKey = primaryMetricKey(exp);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push(`/workspaces/${workspaceId}/automl`)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to AutoML
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
            <Cpu className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-1.5">
              {exp.name}
              {exp.auto_planned && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400">
                  <Sparkles className="w-2.5 h-2.5" /> auto
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exp.dataset_name ?? `Dataset #${exp.dataset_id}`} · target <code className="text-[11px]">{exp.target_column}</code>
              {exp.created_by_name && ` · queued by ${exp.created_by_name}`}
            </p>
            {exp.excluded_columns.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Excluded {exp.excluded_columns.length} column{exp.excluded_columns.length === 1 ? "" : "s"}:{" "}
                <span className="font-mono">{exp.excluded_columns.join(", ")}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold", cfg.cls)}>
            <StatusIcon className={cn("w-3 h-3", exp.status === "running" && "animate-spin")} /> {cfg.label}
          </span>
          <button
            onClick={() => confirm(`Delete experiment "${exp.name}"?`) && deleteMutation.mutate()}
            className="p-1.5 text-muted-foreground/50 hover:text-red-500 transition"
            title="Delete experiment"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {exp.rationale && (
        <div className="bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-xl p-4 mb-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-400 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Why this dataset and target
          </p>
          <p className="text-sm text-violet-900 dark:text-violet-200">{exp.rationale}</p>
        </div>
      )}

      {exp.engineered_features.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            <Wand2 className="w-3.5 h-3.5" /> Engineered features
          </p>
          <ul className="space-y-1.5">
            {exp.engineered_features.map((f, i) => (
              <li key={i} className="text-xs text-foreground">
                <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{f.output}</code>
                <span className="text-muted-foreground"> — {f.tool}({Object.values(f.args).join(", ")})</span>
                {f.reason && <span className="text-muted-foreground"> · {f.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {exp.status === "queued" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 text-sm text-amber-800 dark:text-amber-300">
          Waiting for your local agent to pick this up — start it with the command on the AutoML page if it isn't
          already running. This page updates automatically once training starts.
        </div>
      )}

      {exp.status === "failed" && exp.error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 text-sm text-red-700 dark:text-red-400 font-mono">
          {exp.error}
        </div>
      )}

      {runs.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground">Leaderboard</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-4 py-2">Algorithm</th>
                {metricCols.map(([key, label]) => (
                  <th key={key} className="text-left px-4 py-2">{label}</th>
                ))}
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run, i) => (
                <tr key={run.id} className={cn(run.status === "failed" && "opacity-50")}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <span className="flex items-center gap-1.5">
                      {i === 0 && run.status === "completed" && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                      {run.algorithm}
                    </span>
                    {run.status === "failed" && <p className="text-[10px] text-red-500 font-mono mt-0.5">{run.error}</p>}
                  </td>
                  {run.status === "completed" ? (
                    metricCols.map(([key]) => (
                      <td key={key} className={cn("px-4 py-3 font-mono", key === primaryKey && "font-bold text-foreground")}>
                        {formatMetric(key, run.metrics?.[key])}
                      </td>
                    ))
                  ) : (
                    <td colSpan={metricCols.length} className="px-4 py-3 text-muted-foreground">failed</td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {run.training_seconds != null ? `${run.training_seconds.toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DownloadButton experimentId={exp.id} run={run} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {exp.status === "running" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Training in progress on your laptop — this list fills in
          as each algorithm finishes.
        </p>
      )}
    </div>
  );
}
