"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { autoEdaApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Markdown } from "@/components/shared/Markdown";
import { AutoEdaChat } from "@/components/auto-eda/AutoEdaChat";
import { cn } from "@/lib/utils";
import type { AutoEdaRun, AutoEdaWorklistItem } from "@/types";
import {
  Loader2, Sparkles, Download, Trash2, CheckCircle2, XCircle, Circle,
  AlertTriangle, Database, ChevronDown, ChevronLeft, ChevronRight, FileSearch,
  Layers, MinusCircle, Pause, Play, Pencil, Check, X, Wand2, Send,
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2, Heading3, Undo2, Redo2,
} from "lucide-react";

// Progress lives entirely in the DB (a background task drives the run,
// independent of this page being open) — polling is what makes the UI
// "live", not a persistent connection. 2.5s keeps it feeling responsive
// without hammering the API during a run that can take many minutes.
const POLL_INTERVAL_MS = 2500;

// Reused for the "Edit" mode's Save step: the report is edited as rendered
// HTML (so it visually matches the read view exactly, no separate raw-
// markdown look), then converted back to Markdown on save since that's the
// run's actual storage format (also what the .docx/.md export builds from).
// gfm adds table support, which turndown's core doesn't handle on its own —
// and this report is full of tables.
const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
turndownService.use(gfm);

// Worklist column width is user-resizable by dragging its right edge.
const WORKLIST_MIN_WIDTH = 260;
const WORKLIST_MAX_WIDTH = 600;
const WORKLIST_DEFAULT_WIDTH = 360;

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

