"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  GripVertical, Trash2, Play, X, Plus, Loader2,
  ChevronDown, RotateCcw
} from "lucide-react";
import type { PipelineStep } from "@/types";

const OPERATIONS = [
  { value: "drop", label: "Drop Column", icon: "🗑️", needsColumn: true },
  { value: "rename", label: "Rename Column", icon: "✏️", needsColumn: true },
  { value: "fill_missing", label: "Fill Missing", icon: "🔧", needsColumn: true },
  { value: "cast_type", label: "Cast Type", icon: "🔄", needsColumn: true },
  { value: "normalize", label: "Normalize (0-1)", icon: "📏", needsColumn: true },
  { value: "standardize", label: "Standardize (Z)", icon: "📊", needsColumn: true },
  { value: "log_transform", label: "Log Transform", icon: "📈", needsColumn: true },
  { value: "one_hot_encode", label: "One-Hot Encode", icon: "🔤", needsColumn: true },
  { value: "label_encode", label: "Label Encode", icon: "🏷️", needsColumn: true },
  { value: "drop_high_missing", label: "Drop High Missing", icon: "🧹", needsColumn: false },
];

const FILL_METHODS = ["mean", "median", "mode", "forward", "backward", "custom"];
const DTYPES = ["float64", "int64", "str", "bool", "datetime64"];

interface PipelinePanelProps {
  datasetId: string;
  columns: string[];
  onResult?: (preview: Record<string, unknown>[]) => void;
}

