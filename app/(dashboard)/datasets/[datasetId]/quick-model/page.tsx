"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { datasetsApi, jobsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageSpinner } from "@/components/shared/LoadingBar";
import {
  FlaskConical, Play, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Clock3, Target,
} from "lucide-react";

interface QuickModelResult {
  task_type: "classification" | "regression";
  target: string;
  n_train: number;
  n_test: number;
  elapsed_seconds: number;
  accuracy?: number;
  f1_macro?: number;
  r2?: number;
  rmse?: number;
  classes?: string[];
  sample_predictions: { actual: unknown; predicted: unknown }[];
}

interface JobStatus {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message?: string;
  result_data?: QuickModelResult | null;
}

export default function QuickModelPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [target, setTarget] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const columns: { name: string }[] = profile?.columns ?? [];

  useEffect(() => {
    if (!target && columns.length > 0) setTarget(columns[columns.length - 1].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length]);

  const startMutation = useMutation({
    mutationFn: () => datasetsApi.startQuickModel(datasetId, target).then((r) => r.data),
    onSuccess: (data) => {
      setJobId(data.job_id);
      setJob({ job_id: data.job_id, status: "pending", progress: 0, message: "Queued…" });
    },
  });

  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await jobsApi.get(jobId);
        setJob(res.data);
        if (res.data.status === "completed" || res.data.status === "failed") {
          clearInterval(pollRef.current!);
        }
      } catch { /* ignore transient poll errors */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  const isRunning = job && (job.status === "pending" || job.status === "running");
  const isDone = job?.status === "completed";
  const isFailed = job?.status === "failed";
  const result = job?.result_data;

  if (isLoading) return <><SubNav datasetId={datasetId} /><PageSpinner /></>;

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-4xl mx-auto">
        <Breadcrumb items={[{ label: "Datasets", href: "/workspaces" }, { label: "Quick Model" }]} />

        <div className="mt-4 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              Quick Model
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">EXPERIMENTAL</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              A zero-shot baseline via Google's TabFM — no training loop, just a number to beat.
            </p>
          </div>
        </div>

        {/* Warning box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 space-y-1">
            <p><strong>Research use only.</strong> TabFM's pretrained weights are under a non-commercial license — this is for internal capability evaluation, never for client deliverables or production paths.</p>
            <p><strong>Real constraints:</strong> classification targets are capped at 10 classes, and the model only ever sees ~100 training rows + 50 test rows (TabFM's own recommended context window) — this is not a full-dataset training run.</p>
            <p><strong>Slow on CPU.</strong> Loading the ~6.5GB model and running inference took ~18 minutes end-to-end in testing on a modest machine. Expect several minutes, not seconds.</p>
          </div>
        </div>

        {/* Target selector + run button */}
        {!jobId && (
          <div className="bg-card rounded-xl border border-border p-5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
              <Target className="w-3.5 h-3.5" /> Target column
            </label>
            <div className="flex items-center gap-3">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand bg-card"
              >
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => startMutation.mutate()}
                disabled={!target || startMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition"
              >
                {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" fill="currentColor" />}
                Run Quick Model
              </button>
            </div>
            {startMutation.error && (
              <p className="text-xs text-red-600 mt-2">
                {(startMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to start"}
              </p>
            )}
          </div>
        )}

        {/* Running state */}
        {isRunning && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Running…</p>
                <p className="text-xs text-muted-foreground mt-0.5">{job?.message}</p>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${Math.max(job?.progress ?? 0, 8)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5" /> This can take 10–20 minutes on CPU. You can navigate away — check back or watch the jobs bell icon.
            </p>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-2">
            <XCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm font-semibold text-red-700">Quick Model failed</p>
            <p className="text-xs text-red-600 font-mono">{job?.message}</p>
            <button onClick={() => { setJobId(null); setJob(null); }} className="text-xs text-brand hover:underline mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {isDone && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">
                Done in {result.elapsed_seconds.toFixed(1)}s — {result.task_type} baseline on target "{result.target}"
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Train rows" value={result.n_train.toLocaleString()} />
              <StatTile label="Test rows" value={result.n_test.toLocaleString()} />
              {result.task_type === "classification" ? (
                <>
                  <StatTile label="Accuracy" value={`${((result.accuracy ?? 0) * 100).toFixed(1)}%`} highlight />
                  <StatTile label="F1 (macro)" value={(result.f1_macro ?? 0).toFixed(3)} />
                </>
              ) : (
                <>
                  <StatTile label="R²" value={(result.r2 ?? 0).toFixed(3)} highlight />
                  <StatTile label="RMSE" value={(result.rmse ?? 0).toFixed(3)} />
                </>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground">Sample predictions</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Actual</th>
                    <th className="text-left px-4 py-2">Predicted</th>
                    <th className="text-left px-4 py-2">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.sample_predictions.map((p, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-mono text-foreground">{String(p.actual)}</td>
                      <td className="px-4 py-2 font-mono text-foreground">{String(p.predicted)}</td>
                      <td className="px-4 py-2">
                        {String(p.actual) === String(p.predicted)
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          : <XCircle className="w-3.5 h-3.5 text-muted-foreground/60" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => { setJobId(null); setJob(null); }}
              className="text-xs text-brand hover:underline"
            >
              Run on a different target
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl px-4 py-3 ${highlight ? "border-amber-300 bg-amber-50/50" : "border-border"}`}>
      <div className={`text-lg font-bold tabular-nums ${highlight ? "text-amber-700" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
