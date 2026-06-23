"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hypothesesApi, datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Markdown } from "@/components/shared/Markdown";
import { cn } from "@/lib/utils";
import type { Hypothesis, HypothesisStatus, ScoutToolCall } from "@/types";
import {
  FlaskConical, Loader2, Plus, X, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Sparkles, Trash2, Database, Layers,
} from "lucide-react";
import { HypothesisToolTrace } from "@/components/hypotheses/HypothesisToolResultPreview";
import { Mascot } from "@/components/shared/Mascot";

const CONF_COLOR: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-gray-100 text-gray-500",
};

const SEV_DOT: Record<string, string> = {
  danger: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-blue-400",
};

const STATUS_CFG: Record<HypothesisStatus, { icon: React.ReactNode; cls: string; label: string; text: string }> = {
  pending: { icon: <FlaskConical className="w-3.5 h-3.5 text-gray-400" />, cls: "bg-gray-50 border-gray-200", label: "Pending", text: "text-gray-500" },
  validating: { icon: <Mascot className="w-4 h-4" />, cls: "bg-blue-50 border-blue-200", label: "Validating…", text: "text-blue-600" },
  supported: { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />, cls: "bg-emerald-50 border-emerald-200", label: "Supported", text: "text-emerald-700" },
  refuted: { icon: <XCircle className="w-3.5 h-3.5 text-red-500" />, cls: "bg-red-50 border-red-200", label: "Refuted", text: "text-red-700" },
  inconclusive: { icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />, cls: "bg-amber-50 border-amber-200", label: "Inconclusive", text: "text-amber-700" },
  error: { icon: <XCircle className="w-3.5 h-3.5 text-red-500" />, cls: "bg-red-50 border-red-200", label: "Error", text: "text-red-700" },
};

interface StreamingToolCall {
  tool: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
}

function LiveProgress({ tools }: { tools: StreamingToolCall[] }) {
  if (tools.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Mascot className="w-5 h-5" />
        Investigating…
      </div>
    );
  }
  const last = tools[tools.length - 1];
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <Mascot className="w-5 h-5" />
      {tools.length} step{tools.length !== 1 ? "s" : ""} so far — running {last.tool}…
    </div>
  );
}