export function PipelinePanel({ datasetId, columns, onResult }: PipelinePanelProps) {
  const qc = useQueryClient();
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [addingStep, setAddingStep] = useState(false);
  const [draft, setDraft] = useState<Partial<PipelineStep & { fillMethod?: string; fillValue?: string; newName?: string; dtype?: string; threshold?: string }>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState("");

  // Load saved pipeline on mount
  useQuery({
    queryKey: queryKeys.pipeline.get(datasetId),
    queryFn: () => datasetsApi.getPipeline(datasetId).then((r) => r.data),
    onSuccess: (data: { steps: PipelineStep[] }) => {
      if (data.steps?.length) setSteps(data.steps);
    },
  } as Parameters<typeof useQuery>[0]);

  const runMutation = useMutation({
    mutationFn: () =>
      datasetsApi.savePipeline(datasetId, steps.map((s) => ({
        operation: s.operation,
        column: s.column,
        params: s.params,
      }))).then((r) => r.data),
    onSuccess: (data: { applied: number; result_preview: Record<string, unknown>[]; row_count: number }) => {
      setResultMsg(`Applied ${data.applied} steps -> ${data.row_count.toLocaleString()} rows`);
      onResult?.(data.result_preview);
      qc.invalidateQueries({ queryKey: queryKeys.pipeline.get(datasetId) });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => datasetsApi.clearPipeline(datasetId),
    onSuccess: () => { setSteps([]); setResultMsg(""); },
  });

  const addStep = useCallback(() => {
    if (!draft.operation) return;
    const op = OPERATIONS.find((o) => o.value === draft.operation);
    if (op?.needsColumn && !draft.column) return;

    const params: Record<string, unknown> = {};
    if (draft.operation === "fill_missing") {
      params.method = draft.fillMethod ?? "mean";
      if (draft.fillMethod === "custom") params.fill_value = draft.fillValue ?? "";
    } else if (draft.operation === "cast_type") {
      params.dtype = draft.dtype ?? "float64";
    } else if (draft.operation === "rename") {
      params.new_name = draft.newName ?? "";
    } else if (draft.operation === "drop_high_missing") {
      params.threshold = Number(draft.threshold ?? 50);
    }

    const opLabel = OPERATIONS.find((o) => o.value === draft.operation)?.label ?? draft.operation;

    const newStep: PipelineStep = {
      step_order: steps.length,
      operation: draft.operation!,
      column: draft.column ?? null,
      params,
    };
    setSteps((prev) => [...prev, newStep]);
    setAddingStep(false);
    setDraft({});
  }, [draft, steps.length]);

  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i })));

  // Drag-and-drop reorder
  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const next = [...steps];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    setSteps(next.map((s, i) => ({ ...s, step_order: i })));
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const currentOp = OPERATIONS.find((o) => o.value === draft.operation);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Pipeline Steps</h3>
        <div className="flex items-center gap-1">
          {steps.length > 0 && (
            <button
              onClick={() => clearMutation.mutate()}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
              title="Clear all steps"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto py-2">
        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <p className="text-xs text-gray-400">No steps yet.</p>
            <p className="text-xs text-gray-300 mt-1">Add operations to build your pipeline.</p>
          </div>
        )}
        {steps.map((step, idx) => {
          const opInfo = OPERATIONS.find((o) => o.value === step.operation);
          return (
            <div
              key={idx}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={() => onDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`flex items-center gap-2 px-3 py-2.5 mx-2 mb-1 rounded-lg border cursor-grab transition ${
                dragOverIdx === idx ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200 bg-gray-50"
              }`}
            >
              <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-center w-5 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs">{opInfo?.icon}</span>
                  <span className="text-xs font-medium text-gray-700 truncate">{opInfo?.label ?? step.operation}</span>
                </div>
                {step.column && (
                  <p className="text-xs text-gray-400 mt-0.5 ml-8 truncate">{step.column}</p>
                )}
              </div>
              <button onClick={() => removeStep(idx)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 flex-shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add step form */}
      {addingStep && (
        <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50">
          <select
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
            value={draft.operation ?? ""}
            onChange={(e) => setDraft({ operation: e.target.value })}
          >
            <option value="">Select operation...</option>
            {OPERATIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
            ))}
          </select>

          {currentOp?.needsColumn && (
            <select
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
              value={draft.column ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, column: e.target.value }))}
            >
              <option value="">Select column...</option>
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {draft.operation === "fill_missing" && (
            <>
              <select
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
                value={draft.fillMethod ?? "mean"}
                onChange={(e) => setDraft((d) => ({ ...d, fillMethod: e.target.value }))}
              >
                {FILL_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              {draft.fillMethod === "custom" && (
                <input
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
                  placeholder="Fill value"
                  value={draft.fillValue ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, fillValue: e.target.value }))}
                />
              )}
            </>
          )}
          {draft.operation === "cast_type" && (
            <select
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
              value={draft.dtype ?? "float64"}
              onChange={(e) => setDraft((d) => ({ ...d, dtype: e.target.value }))}
            >
              {DTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {draft.operation === "rename" && (
            <input
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
              placeholder="New name"
              value={draft.newName ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, newName: e.target.value }))}
            />
          )}
          {draft.operation === "drop_high_missing" && (
            <input
              type="number"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
              placeholder="Threshold % (default 50)"
              value={draft.threshold ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, threshold: e.target.value }))}
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={addStep}
              disabled={!draft.operation || (currentOp?.needsColumn && !draft.column)}
              className="flex-1 text-xs bg-brand text-white rounded-lg py-1.5 disabled:opacity-40 hover:bg-[#2a0d8a] transition"
            >
              Add Step
            </button>
            <button
              onClick={() => { setAddingStep(false); setDraft({}); }}
              className="text-xs border border-gray-200 rounded-lg py-1.5 px-2.5 hover:bg-gray-100 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-100 p-3 space-y-2 flex-shrink-0">
        {resultMsg && (
          <p className="text-xs text-emerald-600 font-medium text-center">{resultMsg}</p>
        )}
        {!addingStep && (
          <button
            onClick={() => setAddingStep(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs border border-dashed border-gray-300 rounded-lg py-2 text-gray-500 hover:border-brand/60 hover:text-brand transition"
          >
            <Plus className="w-3 h-3" /> Add Step
          </button>
        )}
        <button
          onClick={() => runMutation.mutate()}
          disabled={steps.length === 0 || runMutation.isPending}
          className="w-full flex items-center justify-center gap-1.5 text-xs bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-40 hover:bg-[#2a0d8a] transition"
        >
          {runMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run Pipeline ({steps.length} step{steps.length !== 1 ? "s" : ""})
        </button>
      </div>
    </div>
  );
}
