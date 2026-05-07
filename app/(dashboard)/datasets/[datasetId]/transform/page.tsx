"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Wand2, Download, Trash2, Plus, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type TransformOp =
  | { type: "drop_columns"; columns: string[] }
  | { type: "fill_missing"; column: string; strategy: "mean" | "median" | "mode" | "constant"; value?: string }
  | { type: "encode"; column: string; method: "onehot" | "label" }
  | { type: "scale"; column: string; method: "standard" | "minmax" }
  | { type: "drop_duplicates" }
  | { type: "drop_outliers"; column: string; method: "iqr" | "zscore" };

export default function TransformStudioPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [ops, setOps] = useState<TransformOp[]>([]);
  const [applied, setApplied] = useState(false);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const allCols = profile?.columns.map((c: { name: string }) => c.name) ?? [];
  const numericCols = profile?.columns
    .filter((c: { semantic_type: string }) => c.semantic_type === "numeric")
    .map((c: { name: string }) => c.name) ?? [];
  const catCols = profile?.columns
    .filter((c: { semantic_type: string }) => c.semantic_type === "categorical")
    .map((c: { name: string }) => c.name) ?? [];

  const addOp = (op: TransformOp) => {
    setOps((prev) => [...prev, op]);
    setApplied(false);
  };

  const removeOp = (i: number) => {
    setOps((prev) => prev.filter((_, idx) => idx !== i));
    setApplied(false);
  };

  const applyMutation = useMutation({
    mutationFn: () => datasetsApi.transform(datasetId, ops),
    onSuccess: () => setApplied(true),
  });

  const opLabel = (op: TransformOp): string => {
    switch (op.type) {
      case "drop_columns": return `Drop columns: ${op.columns.join(", ")}`;
      case "fill_missing": return `Fill missing "${op.column}" → ${op.strategy}${op.value ? ` (${op.value})` : ""}`;
      case "encode": return `Encode "${op.column}" → ${op.method}`;
      case "scale": return `Scale "${op.column}" → ${op.method}`;
      case "drop_duplicates": return "Drop duplicate rows";
      case "drop_outliers": return `Drop outliers in "${op.column}" (${op.method})`;
    }
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-5xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Transform Studio" },
          ]}
        />

        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Transform Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Build a transformation pipeline and export a clean dataset
          </p>
        </div>

        {isLoading ? (
          <PageSpinner />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Operations builder */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Add Operations</h2>

              {/* Drop columns */}
              <OpCard title="Drop Columns">
                <MultiColSelect
                  cols={allCols}
                  placeholder="Select columns to drop"
                  onAdd={(cols) => addOp({ type: "drop_columns", columns: cols })}
                />
              </OpCard>

              {/* Fill missing */}
              <OpCard title="Fill Missing Values">
                <FillMissingForm cols={allCols} onAdd={(op) => addOp(op)} />
              </OpCard>

              {/* Encode */}
              <OpCard title="Encode Categorical">
                <EncodeForm cols={catCols} onAdd={(op) => addOp(op)} />
              </OpCard>

              {/* Scale */}
              <OpCard title="Scale Numeric">
                <ScaleForm cols={numericCols} onAdd={(op) => addOp(op)} />
              </OpCard>

              {/* Drop duplicates */}
              <button
                onClick={() => addOp({ type: "drop_duplicates" })}
                className="w-full text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition text-sm font-medium text-gray-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-gray-400" />
                Drop Duplicate Rows
              </button>
            </div>

            {/* Pipeline + apply */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Pipeline ({ops.length} steps)
              </h2>

              {ops.length === 0 ? (
                <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
                  <Wand2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Add operations to build your pipeline</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {ops.map((op, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-4 py-2.5"
                    >
                      <span className="text-xs font-medium text-gray-500 w-5">{i + 1}.</span>
                      <span className="flex-1 text-xs text-gray-700">{opLabel(op)}</span>
                      <button
                        onClick={() => removeOp(i)}
                        className="p-1 hover:text-red-500 text-gray-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {ops.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => applyMutation.mutate()}
                    disabled={applyMutation.isPending}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {applyMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Applying…
                      </>
                    ) : applied ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Applied! Download below
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Apply Transformations
                      </>
                    )}
                  </button>

                  {applied && (
                    <a
                      href={`/api/datasets/${datasetId}/export`}
                      className="w-full py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export Transformed CSV
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Sub-components

function OpCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-semibold text-gray-600 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function MultiColSelect({
  cols,
  placeholder,
  onAdd,
}: {
  cols: string[];
  placeholder: string;
  onAdd: (cols: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (c: string) =>
    setSelected((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  return (
    <div className="space-y-2">
      <div className="max-h-28 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-0.5 scrollbar-thin">
        {cols.map((c) => (
          <label key={c} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-gray-50 rounded">
            <input
              type="checkbox"
              checked={selected.includes(c)}
              onChange={() => toggle(c)}
              className="rounded"
            />
            <span className="text-xs font-mono text-gray-700">{c}</span>
          </label>
        ))}
      </div>
      <button
        onClick={() => { if (selected.length) { onAdd(selected); setSelected([]); } }}
        disabled={!selected.length}
        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function FillMissingForm({
  cols,
  onAdd,
}: {
  cols: string[];
  onAdd: (op: TransformOp) => void;
}) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [strategy, setStrategy] = useState<"mean" | "median" | "mode" | "constant">("mean");
  const [value, setValue] = useState("");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={col}
          onChange={(e) => setCol(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {cols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as typeof strategy)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {["mean", "median", "mode", "constant"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {strategy === "constant" && (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Fill value"
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      <button
        onClick={() => onAdd({ type: "fill_missing", column: col, strategy, value: value || undefined })}
        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function EncodeForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [method, setMethod] = useState<"onehot" | "label">("label");

  return (
    <div className="flex gap-2 flex-wrap">
      <select
        value={col}
        onChange={(e) => setCol(e.target.value)}
        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {cols.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value as typeof method)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="label">Label</option>
        <option value="onehot">One-Hot</option>
      </select>
      <button
        onClick={() => onAdd({ type: "encode", column: col, method })}
        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function ScaleForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [method, setMethod] = useState<"standard" | "minmax">("standard");

  return (
    <div className="flex gap-2 flex-wrap">
      <select
        value={col}
        onChange={(e) => setCol(e.target.value)}
        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {cols.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value as typeof method)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="standard">Standard</option>
        <option value="minmax">Min-Max</option>
      </select>
      <button
        onClick={() => onAdd({ type: "scale", column: col, method })}
        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}