function HypothesisRow({
  h, onValidate, onDelete, streaming,
}: {
  h: Hypothesis;
  onValidate: (id: number) => void;
  onDelete: (id: number) => void;
  streaming?: StreamingToolCall[];
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[h.status];
  const isValidating = h.status === "validating";

  return (
    <div className={cn("border rounded-xl p-4 transition-all", cfg.cls)}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide",
                h.origin === "ai" ? "bg-violet-50 text-violet-600" : "bg-gray-100 text-gray-500"
              )}
            >
              {h.origin === "ai" ? "AI" : "You"}
            </span>
            {h.severity && <span className={cn("w-2 h-2 rounded-full", SEV_DOT[h.severity])} />}
            {h.title && <span className="text-xs font-medium text-gray-500 truncate">{h.title}</span>}
          </div>

          <p className="text-sm text-gray-800 leading-snug">{h.statement}</p>

          {isValidating && streaming && (
            <div className="mt-2"><LiveProgress tools={streaming} /></div>
          )}

          {h.verdict && expanded && (
            <div className="mt-3 space-y-2">
              <Markdown content={h.verdict} className={cn("text-xs leading-relaxed", cfg.text)} />
              {h.evidence_summary && (
                <code className="text-[11px] font-mono text-gray-500 bg-white border border-gray-100 px-1.5 py-0.5 rounded inline-block">
                  {h.evidence_summary}
                </code>
              )}
              {h.columns.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {h.columns.map((col) => (
                    <span key={col} className="text-[11px] font-mono text-gray-400 bg-white border border-gray-100 px-1.5 py-0.5 rounded">
                      {col}
                    </span>
                  ))}
                </div>
              )}
              {h.tool_trace.length > 0 && <HypothesisToolTrace trace={h.tool_trace} />}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className={cn("text-[11px] font-semibold", cfg.text)}>{cfg.label}</span>
            {h.confidence && (
              <>
                <span className="text-gray-200">·</span>
                <span className={cn("text-[11px] px-1.5 py-0.5 rounded-md", CONF_COLOR[h.confidence])}>{h.confidence} confidence</span>
              </>
            )}
            {h.verdict && (
              <button onClick={() => setExpanded((v) => !v)} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 ml-auto">
                {expanded ? <><ChevronUp className="w-3 h-3" />Hide</> : <><ChevronDown className="w-3 h-3" />Details</>}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {h.status === "pending" && (
            <button
              onClick={() => onValidate(h.id)}
              className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition"
            >
              Validate
            </button>
          )}
          <button onClick={() => onDelete(h.id)} className="p-1 text-gray-300 hover:text-gray-500 transition rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
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
    mutationFn: () => hypothesesApi.create(workspaceId, { statement: draft.trim(), dataset_id: scopedDatasetId }),
    onSuccess: () => { setDraft(""); invalidate(); },
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

  const STATUS_TABS: (HypothesisStatus | "all")[] = ["all", "pending", "validating", "supported", "refuted", "inconclusive", "error"];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
            <FlaskConical className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Hypotheses</h1>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-1">
        Every verdict here is backed by a real computation Scout ran against your data — not a guess.
      </p>
      {scopedDatasetId && (
        <div className="flex items-center gap-2 mb-5 mt-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
            <Database className="w-3 h-3" />
            Scoped to {dataset?.name ?? `dataset #${scopedDatasetId}`}
          </span>
          <button onClick={clearScope} className="text-xs text-gray-400 hover:text-gray-600">
            Clear scope
          </button>
        </div>
      )}
      {!scopedDatasetId && <div className="mb-5" />}

      {/* Generate control */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <p className="text-xs text-gray-500 flex-1">
          Investigate {scopedDatasetId ? "this dataset" : "the whole workspace"} and propose pre-verified hypotheses.
        </p>
        <input
          type="number"
          min={1}
          max={10}
          value={genCount}
          onChange={(e) => setGenCount(Math.max(1, Math.min(10, Number(e.target.value) || 6)))}
          className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center"
          disabled={isGenerating}
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition hover:opacity-90"
          style={{ backgroundColor: "hsl(var(--primary))" }}
        >
          {isGenerating ? <><Loader2 className="w-3 h-3 animate-spin" />Investigating…</> : <><Sparkles className="w-3 h-3" />Generate</>}
        </button>
      </div>
      {isGenerating && (
        <div className="mb-5 px-1"><LiveProgress tools={genProgress} /></div>
      )}
      {genError && !isGenerating && (
        <div className="mb-5 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{genError}</span>
        </div>
      )}

      {/* Add input */}
      <div className="bg-white border border-gray-300 rounded-xl p-4 mb-5 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-50 transition-all">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) createMutation.mutate(); } }}
          placeholder="e.g. High-value customers tend to churn less · Wind and Solar output are negatively correlated"
          rows={2}
          className="w-full text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none leading-relaxed bg-transparent"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => createMutation.mutate()}
            disabled={!draft.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:border-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      {hypotheses && hypotheses.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
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
                    : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
                )}
              >
                {label} <span className={active ? "opacity-60" : "text-gray-300"}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-300"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filteredHypotheses && filteredHypotheses.length > 0 ? (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              {g.label && (
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  {g.key === "workspace"
                    ? <Layers className="w-3 h-3 text-gray-400" />
                    : <Database className="w-3 h-3 text-gray-400" />}
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.label}</span>
                  <span className="text-[11px] text-gray-300">· {g.items.length}</span>
                </div>
              )}
              <div className="space-y-2">
                {g.items.map((h) => (
                  <HypothesisRow key={h.id} h={h} onValidate={handleValidate} onDelete={(id) => deleteMutation.mutate(id)} streaming={validating[h.id]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <FlaskConical className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">
            {hypotheses && hypotheses.length > 0
              ? "No hypotheses match this filter."
              : "No hypotheses yet. Add one above, or click Generate."}
          </p>
        </div>
      )}
    </div>
  );
}
