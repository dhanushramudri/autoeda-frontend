"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hypothesesApi, datasetsApi, scoutApi, uploadToPresignedUrl } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Markdown } from "@/components/shared/Markdown";
import { cn } from "@/lib/utils";
import type { Hypothesis, HypothesisStatus, ScoutToolCall } from "@/types";
import {
  FlaskConical, Loader2, X, CheckCircle2, XCircle, AlertTriangle,
  Sparkles, Database, Layers, ChevronRight, MessageSquarePlus, ArrowRight, Paperclip,
} from "lucide-react";
import { HypothesisToolTrace } from "@/components/hypotheses/HypothesisToolResultPreview";
import { Mascot } from "@/components/shared/Mascot";

const CONF_COLOR: Record<string, string> = {
  high: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
};

const SEV_DOT: Record<string, string> = {
  danger: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-blue-400",
};

const STATUS_CFG: Record<HypothesisStatus, { icon: React.ReactNode; cls: string; label: string; text: string }> = {
  pending: { icon: <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />, cls: "bg-muted border-border", label: "Pending", text: "text-muted-foreground" },
  validating: { icon: <Mascot className="w-4 h-4" />, cls: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800", label: "Validating…", text: "text-blue-600 dark:text-blue-400" },
  supported: { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />, cls: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800", label: "Supported", text: "text-emerald-700" },
  refuted: { icon: <XCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />, cls: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800", label: "Refuted", text: "text-red-700" },
  inconclusive: { icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />, cls: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", label: "Inconclusive", text: "text-amber-700" },
  error: { icon: <XCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />, cls: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800", label: "Error", text: "text-red-700" },
};

interface StreamingToolCall {
  tool: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
}

function LiveProgress({ tools }: { tools: StreamingToolCall[] }) {
  if (tools.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mascot className="w-5 h-5" />
        Investigating…
      </div>
    );
  }
  const last = tools[tools.length - 1];
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Mascot className="w-5 h-5" />
      {tools.length} step{tools.length !== 1 ? "s" : ""} so far — running {last.tool}…
    </div>
  );
}

// -- Left pane: compact, click-to-select list row --------------------------

function HypothesisListItem({
  h, active, onSelect, onDelete, isValidating,
}: {
  h: Hypothesis;
  active: boolean;
  onSelect: () => void;
  onDelete: (id: number) => void;
  isValidating?: boolean;
}) {
  const cfg = STATUS_CFG[h.status];
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left border rounded-xl p-3 transition-all group relative",
        active ? "border-brand ring-1 ring-brand bg-card shadow-sm" : cn(cfg.cls, "hover:border-brand/40")
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{isValidating ? <Mascot className="w-4 h-4" /> : cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={cn(
                "text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide",
                h.origin === "ai" ? "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" : "bg-muted text-muted-foreground"
              )}
            >
              {h.origin === "ai" ? "AI" : "You"}
            </span>
            {h.severity && <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", SEV_DOT[h.severity])} />}
            {h.image_url && <Paperclip className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />}
          </div>
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
            {h.title || h.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn("text-[10px] font-semibold", cfg.text)}>{isValidating ? "Validating…" : cfg.label}</span>
            {h.confidence && !isValidating && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md", CONF_COLOR[h.confidence])}>{h.confidence}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(h.id); }}
          className="flex-shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground transition rounded opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {active && <ChevronRight className="w-3.5 h-3.5 text-brand flex-shrink-0 mt-0.5" />}
      </div>
    </button>
  );
}

// -- Right pane: full detail for the selected hypothesis --------------------

function HypothesisDetail({
  h, onValidate, streaming, datasetLabel,
}: {
  h: Hypothesis;
  onValidate: (id: number) => void;
  streaming?: StreamingToolCall[];
  datasetLabel: string | null;
}) {
  const cfg = STATUS_CFG[h.status];
  const isValidating = h.status === "validating";

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <span>Hypotheses</span>
        {datasetLabel && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span>{datasetLabel}</span>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium truncate">{h.title || "Untitled"}</span>
      </div>

      {/* Readable-width prose block: statement, status, verdict */}
      <div className="max-w-5xl">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide",
              h.origin === "ai" ? "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" : "bg-muted text-muted-foreground"
            )}
          >
            {h.origin === "ai" ? "AI" : "You"}
          </span>
          {h.severity && <span className={cn("w-2 h-2 rounded-full", SEV_DOT[h.severity])} />}
          {h.title && <span className="text-xs font-medium text-muted-foreground">{h.title}</span>}
        </div>

        <p className="text-base text-foreground leading-relaxed mb-4">{h.statement}</p>

        {h.image_url && (
          <a href={h.image_url} target="_blank" rel="noopener noreferrer" className="block mb-4">
            <img src={h.image_url} alt="Attached to this hypothesis" className="max-h-64 rounded-xl border border-border object-contain" />
          </a>
        )}

        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border">
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", cfg.cls, cfg.text)}>
            {cfg.icon}
            {isValidating ? "Validating…" : cfg.label}
          </span>
          {h.confidence && !isValidating && (
            <span className={cn("text-xs px-2 py-1 rounded-md font-medium", CONF_COLOR[h.confidence])}>{h.confidence} confidence</span>
          )}
          {h.status === "pending" && (
            <button
              onClick={() => onValidate(h.id)}
              className="ml-auto text-xs px-3 py-1.5 bg-card border border-border rounded-lg text-muted-foreground hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Validate now
            </button>
          )}
        </div>

        {isValidating && streaming && (
          <div className="mb-5"><LiveProgress tools={streaming} /></div>
        )}

        {h.verdict && (
          <div className="space-y-3">
            <Markdown content={h.verdict} className={cn("text-sm leading-relaxed", cfg.text)} />
            {h.evidence_summary && (
              <code className="text-xs font-mono text-muted-foreground bg-card border border-border px-2 py-1 rounded inline-block">
                {h.evidence_summary}
              </code>
            )}
            {h.columns.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {h.columns.map((col) => (
                  <span key={col} className="text-xs font-mono text-muted-foreground bg-card border border-border px-2 py-1 rounded">
                    {col}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!h.verdict && !isValidating && h.status === "pending" && (
          <p className="text-sm text-muted-foreground">Not validated yet — click "Validate now" to have Scout investigate this claim.</p>
        )}
      </div>

      {/* Evidence: uses the full pane width — tables/heatmaps benefit from it, prose doesn't */}
      {h.verdict && h.tool_trace.length > 0 && (
        <div className="pt-6 mt-2 border-t border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand mb-3">Investigation trace</p>
          <HypothesisToolTrace trace={h.tool_trace} />
        </div>
      )}
    </div>
  );
}

export default function HypothesesPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const scopedDatasetId = searchParams.get("dataset_id") ?? undefined;
  const [draft, setDraft] = useState("");
  const [genCount, setGenCount] = useState(6);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<StreamingToolCall[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [validating, setValidating] = useState<Record<number, StreamingToolCall[]>>({});
  const [statusFilter, setStatusFilter] = useState<HypothesisStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<{ key: string; contentType: string; previewUrl: string; name: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Unsupported file type — use PNG, JPEG, WEBP, or GIF.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("Image exceeds the 8MB limit.");
      return;
    }
    setUploadingImage(true);
    try {
      const presign = await scoutApi.presignImage(workspaceId, {
        filename: file.name, content_type: file.type, size_bytes: file.size,
      });
      await uploadToPresignedUrl(presign.data.upload_url, file);
      setAttachedImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return { key: presign.data.image_key, contentType: file.type, previewUrl: URL.createObjectURL(file), name: file.name };
      });
    } catch {
      setUploadError("Upload failed — please try again.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearAttachedImage = () => {
    setAttachedImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const { data: dataset } = useQuery({
    queryKey: ["dataset", scopedDatasetId],
    queryFn: () => datasetsApi.get(scopedDatasetId!).then((r) => r.data),
    enabled: !!scopedDatasetId,
  });

  const { data: hypotheses, isLoading } = useQuery({
    queryKey: queryKeys.hypotheses.list(workspaceId, scopedDatasetId),
    queryFn: () => hypothesesApi.list(workspaceId, scopedDatasetId ? { dataset_id: scopedDatasetId } : undefined).then((r) => r.data as Hypothesis[]),
  });

  // Dataset names, only needed to label groups in the unscoped (workspace-wide) view.
  const { data: workspaceDatasets } = useQuery({
    queryKey: queryKeys.datasets.list(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId).then((r) => r.data as Array<{ id: string; name: string }>),
    enabled: !scopedDatasetId,
  });
  const datasetNameById = useMemo(() => {
    const map = new Map<string, string>();
    (workspaceDatasets ?? []).forEach((d) => map.set(String(d.id), d.name));
    return map;
  }, [workspaceDatasets]);

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.hypotheses.list(workspaceId, scopedDatasetId) });

  const createMutation = useMutation({
    mutationFn: () => hypothesesApi.create(workspaceId, {
      statement: draft.trim(), dataset_id: scopedDatasetId,
      image_key: attachedImage?.key, image_content_type: attachedImage?.contentType,
    }),
    onSuccess: () => {
      setDraft("");
      if (draftRef.current) draftRef.current.style.height = "auto";
      clearAttachedImage();
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hypothesesApi.delete(workspaceId, id),
    onSuccess: invalidate,
  });

  const handleValidate = async (id: number) => {
    setValidating((prev) => ({ ...prev, [id]: [] }));
    qc.setQueryData<Hypothesis[] | undefined>(queryKeys.hypotheses.list(workspaceId, scopedDatasetId), (prev) =>
      prev?.map((h) => (h.id === id ? { ...h, status: "validating" } : h))
    );
    try {
      for await (const event of hypothesesApi.streamValidate(workspaceId, id)) {
        if (event.type === "tool_call") {
          setValidating((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), { tool: event.tool as string, arguments: event.arguments as Record<string, unknown> }] }));
        } else if (event.type === "tool_result") {
          setValidating((prev) => {
            const tools = [...(prev[id] ?? [])];
            const idx = tools.map((t) => !t.result).lastIndexOf(true);
            if (idx >= 0) tools[idx] = { ...tools[idx], result: event.result as Record<string, unknown> };
            return { ...prev, [id]: tools };
          });
        } else if (event.type === "result" || event.type === "error" || event.type === "persisted") {
          if (event.type !== "persisted") continue;
          break;
        }
      }
    } catch {
      // fall through to invalidate, which will reflect whatever the server persisted (or didn't)
    } finally {
      setValidating((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      invalidate();
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenProgress([]);
    setGenError(null);
    try {
      for await (const event of hypothesesApi.streamGenerate(workspaceId, { dataset_id: scopedDatasetId, count: genCount })) {
        if (event.type === "tool_call") {
          setGenProgress((prev) => [...prev, { tool: event.tool as string, arguments: event.arguments as Record<string, unknown> }]);
        } else if (event.type === "tool_result") {
          setGenProgress((prev) => {
            const tools = [...prev];
            const idx = tools.map((t) => !t.result).lastIndexOf(true);
            if (idx >= 0) tools[idx] = { ...tools[idx], result: event.result as Record<string, unknown> };
            return tools;
          });
        } else if (event.type === "error") {
          setGenError(event.message as string);
        } else if (event.type === "persisted") {
          break;
        }
      }
    } catch {
      // invalidate below reflects whatever made it to the server
    } finally {
      setIsGenerating(false);
      setGenProgress([]);
      invalidate();
    }
  };

  const clearScope = () => router.push(`/workspaces/${workspaceId}/hypotheses`);

  // Tab counts always reflect the full unfiltered list so switching tabs doesn't shuffle the bar itself.
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<HypothesisStatus, number>> = {};
    (hypotheses ?? []).forEach((h) => { counts[h.status] = (counts[h.status] ?? 0) + 1; });
    return counts;
  }, [hypotheses]);

  const filteredHypotheses = useMemo(() => {
    if (!hypotheses) return hypotheses;
    return statusFilter === "all" ? hypotheses : hypotheses.filter((h) => h.status === statusFilter);
  }, [hypotheses, statusFilter]);

  // When scoped to one dataset there's nothing to group by; everything lands in a single unlabeled group.
  // When viewing the whole workspace, cluster by dataset (preserving each dataset's first-seen position,
  // which — since the list itself is already newest-first — keeps the most recently active dataset on top).
  const groups = useMemo(() => {
    if (!filteredHypotheses) return [];
    if (scopedDatasetId) return [{ key: "scoped", label: null as string | null, items: filteredHypotheses }];
    const order: string[] = [];
    const byKey = new Map<string, Hypothesis[]>();
    filteredHypotheses.forEach((h) => {
      const key = h.dataset_id == null ? "workspace" : String(h.dataset_id);
      if (!byKey.has(key)) { byKey.set(key, []); order.push(key); }
      byKey.get(key)!.push(h);
    });
    return order.map((key) => ({
      key,
      label: key === "workspace" ? "Workspace-wide" : datasetNameById.get(key) ?? `Dataset #${key}`,
      items: byKey.get(key)!,
    }));
  }, [filteredHypotheses, scopedDatasetId, datasetNameById]);

  // Keep selection valid: auto-select the first visible hypothesis when nothing
  // (or something no longer in the filtered list) is selected.
  useEffect(() => {
    if (!filteredHypotheses) return;
    if (selectedId != null && filteredHypotheses.some((h) => h.id === selectedId)) return;
    setSelectedId(filteredHypotheses[0]?.id ?? null);
  }, [filteredHypotheses, selectedId]);

  const selected = useMemo(
    () => filteredHypotheses?.find((h) => h.id === selectedId) ?? null,
    [filteredHypotheses, selectedId]
  );
  const selectedDatasetLabel = selected?.dataset_id == null
    ? (scopedDatasetId ? null : "Workspace-wide")
    : datasetNameById.get(String(selected.dataset_id)) ?? (dataset?.name ?? null);

  const STATUS_TABS: (HypothesisStatus | "all")[] = ["all", "pending", "validating", "supported", "refuted", "inconclusive", "error"];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar — full width, fixed at top */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
              <FlaskConical className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
            </div>
            <h1 className="text-xl font-bold text-foreground">Hypotheses</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Every verdict here is backed by a real computation Scout ran against your data — not a guess.
        </p>
        {scopedDatasetId && (
          <div className="flex items-center gap-2 mb-3 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
              <Database className="w-3 h-3" />
              Scoped to {dataset?.name ?? `dataset #${scopedDatasetId}`}
            </span>
            <button onClick={clearScope} className="text-xs text-muted-foreground hover:text-muted-foreground">
              Clear scope
            </button>
          </div>
        )}
        {!scopedDatasetId && <div className="mb-3" />}

        <div className="flex items-start gap-3">
          {/* Generate control */}
          <div className="flex items-center gap-3 flex-shrink-0 w-[380px] bg-card border border-border rounded-2xl pl-4 pr-2 py-2 shadow-sm transition-colors hover:border-brand/30">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-xs text-muted-foreground flex-1 leading-snug">
              Investigate {scopedDatasetId ? "this dataset" : "the whole workspace"} and propose pre-verified hypotheses.
            </p>
            <input
              type="number"
              min={1}
              max={10}
              value={genCount}
              onChange={(e) => setGenCount(Math.max(1, Math.min(10, Number(e.target.value) || 6)))}
              className="w-11 text-xs font-medium border border-border rounded-lg py-2 text-center bg-transparent focus:outline-none focus:border-brand transition-colors flex-shrink-0"
              disabled={isGenerating}
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-50 transition hover:opacity-90 flex-shrink-0 bg-brand"
            >
              {isGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Investigating…</> : <><Sparkles className="w-3.5 h-3.5" />Generate</>}
            </button>
          </div>

          {/* Add input — auto-grows with content, optional image attachment */}
          <div className="flex-1 bg-card border border-border rounded-2xl px-2 pt-2 pb-2 shadow-sm transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
            {attachedImage && (
              <div className="flex items-center gap-2 pl-2 pb-2 mb-1 border-b border-border">
                <img src={attachedImage.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1">{attachedImage.name}</span>
                <button onClick={clearAttachedImage} className="p-1 text-muted-foreground/60 hover:text-muted-foreground transition rounded flex-shrink-0" title="Remove attachment">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 pl-2">
              <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center flex-shrink-0">
                <MessageSquarePlus className="w-4 h-4 text-violet-500 dark:text-violet-400" />
              </div>
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => { setDraft(e.target.value); autoGrow(e.target); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) createMutation.mutate(); } }}
                placeholder="Add your own hypothesis, e.g. High-value customers tend to churn less"
                rows={1}
                className="flex-1 min-w-0 text-sm text-foreground placeholder-muted-foreground focus:outline-none bg-transparent py-1.5 resize-none max-h-24 overflow-y-auto scrollbar-hide leading-relaxed"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex items-center justify-center w-8 h-8 rounded-xl transition flex-shrink-0 text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Attach an image (e.g. a chart screenshot)"
              >
                {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!draft.trim() || createMutation.isPending}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl transition flex-shrink-0",
                  draft.trim() ? "bg-brand text-white hover:opacity-90" : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                )}
                title="Add hypothesis"
              >
                {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
            {uploadError && <p className="text-[11px] text-red-500 dark:text-red-400 pl-2 pt-1.5">{uploadError}</p>}
          </div>
        </div>

        {isGenerating && (
          <div className="mt-3 px-1"><LiveProgress tools={genProgress} /></div>
        )}
        {genError && !isGenerating && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{genError}</span>
          </div>
        )}

        {/* Status filter tabs */}
        {hypotheses && hypotheses.length > 0 && (
          <div className="flex items-center gap-1.5 mt-4 flex-wrap">
            {STATUS_TABS.filter((s) => s === "all" || (statusCounts[s] ?? 0) > 0).map((s) => {
              const active = statusFilter === s;
              const count = s === "all" ? hypotheses.length : statusCounts[s] ?? 0;
              const label = s === "all" ? "All" : STATUS_CFG[s].label.replace("…", "");
              const cfg = s === "all" ? null : STATUS_CFG[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-medium border transition",
                    active
                      ? cfg ? cn(cfg.cls, cfg.text) : "bg-gray-900 text-white border-gray-900"
                      : "bg-card text-muted-foreground border-border hover:border-border hover:text-muted-foreground"
                  )}
                >
                  {label} <span className={active ? "opacity-60" : "text-muted-foreground/60"}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Master-detail body — fills remaining height, each pane scrolls independently */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground/60"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filteredHypotheses && filteredHypotheses.length > 0 ? (
        <div className="flex-1 min-h-0 flex border-t border-border">
          {/* Left: hypothesis list */}
          <div className="w-[400px] flex-shrink-0 border-r border-border overflow-y-auto scrollbar-thin px-4 py-4 space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                {g.label && (
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    {g.key === "workspace"
                      ? <Layers className="w-3 h-3 text-muted-foreground" />
                      : <Database className="w-3 h-3 text-muted-foreground" />}
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</span>
                    <span className="text-[11px] text-muted-foreground/60">· {g.items.length}</span>
                  </div>
                )}
                <div className="space-y-2">
                  {g.items.map((h) => (
                    <HypothesisListItem
                      key={h.id}
                      h={h}
                      active={h.id === selectedId}
                      onSelect={() => setSelectedId(h.id)}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      isValidating={!!validating[h.id]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right: selected hypothesis detail */}
          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin px-8 py-6">
            {selected ? (
              <HypothesisDetail
                h={selected}
                onValidate={handleValidate}
                streaming={validating[selected.id]}
                datasetLabel={selectedDatasetLabel}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Select a hypothesis to see its evidence.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="bg-muted border border-dashed border-border rounded-xl p-10 text-center max-w-md">
            <FlaskConical className="w-6 h-6 text-muted-foreground/60 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              {hypotheses && hypotheses.length > 0
                ? "No hypotheses match this filter."
                : "No hypotheses yet. Add one above, or click Generate."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
