"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { autoEdaApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Markdown } from "@/components/shared/Markdown";
import { AutoEdaChat } from "@/components/auto-eda/AutoEdaChat";
import { cn } from "@/lib/utils";
import type { AutoEdaRun, AutoEdaWorklistItem } from "@/types";
import {
  Loader2, Sparkles, Download, Trash2, CheckCircle2, XCircle, Circle,
  AlertTriangle, Database, ChevronDown, FileSearch, Layers, MinusCircle,
  Pause, Play,
} from "lucide-react";

// Progress lives entirely in the DB (a background task drives the run,
// independent of this page being open) — polling is what makes the UI
// "live", not a persistent connection. 2.5s keeps it feeling responsive
// without hammering the API during a run that can take many minutes.
const POLL_INTERVAL_MS = 2500;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function WorklistItemRow({ item, index }: { item: AutoEdaWorklistItem; index: number }) {
  const icon =
    item.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> :
    item.status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 flex-shrink-0" /> :
    item.status === "error" ? <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /> :
    item.status === "skipped" ? <MinusCircle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" /> :
    <Circle className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />;
  return (
    <div className={cn("flex items-center gap-2 py-1.5 text-xs", item.status === "skipped" && "opacity-60")}>
      <span className="w-4 text-muted-foreground/50 flex-shrink-0 tabular-nums">{index + 1}.</span>
      {icon}
      <span className={cn(
        "truncate",
        item.status === "done" ? "text-foreground" : "text-muted-foreground",
        item.status === "skipped" && "line-through"
      )}>
        {item.title}
      </span>
    </div>
  );
}

