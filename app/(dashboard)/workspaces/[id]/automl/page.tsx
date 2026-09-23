"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, experimentsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { Experiment } from "@/types";
import {
  Cpu, Loader2, CheckCircle2, XCircle, Clock3, Terminal, ChevronDown,
  Download, Copy, Check, Sparkles,
} from "lucide-react";

const STATUS_CFG: Record<Experiment["status"], { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  queued: { label: "Waiting for your laptop", cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400", icon: Clock3 },
  running: { label: "Training", cls: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400", icon: Loader2 },
  completed: { label: "Completed", cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  failed: { label: "Failed", cls: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400", icon: XCircle },
};

function bestMetricLabel(exp: Experiment): string | null {
  const ok = exp.runs.filter((r) => r.status === "completed");
  if (ok.length === 0) return null;
  const isRegression = exp.problem_type === "regression" || "r2" in (ok[0].metrics || {});
  const key = isRegression ? "r2" : "accuracy";
  const best = ok.reduce((a, b) => ((b.metrics?.[key] ?? -Infinity) > (a.metrics?.[key] ?? -Infinity) ? b : a));
  const val = best.metrics?.[key];
  if (val == null) return null;
  return `${best.algorithm} — ${isRegression ? "R² " : "acc "}${isRegression ? val.toFixed(3) : `${(val * 100).toFixed(1)}%`}`;
}

function AgentSetup() {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const user = useAuthStore((s) => s.user);

  // NEXT_PUBLIC_API_URL is only ever baked in for some deployments — when
  // it's missing (local dev, most of the time) the backend is still
  // reachable at the same host the browser is on, just on port 8000 (see
  // docker-compose.yml / the backend Dockerfile's EXPOSE). Deriving it from
  // window.location means this never shows a placeholder the user has to
  // fill in themselves — computed client-side only, to avoid an SSR/
  // hydration mismatch on first render.
  //
  // "localhost" needs one more translation: this URL is for the AGENT,
  // which runs inside its own Docker container — there, "localhost" means
  // the container itself, not the host machine. Docker Desktop's
  // host.docker.internal is the container's name for "the machine it's
  // running on", so that's what has to go in the command instead.
  const [guessedApiUrl, setGuessedApiUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const dockerHost = host === "localhost" || host === "127.0.0.1" ? "host.docker.internal" : host;
      setGuessedApiUrl(`http://${dockerHost}:8000/api/v1`);
    }
  }, []);
  const apiUrl = API_BASE.startsWith("http") ? API_BASE : guessedApiUrl;
  const email = user?.email ?? "YOUR_LOGIN_EMAIL";
  // One command per line, no backslash line-continuations — those differ
  // between PowerShell/cmd.exe/bash, but pasting several plain lines into
  // an interactive terminal runs each one in sequence regardless of shell.
  // No password — AutoEDA accounts are email-only, same as the web login.
  const cmd = `docker build -t autoeda-agent .\ndocker run --rm --add-host=host.docker.internal:host-gateway -e AUTOEDA_API_URL="${apiUrl}" -e AUTOEDA_EMAIL="${email}" autoeda-agent`;

  const downloadMutation = useMutation({
    mutationFn: () => experimentsApi.downloadAgent(),
    onSuccess: (res) => {
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "autoeda-agent.zip";
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const copyCommand = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-border rounded-xl mb-6 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition"
      >
        <Terminal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">
          Set up training on your computer <span className="text-muted-foreground font-normal">(one-time, ~5 minutes)</span>
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Model training uses your computer's power instead of the cloud, so it costs nothing to run. You do this
            once, then leave it running in the background — every experiment gets picked up automatically.
          </p>

          <div className="space-y-3">
            <div className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center mt-0.5">1</span>
              <p className="text-xs text-foreground">
                Install <strong>Docker Desktop</strong> — a free app, only needed once on this computer.{" "}
                <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  Download it here
                </a>. Already installed? Skip to step 2.
              </p>
            </div>

            <div className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center mt-0.5">2</span>
              <div className="flex-1">
                <p className="text-xs text-foreground mb-2">Download and unzip this folder:</p>
                <button
                  onClick={() => downloadMutation.mutate()}
                  disabled={downloadMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/70 text-foreground text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {downloadMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download agent (.zip)
                </button>
              </div>
            </div>

            <div className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center mt-0.5">3</span>
              <p className="text-xs text-foreground">
                Open the unzipped <code className="text-[11px] bg-muted px-1 py-0.5 rounded">autoeda-agent</code> folder, then open a terminal
                there: on Windows, right-click inside the folder and choose <strong>"Open in Terminal"</strong>; on
                Mac, right-click and choose <strong>"New Terminal at Folder"</strong>.
              </p>
            </div>

            <div className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center mt-0.5">4</span>
              <p className="text-xs text-foreground">
                Copy the two lines below and paste them into the terminal, then press Enter. The first line takes a
                few minutes the first time.
              </p>
            </div>
          </div>

          <div className="relative">
            <pre className="bg-muted rounded-lg p-3 pr-12 text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre">{cmd}</pre>
            <button
              onClick={copyCommand}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-card border border-border rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground transition"
            >
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            The first run downloads everything it needs (a couple minutes). After that, leave the terminal window
            open — that's it, you're set up. Trigger the discovery below and watch it train.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AutoMlPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [planError, setPlanError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const { data: experiments, isLoading } = useQuery<Experiment[]>({
    queryKey: queryKeys.experiments.list(workspaceId),
    queryFn: () => experimentsApi.list(workspaceId).then((r) => r.data),
    refetchInterval: (query) =>
      query.state.data?.some((e) => e.status === "queued" || e.status === "running") ? 3000 : false,
  });

  const autoMutation = useMutation({
    mutationFn: () => experimentsApi.createAuto(workspaceId),
    onSuccess: (res) => {
      setPlanError("");
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.list(workspaceId) });
      router.push(`/workspaces/${workspaceId}/automl/${res.data.id}`);
    },
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPlanError(detail ?? "Couldn't plan an experiment — try again in a moment.");
    },
  });

  // A single LLM call profiling multiple datasets can genuinely take
  // 30-70s — a static spinner with no elapsed time reads as "stuck" well
  // before it actually is.
  useEffect(() => {
    if (!autoMutation.isPending) { setElapsed(0); return; }
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [autoMutation.isPending]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
          <Cpu className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
        </div>
        <h1 className="text-xl font-bold text-foreground">AutoML</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        No dataset or target to pick — it looks at this workspace's own EDA profiles and validated Hypotheses,
        decides what's actually worth predicting, engineers a few features, and trains real models — Logistic
        Regression, Naive Bayes, Random Forest, Gradient Boosting, SVM, CatBoost — on your laptop via the local
        agent, so it never touches the cloud bill.
      </p>

      <AgentSetup />

      <button
        onClick={() => autoMutation.mutate()}
        disabled={autoMutation.isPending}
        className="flex items-center gap-2 px-5 py-3 bg-brand text-white text-sm font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 mb-2"
      >
        {autoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {autoMutation.isPending ? `Thinking about what's worth predicting… (${elapsed}s)` : "Discover & Train"}
      </button>
      {autoMutation.isPending && (
        <p className="text-[11px] text-muted-foreground mb-4">
          Profiling datasets and checking validated hypotheses, then asking the AI to plan — this can take up to a
          minute on a wide dataset.
        </p>
      )}
      {planError && <p className="text-xs text-red-600 dark:text-red-400 mb-4">{planError}</p>}
      <div className="mb-6" />

      {isLoading ? (
        <PageSpinner />
      ) : !experiments || experiments.length === 0 ? (
        <EmptyState
          icon={<Cpu className="w-12 h-12" />}
          title="No experiments yet"
          description="Click Discover & Train above — it picks the dataset, target, and features itself."
        />
      ) : (
        <div className="space-y-3">
          {experiments.map((exp) => {
            const cfg = STATUS_CFG[exp.status];
            const Icon = cfg.icon;
            const best = bestMetricLabel(exp);
            return (
              <button
                key={exp.id}
                onClick={() => router.push(`/workspaces/${workspaceId}/automl/${exp.id}`)}
                className="w-full text-left bg-card border border-border rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                      {exp.name}
                      {exp.auto_planned && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 flex-shrink-0">
                          <Sparkles className="w-2.5 h-2.5" /> auto
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {exp.dataset_name ?? `Dataset #${exp.dataset_id}`} · target <code className="text-[11px]">{exp.target_column}</code>
                    </p>
                  </div>
                  <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0", cfg.cls)}>
                    <Icon className={cn("w-3 h-3", exp.status === "running" && "animate-spin")} /> {cfg.label}
                  </span>
                </div>
                {best && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">Best so far: {best}</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