function EditToolbarBtn({
  title, onClick, children,
}: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      // preventDefault on mousedown (not click) keeps the contentEditable
      // region's current selection intact — clicking a normal button would
      // steal focus first and collapse whatever text was selected.
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
    >
      {children}
    </button>
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
  const [maxItems, setMaxItems] = useState("");
  const [setupCollapsed, setSetupCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [worklistCollapsed, setWorklistCollapsed] = useState(false);
  const [worklistWidth, setWorklistWidth] = useState(WORKLIST_DEFAULT_WIDTH);
  const [isDraggingWorklist, setIsDraggingWorklist] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [initialEditHtml, setInitialEditHtml] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditError, setAiEditError] = useState<string | null>(null);
  const canvasBodyRef = useRef<HTMLDivElement>(null);
  const markdownViewRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const highlightElRef = useRef<HTMLElement | null>(null);
  const worklistContainerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const pendingWidthRef = useRef(WORKLIST_DEFAULT_WIDTH);
  const rafIdRef = useRef<number | null>(null);

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

  // Removes the temporary highlight span a selection leaves behind, restoring
  // the original DOM (its text nodes move back to where the span was).
  // Safe to call even if the span was already detached (e.g. the run's
  // markdown changed and the view re-rendered from scratch underneath it).
  const clearHighlight = () => {
    const el = highlightElRef.current;
    highlightElRef.current = null;
    if (!el || !el.parentNode) return;
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  };

  const dismissSelection = () => {
    clearHighlight();
    setSelection(null);
    setAiInstruction("");
    setAiEditError(null);
  };

  // Switching runs mid-edit/mid-selection would otherwise leak a stale draft
  // or a floating "Ask AI" popover pointing at the previous report's text.
  useEffect(() => {
    setEditMode(false);
    dismissSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId]);

  // A click anywhere outside the report canvas should dismiss a lingering
  // selection popover — clicks inside the canvas (recomputing or clearing
  // the selection) are already handled by its own onMouseUp.
  useEffect(() => {
    if (!selection) return;
    function onDocMouseDown(e: MouseEvent) {
      if (canvasBodyRef.current && !canvasBodyRef.current.contains(e.target as Node)) {
        dismissSelection();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  // Drag-to-resize for the worklist column.
  //
  // Perf note: this deliberately does NOT call setWorklistWidth on every
  // mousemove. This panel renders a large markdown report (tables, charts)
  // in column 3 — re-rendering that on every pixel of drag movement is what
  // made earlier versions of this feel laggy. Instead:
  //   1. The width is written straight to the DOM via the ref, throttled to
  //      one update per animation frame (requestAnimationFrame) — cheap,
  //      no React re-render.
  //   2. React state (`worklistWidth`) is only updated once, on mouseup, so
  //      the "real" width is still correct for anything else that reads it
  //      (e.g. if the column re-mounts for another reason).
  //   3. `isDraggingWorklist` toggles pointer-events off on the report
  //      canvas for the duration of the drag, so its own mouseup/selection
  //      handling doesn't do extra work while the user is resizing.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isResizingRef.current || !worklistContainerRef.current) return;
      const rect = worklistContainerRef.current.getBoundingClientRect();
      const newWidth = Math.min(WORKLIST_MAX_WIDTH, Math.max(WORKLIST_MIN_WIDTH, e.clientX - rect.left));
      pendingWidthRef.current = newWidth;
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (worklistContainerRef.current) {
            worklistContainerRef.current.style.width = `${pendingWidthRef.current}px`;
          }
        });
      }
    }
    function onUp() {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setWorklistWidth(pendingWidthRef.current);
      setIsDraggingWorklist(false);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startWorklistResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    pendingWidthRef.current = worklistWidth;
    setIsDraggingWorklist(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const setRunMarkdownLocally = (runId: number, markdown: string) => {
    qc.setQueryData(queryKeys.autoEda.runs(workspaceId, runsFilterId), (old: AutoEdaRun[] | undefined) =>
      old?.map((r) => (r.id === runId ? { ...r, markdown } : r))
    );
  };

  const handleToggleEdit = () => {
    if (!selectedRun) return;
    dismissSelection();
    // Seed the editable region from the CURRENTLY RENDERED view's own HTML —
    // captured once, kept out of further re-renders (see the contentEditable
    // div's dangerouslySetInnerHTML below) so the browser owns it while
    // editing, the same way any contentEditable region has to work with React.
    setInitialEditHtml(markdownViewRef.current?.innerHTML ?? "");
    setEditMode(true);
  };

  const handleCancelEdit = () => setEditMode(false);

  const handleSaveEdit = async () => {
    if (!selectedRun || !editableRef.current) return;
    setSavingEdit(true);
    try {
      const newMarkdown = turndownService.turndown(editableRef.current.innerHTML);
      await autoEdaApi.updateMarkdown(workspaceId, selectedRun.id, newMarkdown);
      setRunMarkdownLocally(selectedRun.id, newMarkdown);
      setEditMode(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const runEditCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  };

  const handleContentMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text || !sel || sel.rangeCount === 0 || !markdownViewRef.current || !canvasBodyRef.current) {
      dismissSelection();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!markdownViewRef.current.contains(range.commonAncestorContainer)) {
      dismissSelection();
      return;
    }
    clearHighlight();
    const rect = range.getBoundingClientRect();
    const containerRect = canvasBodyRef.current.getBoundingClientRect();

    // Wrap the selected range in a persistent highlight — plain window
    // selection disappears the moment focus moves into the prompt input
    // below, and the point is for the highlighted text to stay visibly
    // marked while the user is describing the change. surroundContents can
    // throw if the range crosses a partial element boundary (e.g. half of a
    // bolded phrase) — that's a purely visual nicety, so just skip it then.
    try {
      const span = document.createElement("span");
      span.className = "ai-selection-highlight";
      range.surroundContents(span);
      highlightElRef.current = span;
    } catch {
      highlightElRef.current = null;
    }

    setSelection({
      text,
      top: rect.top - containerRect.top + canvasBodyRef.current.scrollTop - 12,
      left: Math.min(Math.max(rect.left - containerRect.left + rect.width / 2, 140), containerRect.width - 140),
    });
    setAiInstruction("");
    setAiEditError(null);
  };

  const handleAiEdit = async () => {
    if (!selectedRun || !selection || !aiInstruction.trim()) return;
    setAiEditLoading(true);
    setAiEditError(null);
    try {
      const { markdown } = await autoEdaApi.aiEditSelection(workspaceId, selectedRun.id, selection.text, aiInstruction.trim());
      setRunMarkdownLocally(selectedRun.id, markdown);
      dismissSelection();
    } catch {
      setAiEditError("Couldn't apply that — the text may have changed since you selected it.");
    } finally {
      setAiEditLoading(false);
    }
  };

  const handleRun = async () => {
    if (selectedIds.length === 0) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const parsedMaxItems = Math.min(100, Math.max(1, parseInt(maxItems, 10) || 0)) || undefined;
      const { run_id } = await autoEdaApi.startRun(workspaceId, selectedIds, businessContext, reportTitle, parsedMaxItems);
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
      <div className="flex-shrink-0 px-6 pt-5 pb-5 space-y-4">
        {/* Report setup — collapsible so it doesn't eat vertical space once
            title/context are already set. Header stays visible either way. */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setSetupCollapsed((c) => !c)}
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan flex-shrink-0">
              Report setup
            </span>
            <div className="flex items-center gap-2 min-w-0">
              {setupCollapsed && (reportTitle || businessContext || maxItems) && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[420px]">
                  {reportTitle || "Untitled report"}
                  {businessContext ? ` · ${businessContext}` : ""}
                  {maxItems ? ` · up to ${maxItems} items` : ""}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 flex-shrink-0",
                  !setupCollapsed && "rotate-180"
                )}
              />
            </div>
          </button>
          {!setupCollapsed && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)_minmax(0,1.4fr)] gap-4 px-4 pb-4 pt-1">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan mb-1.5 block">
                  Report title <span className="font-normal normal-case text-muted-foreground/70">(optional — defaults to the workspace name)</span>
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  disabled={isStarting}
                  placeholder="e.g. Apax Portfolio Retention Analysis"
                  className="w-full text-xs bg-background border border-foreground/15 shadow-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder-muted-foreground/60 transition-colors disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan mb-1.5 block">
                  Max items <span className="font-normal normal-case text-muted-foreground/70">(1–100, optional)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxItems}
                  onChange={(e) => setMaxItems(e.target.value)}
                  disabled={isStarting}
                  placeholder="Default"
                  className="w-full text-xs bg-background border border-foreground/15 shadow-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder-muted-foreground/60 transition-colors disabled:opacity-50"
                />
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  How many investigations this run may plan/grow to.
                </p>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan mb-1.5 block">
                  Business context <span className="font-normal normal-case text-muted-foreground/70">(optional, but recommended)</span>
                </label>
                <textarea
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  disabled={isStarting}
                  placeholder="e.g. We want to understand what's driving churn and identify at-risk high-value customers. Focus on revenue, tenure, and support-ticket patterns."
                  rows={2}
                  className="w-full text-xs bg-background border border-foreground/15 shadow-sm rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder-muted-foreground/60 transition-colors disabled:opacity-50"
                />
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  Tell it what you&apos;re trying to figure out — it&apos;ll prioritize the analyses most relevant to that
                  instead of mechanically covering every column.
                </p>
              </div>
            </div>
          )}
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
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{startError}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex border-t border-border">
        {/* Column 1: past runs list — collapsible */}
        {listCollapsed ? (
          <button
            onClick={() => setListCollapsed(false)}
            title="Expand past runs"
            className="w-10 flex-shrink-0 border-r border-border flex flex-col items-center pt-3 gap-2 hover:bg-muted/40 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <FileSearch className="w-3.5 h-3.5 text-muted-foreground/50" />
          </button>
        ) : (
          <div className="w-[300px] flex-shrink-0 border-r border-border flex flex-col min-h-0">
            <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Past runs</span>
              <button
                onClick={() => setListCollapsed(true)}
                title="Collapse"
                className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 pb-4 pt-2 space-y-2">
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
          </div>
        )}

        {/* Column 2: worklist — collapsible, resizable, separate from the report canvas */}
        {selectedRun && selectedRun.worklist.length > 0 && (
          worklistCollapsed ? (
            <button
              onClick={() => setWorklistCollapsed(false)}
              title="Expand worklist"
              className="w-10 flex-shrink-0 border-r border-border flex flex-col items-center pt-3 gap-2 hover:bg-muted/40 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <Layers className="w-3.5 h-3.5 text-muted-foreground/50" />
            </button>
          ) : (
            <div
              ref={worklistContainerRef}
              style={{ width: worklistWidth }}
              className={cn(
                "flex-shrink-0 border-r border-border flex flex-col min-h-0 relative",
                isDraggingWorklist && "select-none"
              )}
            >
              <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                      {isPlanned ? "Proposed worklist" : "Worklist"}
                    </p>
                    {isRunning && selectedRun.status !== "pausing" && <Loader2 className="w-3 h-3 animate-spin text-brand" />}
                    {selectedRun.status === "pausing" && <span className="text-[10px] text-amber-600 dark:text-amber-400">pausing…</span>}
                  </div>
                  <button
                    onClick={() => setWorklistCollapsed(true)}
                    title="Collapse"
                    className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
                {isPlanned && (
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Review the plan — use the chat to adjust it (e.g. &ldquo;skip the categorical
                    breakdowns&rdquo;), then approve to run it.
                  </p>
                )}
                <div className="flex items-center gap-2">
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
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-2 divide-y divide-border">
                {selectedRun.worklist.map((item, i) => <WorklistItemRow key={i} item={item} index={i} />)}
              </div>

              {/* Drag handle — sits on the right edge, widens visually on
                  hover so it's easy to grab without a large permanent
                  footprint. Highlighted while actively dragging too. */}
              <div
                onMouseDown={startWorklistResize}
                title="Drag to resize"
                className={cn(
                  "absolute top-0 right-0 h-full w-1.5 -mr-0.5 cursor-col-resize transition-colors z-10",
                  isDraggingWorklist ? "bg-brand/60" : "hover:bg-brand/40"
                )}
              />
            </div>
          )
        )}

        {/* Column 3: report canvas */}
        <div
          className={cn(
            "flex-1 min-w-0 flex flex-col min-h-0 p-4",
            // Disabled during a worklist drag so this column's own mouseup /
            // text-selection handling doesn't do extra work on every
            // mousemove while the user is resizing the column next to it.
            isDraggingWorklist && "pointer-events-none"
          )}
        >
          {selectedRun ? (
            <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              {selectedRun.markdown && (
                <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-b border-border bg-background/60">
                  <p className="text-[11px] font-bold tracking-wide text-jman-trypan">
                    JMAN GROUP · AUTOMATED EDA REPORT
                  </p>
                  {!isRunning && (
                    <div className="flex gap-2 flex-shrink-0">
                      {editMode ? (
                        <>
                          <button
                            onClick={handleCancelEdit}
                            disabled={savingEdit}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white bg-brand hover:opacity-90 transition-colors disabled:opacity-50"
                          >
                            {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleToggleEdit}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-card border border-border rounded-lg text-muted-foreground hover:border-jman-rose/50 hover:text-jman-trypan transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editMode && (
                <div className="flex-shrink-0 flex items-center gap-0.5 px-4 py-1.5 border-b border-border bg-muted/30">
                  <EditToolbarBtn title="Bold" onClick={() => runEditCmd("bold")}><Bold className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <EditToolbarBtn title="Italic" onClick={() => runEditCmd("italic")}><Italic className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <EditToolbarBtn title="Underline" onClick={() => runEditCmd("underline")}><Underline className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <div className="w-px h-4 bg-border mx-1" />
                  <EditToolbarBtn title="Heading 1" onClick={() => runEditCmd("formatBlock", "H1")}><Heading1 className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <EditToolbarBtn title="Heading 2" onClick={() => runEditCmd("formatBlock", "H2")}><Heading2 className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <EditToolbarBtn title="Heading 3" onClick={() => runEditCmd("formatBlock", "H3")}><Heading3 className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <div className="w-px h-4 bg-border mx-1" />
                  <EditToolbarBtn title="Bullet list" onClick={() => runEditCmd("insertUnorderedList")}><List className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <EditToolbarBtn title="Numbered list" onClick={() => runEditCmd("insertOrderedList")}><ListOrdered className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <div className="w-px h-4 bg-border mx-1" />
                  <EditToolbarBtn title="Undo" onClick={() => runEditCmd("undo")}><Undo2 className="w-3.5 h-3.5" /></EditToolbarBtn>
                  <EditToolbarBtn title="Redo" onClick={() => runEditCmd("redo")}><Redo2 className="w-3.5 h-3.5" /></EditToolbarBtn>
                </div>
              )}

              <div
                ref={canvasBodyRef}
                onMouseUp={!isRunning && !editMode ? handleContentMouseUp : undefined}
                className="relative flex-1 min-h-0 overflow-y-auto scrollbar-thin px-6 py-5"
              >
                {selectedRun.status === "error" && selectedRun.error && (
                  <div className="mb-4 max-w-3xl flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{selectedRun.error}</span>
                  </div>
                )}

                {editMode ? (
                  // Uncontrolled on purpose — set once from the view's own
                  // rendered HTML, then the browser (not React) owns this
                  // subtree's children until Save reads them back out.
                  <div
                    ref={editableRef}
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: initialEditHtml }}
                    className="jman-report text-sm leading-relaxed max-w-none min-h-[60vh] rounded-xl border border-foreground/15 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 px-4 py-3"
                  />
                ) : selectedRun.markdown ? (
                  <div ref={markdownViewRef}>
                    <Markdown content={selectedRun.markdown} className="jman-report text-sm leading-relaxed max-w-none" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Warming up — the first result should appear shortly.
                  </div>
                )}

                {selection && !editMode && (
                  <div
                    className="absolute z-20 -translate-x-1/2 -translate-y-full"
                    style={{ top: selection.top, left: selection.left }}
                  >
                    <div className="flex flex-col gap-2 bg-card border border-brand/30 rounded-xl shadow-xl p-3 w-72">
                      <div className="flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                        <span className="text-xs font-semibold text-foreground">AI Selective Regeneration</span>
                      </div>
                      <input
                        autoFocus
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAiEdit();
                          if (e.key === "Escape") dismissSelection();
                        }}
                        placeholder="Rewrite this to sound more professional…"
                        disabled={aiEditLoading}
                        className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder-muted-foreground/60"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Press Enter to submit</span>
                        <button
                          onClick={handleAiEdit}
                          disabled={aiEditLoading || !aiInstruction.trim()}
                          className="flex items-center gap-1 text-[10px] font-semibold text-brand hover:opacity-80 disabled:opacity-40 transition"
                        >
                          {aiEditLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Enter</>}
                        </button>
                      </div>
                      {aiEditError && (
                        <p className="text-[10px] text-red-500">{aiEditError}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedRun.id != null && (
                <AutoEdaChat workspaceId={workspaceId} runId={selectedRun.id} active={canSteer} docked />
              )}
            </div>
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