function DatasetSelector({
  datasets, selectedIds, onChange, disabled,
}: {
  datasets: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const allSelected = datasets.length > 0 && selectedIds.length === datasets.length;
  const label =
    datasets.length === 0 ? "No datasets available" :
    allSelected ? "All datasets" :
    selectedIds.length === 0 ? "None selected" :
    selectedIds.length === 1 ? datasets.find((d) => d.id === selectedIds[0])?.name ?? "1 dataset" :
    `${selectedIds.length} of ${datasets.length} datasets`;

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 text-xs font-medium border rounded-xl pl-3 pr-2.5 py-2 bg-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          open ? "border-brand ring-2 ring-brand/15" : "border-border hover:border-brand/40"
        )}
      >
        <Database className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-foreground max-w-[220px] truncate">{label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 flex-shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1.5 w-72 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {selectedIds.length} / {datasets.length} selected
            </span>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onChange(datasets.map((d) => d.id))}
                className="text-[11px] font-medium text-brand hover:underline"
              >
                All
              </button>
              <button
                onClick={() => onChange([])}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                None
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin py-1">
            {datasets.map((d) => {
              const checked = selectedIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  className="flex items-center gap-2.5 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/70 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(d.id)}
                    className="w-3.5 h-3.5 accent-brand flex-shrink-0"
                  />
                  <span className={cn("truncate", checked ? "text-foreground" : "text-muted-foreground")}>{d.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AutoEdaPanel({
  workspaceId, scopedDatasetId, datasets,
}: {
  workspaceId: string;
  scopedDatasetId?: string;
  datasets: Array<{ id: string; name: string }>;
}) {
  const qc = useQueryClient();
  const isScoped = !!scopedDatasetId;
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (scopedDatasetId ? [scopedDatasetId] : []));
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [businessContext, setBusinessContext] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  // Scoped to one dataset: always exactly that one. Unscoped: default to
  // every dataset in the workspace the first time the list loads, but
  // don't keep clobbering it afterward — the user may have unselected some.
  useEffect(() => {
    if (isScoped) { setSelectedIds([scopedDatasetId]); return; }
    setSelectedIds((prev) => (prev.length > 0 ? prev : datasets.map((d) => d.id)));
  }, [isScoped, scopedDatasetId, datasets]);

  const runsFilterId = isScoped ? scopedDatasetId : undefined;

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: queryKeys.autoEda.runs(workspaceId, runsFilterId),
    queryFn: () => autoEdaApi.listRuns(workspaceId, runsFilterId).then((r) => r.data as AutoEdaRun[]),
    refetchInterval: (query) => {
      const data = query.state.data as AutoEdaRun[] | undefined;
      return data?.some((r) => r.status === "pending" || r.status === "running" || r.status === "pausing") ? POLL_INTERVAL_MS : false;
    },
  });

  useEffect(() => {
    if (!runs) return;
    if (selectedRunId != null && runs.some((r) => r.id === selectedRunId)) return;
    setSelectedRunId(runs[0]?.id ?? null);
  }, [runs, selectedRunId]);

  const selectedRun = useMemo(() => runs?.find((r) => r.id === selectedRunId) ?? null, [runs, selectedRunId]);
  const isRunning = selectedRun?.status === "pending" || selectedRun?.status === "running" || selectedRun?.status === "pausing";
  const isPaused = selectedRun?.status === "paused";
  const isPlanned = selectedRun?.status === "planned";
  const canSteer = isRunning || isPaused || isPlanned;

  const datasetNameById = useMemo(() => {
    const map = new Map<string, string>();
    datasets.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [datasets]);

  const invalidateRuns = () => qc.invalidateQueries({ queryKey: queryKeys.autoEda.runs(workspaceId, runsFilterId) });

  const handleRun = async () => {
    if (selectedIds.length === 0) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const { run_id } = await autoEdaApi.startRun(workspaceId, selectedIds, businessContext, reportTitle);
      setSelectedRunId(run_id);
      invalidateRuns();
    } catch {
      setStartError("Couldn't start the run — please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleDelete = async (runId: number) => {
    await autoEdaApi.deleteRun(workspaceId, runId);
    if (selectedRunId === runId) setSelectedRunId(null);
    invalidateRuns();
  };

  const handlePause = async (runId: number) => {
    setIsPausing(true);
    try {
      await autoEdaApi.pauseRun(workspaceId, runId);
      invalidateRuns();
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async (runId: number) => {
    setIsResuming(true);
    try {
      await autoEdaApi.resumeRun(workspaceId, runId);
      invalidateRuns();
    } finally {
      setIsResuming(false);
    }
  };

  const handleApprove = async (runId: number) => {
    setIsApproving(true);
    try {
      await autoEdaApi.approveRun(workspaceId, runId);
      invalidateRuns();
    } finally {
      setIsApproving(false);
    }
  };

  const handleDownload = async (run: AutoEdaRun, format: "md" | "docx") => {
    const res = await autoEdaApi.downloadRun(workspaceId, run.id, format);
    const mime = format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "text/markdown";
    const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `auto_eda_${run.dataset_ids.join("-")}_${run.id}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runDatasetLabel = (run: AutoEdaRun): string => {
    if (run.dataset_ids.length <= 1) return "";
    const names = run.dataset_ids.map((id) => datasetNameById.get(String(id))).filter(Boolean) as string[];
    return names.length ? `${names.length} datasets` : `${run.dataset_ids.length} datasets`;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-1 pb-4">
        <div className="mb-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            Report title <span className="font-normal normal-case text-muted-foreground/70">(optional — defaults to the workspace name)</span>
          </label>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            disabled={isStarting}
            placeholder="e.g. Apax Portfolio Retention Analysis"
            className="w-full text-xs bg-card border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder-muted-foreground/60 transition-colors disabled:opacity-50"
          />
        </div>
        <div className="mb-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            Business context <span className="font-normal normal-case text-muted-foreground/70">(optional, but recommended)</span>
          </label>
          <textarea
            value={businessContext}
            onChange={(e) => setBusinessContext(e.target.value)}
            disabled={isStarting}
            placeholder="e.g. We want to understand what's driving churn and identify at-risk high-value customers. Focus on revenue, tenure, and support-ticket patterns."
            rows={2}
            className="w-full text-xs bg-card border border-border rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder-muted-foreground/60 transition-colors disabled:opacity-50"
          />
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Tell it what you&apos;re trying to figure out — it&apos;ll prioritize the analyses most relevant to that
            instead of mechanically covering every column.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {!isScoped && (
            <DatasetSelector
              datasets={datasets}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              disabled={isStarting}
            />
          )}
          <button
            onClick={handleRun}
            disabled={isStarting || selectedIds.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90 hover:shadow-md bg-brand shadow-sm"
          >
            {isStarting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Starting…</> : <><Sparkles className="w-3.5 h-3.5" />Run Auto EDA</>}
          </button>
        </div>
        {startError && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{startError}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex border-t border-border">
        {/* Left: past runs list */}
        <div className="w-[320px] flex-shrink-0 border-r border-border overflow-y-auto scrollbar-thin px-4 py-4 space-y-2">
          {runsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" /></div>
          ) : runs && runs.length > 0 ? (
            runs.map((r) => {
              const running = r.status === "pending" || r.status === "running" || r.status === "pausing";
              const done = r.worklist.filter((i) => i.status === "done").length;
              const multiLabel = runDatasetLabel(r);
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRunId(r.id)}
                  className={cn(
                    "w-full text-left border rounded-xl p-3 transition-all group relative",
                    selectedRunId === r.id ? "border-brand ring-1 ring-brand/40 bg-card shadow-sm" : "border-border hover:border-brand/40 hover:bg-muted/30"
                  )}
                >
                  <p className="text-xs font-medium text-foreground truncate mb-1.5 pr-4">{r.title ?? `Run #${r.id}`}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide",
                        r.status === "completed"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                          : r.status === "error"
                          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                          : r.status === "paused"
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                          : r.status === "planned"
                          ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400"
                          : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                      )}
                    >
                      {running && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                      {r.status}
                    </span>
                    {multiLabel && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        <Layers className="w-2.5 h-2.5" />
                        {multiLabel}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                      {running ? `${done}/${r.worklist.length} steps` : `${r.worklist.length} steps`}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{relativeTime(r.created_at)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                    className="absolute top-2.5 right-2.5 p-1 text-muted-foreground/40 hover:text-red-500 transition-colors rounded opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center text-center py-12 px-3">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center mb-3">
                <FileSearch className="w-4 h-4 text-muted-foreground/60" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No runs yet — click <span className="font-medium text-foreground">Run Auto EDA</span> above to get started.
              </p>
            </div>
          )}
        </div>

        {/* Right: report */}
        <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin px-8 py-6">
          {selectedRun ? (
            <>
              {selectedRun.worklist.length > 0 && (
                <div className="mb-6 max-w-2xl">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                        {isPlanned ? "Proposed worklist" : "Worklist"}
                      </p>
                      {isRunning && selectedRun.status !== "pausing" && <Loader2 className="w-3 h-3 animate-spin text-brand" />}
                      {selectedRun.status === "pausing" && <span className="text-[10px] text-amber-600 dark:text-amber-400">pausing…</span>}
                    </div>
                    {isPlanned && (
                      <button
                        onClick={() => handleApprove(selectedRun.id)}
                        disabled={isApproving}
                        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white bg-brand hover:opacity-90 transition disabled:opacity-50"
                      >
                        {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Approve & Run
                      </button>
                    )}
                    {(isRunning || isPaused) && (
                      <button
                        onClick={() => (isPaused ? handleResume(selectedRun.id) : handlePause(selectedRun.id))}
                        disabled={isPausing || isResuming || selectedRun.status === "pausing"}
                        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50"
                      >
                        {isPausing || isResuming ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isPaused ? (
                          <Play className="w-3 h-3" />
                        ) : (
                          <Pause className="w-3 h-3" />
                        )}
                        {isPaused ? "Resume" : "Pause"}
                      </button>
                    )}
                  </div>
                  {isPlanned && (
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Review the plan below — use the chat to adjust it (e.g. &ldquo;skip the categorical
                      breakdowns&rdquo;), then approve to run it.
                    </p>
                  )}
                  <div className="border border-border rounded-xl divide-y divide-border px-3 bg-card/40">
                    {selectedRun.worklist.map((item, i) => <WorklistItemRow key={i} item={item} index={i} />)}
                  </div>
                </div>
              )}

              {selectedRun.id != null && (
                <div className="mb-6 max-w-2xl">
                  <AutoEdaChat workspaceId={workspaceId} runId={selectedRun.id} active={canSteer} />
                </div>
              )}

              {selectedRun.status === "error" && selectedRun.error && (
                <div className="mb-4 max-w-2xl flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{selectedRun.error}</span>
                </div>
              )}

              {selectedRun.markdown ? (
                <div className="max-w-5xl">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <p className="text-[11px] font-bold tracking-wide text-jman-trypan">
                      JMAN GROUP · AUTOMATED EDA REPORT
                    </p>
                    {!isRunning && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(selectedRun, "docx")}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-card border border-border rounded-lg text-muted-foreground hover:border-jman-rose/50 hover:text-jman-trypan transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" /> Download .docx
                        </button>
                        <button
                          onClick={() => handleDownload(selectedRun, "md")}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-card border border-border rounded-lg text-muted-foreground hover:border-jman-rose/50 hover:text-jman-trypan transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" /> Download .md
                        </button>
                      </div>
                    )}
                  </div>
                  <Markdown content={selectedRun.markdown} className="jman-report text-sm leading-relaxed" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Warming up — the first result should appear shortly.
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Sparkles className="w-4 h-4 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                {selectedIds.length > 0
                  ? "Run Auto EDA to generate a report."
                  : "Select at least one dataset to get started."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
