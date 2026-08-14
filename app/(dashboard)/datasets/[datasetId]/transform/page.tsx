"use client";

import { useRef, useState, useCallback, Fragment } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  Wand2, Download, Trash2, Plus, CheckCircle, Sparkles,
  Loader2, ChevronDown, ChevronRight, GripVertical,
  AlertTriangle, SendHorizonal, AlertOctagon, Info, WandSparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type TransformOp =
  | { type: "drop_columns"; columns: string[] }
  | { type: "fill_missing"; column: string; strategy: "mean" | "median" | "mode" | "constant" | "ffill" | "bfill"; value?: string }
  | { type: "encode"; column: string; method: "onehot" | "label" }
  | { type: "scale"; column: string; method: "standard" | "minmax" | "robust" }
  | { type: "drop_duplicates"; subset?: string[] }
  | { type: "drop_outliers"; column: string; method: "iqr" | "zscore" }
  | { type: "cap_outliers"; column: string; method: "iqr" | "percentile"; lower_pct?: number; upper_pct?: number }
  | { type: "rename_column"; old_name: string; new_name: string }
  | { type: "cast_type"; column: string; to_type: "int" | "float" | "str" | "datetime" | "bool" }
  | { type: "select_columns"; columns: string[] }
  | { type: "reorder_columns"; columns: string[] }
  | { type: "create_column"; name: string; expression: string }
  | { type: "clip"; column: string; lower?: number; upper?: number }
  | { type: "filter_rows"; column: string; operator: string; value: string }
  | { type: "drop_rows_where_null"; columns: string[] }
  | { type: "sample_rows"; n?: number; frac?: number; random_state?: number }
  | { type: "sort_rows"; by: string[]; ascending: boolean[] }
  | { type: "log_transform"; column: string; variant: "log" | "log1p"; new_name?: string }
  | { type: "sqrt_transform"; column: string; new_name?: string }
  | { type: "bin"; column: string; bins: number; strategy: "cut" | "qcut"; new_name?: string }
  | { type: "extract_datetime"; column: string; parts: string[] }
  | { type: "text_clean"; column: string; strip?: boolean; lowercase?: boolean; uppercase?: boolean; replace_from?: string; replace_to?: string; remove_special?: boolean }
  | { type: "map_values"; column: string; mapping: Record<string, string> };

// ── Label builder ─────────────────────────────────────────────────────────────
function opLabel(op: TransformOp): string {
  switch (op.type) {
    case "drop_columns":       return `Drop columns: ${op.columns.join(", ")}`;
    case "fill_missing":       return `Fill "${op.column}" → ${op.strategy}${op.value ? ` (${op.value})` : ""}`;
    case "encode":             return `Encode "${op.column}" → ${op.method}`;
    case "scale":              return `Scale "${op.column}" → ${op.method}`;
    case "drop_duplicates":    return "Drop duplicate rows";
    case "drop_outliers":      return `Drop outliers in "${op.column}" (${op.method})`;
    case "cap_outliers":       return `Cap outliers in "${op.column}" (${op.method})`;
    case "rename_column":      return `Rename "${op.old_name}" → "${op.new_name}"`;
    case "cast_type":          return `Cast "${op.column}" → ${op.to_type}`;
    case "select_columns":     return `Keep columns: ${op.columns.join(", ")}`;
    case "reorder_columns":    return `Reorder columns`;
    case "create_column":      return `New column "${op.name}" = ${op.expression}`;
    case "clip":               return `Clip "${op.column}" [${op.lower ?? "-∞"}, ${op.upper ?? "+∞"}]`;
    case "filter_rows":        return `Keep rows where "${op.column}" ${op.operator} ${op.value}`;
    case "drop_rows_where_null": return `Drop rows with null in: ${op.columns.join(", ")}`;
    case "sample_rows":        return op.n ? `Sample ${op.n} rows` : `Sample ${(op.frac ?? 0) * 100}% rows`;
    case "sort_rows":          return `Sort by ${op.by.join(", ")}`;
    case "log_transform":      return `Log transform "${op.column}" (${op.variant})`;
    case "sqrt_transform":     return `Sqrt transform "${op.column}"`;
    case "bin":                return `Bin "${op.column}" into ${op.bins} groups (${op.strategy})`;
    case "extract_datetime":   return `Extract from "${op.column}": ${op.parts.join(", ")}`;
    case "text_clean":         return `Clean text "${op.column}"`;
    case "map_values":         return `Standardize ${Object.keys(op.mapping).length} value(s) in "${op.column}"`;
  }
}

// ── Op category badge ─────────────────────────────────────────────────────────
const OP_COLORS: Record<string, string> = {
  drop_columns: "bg-red-50 text-red-700 border-red-200",
  select_columns: "bg-blue-50 text-blue-700 border-blue-200",
  rename_column: "bg-sky-50 text-sky-700 border-sky-200",
  cast_type: "bg-indigo-50 text-indigo-700 border-indigo-200",
  reorder_columns: "bg-muted text-foreground border-border",
  create_column: "bg-violet-50 text-violet-700 border-violet-200",
  fill_missing: "bg-amber-50 text-amber-700 border-amber-200",
  drop_rows_where_null: "bg-orange-50 text-orange-700 border-orange-200",
  drop_duplicates: "bg-yellow-50 text-yellow-700 border-yellow-200",
  filter_rows: "bg-teal-50 text-teal-700 border-teal-200",
  clip: "bg-cyan-50 text-cyan-700 border-cyan-200",
  cap_outliers: "bg-emerald-50 text-emerald-700 border-emerald-200",
  drop_outliers: "bg-rose-50 text-rose-700 border-rose-200",
  sample_rows: "bg-lime-50 text-lime-700 border-lime-200",
  sort_rows: "bg-muted text-foreground border-border",
  encode: "bg-purple-50 text-purple-700 border-purple-200",
  scale: "bg-blue-50 text-blue-700 border-blue-200",
  log_transform: "bg-green-50 text-green-700 border-green-200",
  sqrt_transform: "bg-green-50 text-green-700 border-green-200",
  bin: "bg-pink-50 text-pink-700 border-pink-200",
  extract_datetime: "bg-orange-50 text-orange-700 border-orange-200",
  text_clean: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  map_values: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TransformStudioPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const queryClient = useQueryClient();
  const [ops, setOps] = useState<TransformOp[]>([]);
  const [result, setResult] = useState<{ rows: number; columns: number; errors: { op: string; error: string }[] } | null>(null);
  const [activeTab, setActiveTab] = useState<"smart" | "missing" | "columns" | "clean" | "feature">("smart");
  const [nlOpen, setNlOpen] = useState(false);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });


  // ── NL Transform ──
  const [nlPrompt, setNlPrompt] = useState("");
  const [nlPreview, setNlPreview] = useState<{ op: Record<string, unknown>; explanation: string } | null>(null);
  const [nlError, setNlError] = useState("");
  const nlInputRef = useRef<HTMLTextAreaElement>(null);

  const nlMutation = useMutation({
    mutationFn: () => datasetsApi.nlTransform(datasetId, nlPrompt),
    onSuccess: (res) => { setNlPreview(res.data); setNlError(""); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Could not generate step";
      setNlError(msg);
      setNlPreview(null);
    },
  });


  const allCols = profile?.columns.map((c: { name: string }) => c.name) ?? [];
  const numericCols = profile?.columns.filter((c: { semantic_type: string }) => ["numeric"].includes(c.semantic_type)).map((c: { name: string }) => c.name) ?? [];
  const catCols = profile?.columns.filter((c: { semantic_type: string }) => c.semantic_type === "categorical").map((c: { name: string }) => c.name) ?? [];
  const datetimeCols = profile?.columns.filter((c: { semantic_type: string }) => c.semantic_type === "datetime").map((c: { name: string }) => c.name) ?? [];
  const textCols = profile?.columns.filter((c: { semantic_type: string }) => c.semantic_type === "text").map((c: { name: string }) => c.name) ?? [];

  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const addOp = (op: TransformOp) => { setOps((p) => [...p, op]); setResult(null); };
  const removeOp = (i: number) => { setOps((p) => p.filter((_, idx) => idx !== i)); setResult(null); };
  const reorderOps = useCallback((from: number, to: number) => {
    if (from === to) return;
    setOps((p) => {
      const a = [...p];
      const [item] = a.splice(from, 1);
      a.splice(to, 0, item);
      return a;
    });
    setResult(null);
  }, []);

  const applyMutation = useMutation({
    mutationFn: () => datasetsApi.transform(datasetId, ops),
    onSuccess: (res) => {
      setResult(res.data);

      queryClient.invalidateQueries({ queryKey: ["eda"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets.detail(datasetId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets.preview(datasetId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.columnMeta.all(datasetId) });
      queryClient.invalidateQueries({ queryKey: ["columnDetail", datasetId] });
    },
  });



  if (isLoading) return <><SubNav datasetId={datasetId} /><PageSpinner /></>;

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Transform Studio" },
          ]}
        />

        <div className="mt-4 mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transform Studio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile?.total_rows?.toLocaleString()} rows × {profile?.total_columns} columns
            </p>
          </div>
        </div>

        {/* ── NL Transform Prompt (collapsible) ── */}
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl mb-4 overflow-hidden">
          <button
            onClick={() => setNlOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-100/40 transition"
          >
            <span className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Describe a transformation
            </span>
            {nlOpen
              ? <ChevronDown className="w-4 h-4 text-indigo-400" />
              : <ChevronRight className="w-4 h-4 text-indigo-400" />}
          </button>

          {nlOpen && (
            <div className="px-4 pb-4">
              <p className="text-xs text-indigo-500 mb-3">
                Tell the AI what to do in plain English — it will generate the exact pipeline step.
              </p>
              <div className="flex gap-2 items-start">
                <textarea
                  ref={nlInputRef}
                  value={nlPrompt}
                  onChange={(e) => { setNlPrompt(e.target.value); setNlPreview(null); setNlError(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (nlPrompt.trim() && !nlMutation.isPending) nlMutation.mutate();
                    }
                  }}
                  placeholder={`e.g. "fill missing age with median", "create revenue_per_user = revenue / users", "drop duplicate rows"`}
                  rows={2}
                  className="flex-1 text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-card resize-none placeholder:text-indigo-300"
                />
                <button
                  onClick={() => nlMutation.mutate()}
                  disabled={!nlPrompt.trim() || nlMutation.isPending}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
                >
                  {nlMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <SendHorizonal className="w-4 h-4" />}
                </button>
              </div>

              {nlError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {nlError}
                </p>
              )}

              {nlPreview && (
                <div className="mt-3 bg-card border border-indigo-100 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{nlPreview.explanation}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-md border font-mono",
                      OP_COLORS[(nlPreview.op as { type: string }).type] ?? "bg-muted text-foreground border-border"
                    )}>
                      {opLabel(nlPreview.op as TransformOp)}
                    </span>
                    <button
                      onClick={() => {
                        addOp(nlPreview.op as TransformOp);
                        setNlPreview(null);
                        setNlPrompt("");
                        setNlOpen(false);
                      }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition"
                    >
                      <Plus className="w-3 h-3" /> Add to pipeline
                    </button>
                    <button
                      onClick={() => { setNlPreview(null); setNlPrompt(""); }}
                      className="text-xs text-muted-foreground hover:text-muted-foreground transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* ── Operation Builder (3 cols) ── */}
          <div className="lg:col-span-3 space-y-3">
            {/* Tabs */}
            <div className="flex gap-1 bg-muted rounded-lg p-1 text-xs font-medium">
              {(["smart", "missing", "columns", "clean", "feature"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md capitalize transition",
                    activeTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "smart" ? "Smart Clean" : t === "missing" ? "Missing" : t === "columns" ? "Columns" : t === "clean" ? "Clean" : "Feature Eng"}
                </button>
              ))}
            </div>

            {/* Tab: Smart Clean */}
            {activeTab === "smart" && (
              <SmartCleanPanel datasetId={datasetId} ops={ops} addOp={addOp} />
            )}

            {/* Tab: Missing Values */}
            {activeTab === "missing" && (
              <div className="space-y-3">
                <Section title="Fill Missing Values">
                  <FillMissingForm cols={allCols} onAdd={addOp} />
                </Section>
                <Section title="Drop Rows Where Null">
                  <MultiColSelectForm
                    cols={allCols}
                    buttonLabel="Drop rows"
                    onAdd={(cols) => addOp({ type: "drop_rows_where_null", columns: cols })}
                  />
                </Section>
                <QuickButton
                  label="Drop duplicate rows"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => addOp({ type: "drop_duplicates" })}
                />
              </div>
            )}

            {/* Tab: Columns */}
            {activeTab === "columns" && (
              <div className="space-y-3">
                <Section title="Drop Columns">
                  <MultiColSelectForm cols={allCols} buttonLabel="Drop selected" onAdd={(cols) => addOp({ type: "drop_columns", columns: cols })} />
                </Section>
                <Section title="Keep Only Columns">
                  <MultiColSelectForm cols={allCols} buttonLabel="Keep selected" onAdd={(cols) => addOp({ type: "select_columns", columns: cols })} />
                </Section>
                <Section title="Rename Column">
                  <RenameForm cols={allCols} onAdd={addOp} />
                </Section>
                <Section title="Change Type (Cast)">
                  <CastTypeForm cols={allCols} onAdd={addOp} />
                </Section>
                <Section title="Create New Column (Formula)">
                  <CreateColumnForm cols={allCols} onAdd={addOp} />
                </Section>
                <Section title="Reorder Columns">
                  <ReorderForm cols={allCols} onAdd={addOp} />
                </Section>
                <Section title="Sort Rows">
                  <SortForm cols={allCols} onAdd={addOp} />
                </Section>
              </div>
            )}

            {/* Tab: Clean */}
            {activeTab === "clean" && (
              <div className="space-y-3">
                <Section title="Filter Rows (Keep Where)">
                  <FilterRowsForm cols={allCols} onAdd={addOp} />
                </Section>
                <Section title="Clip Values">
                  <ClipForm cols={numericCols} onAdd={addOp} />
                </Section>
                <Section title="Cap Outliers (Winsorize)">
                  <CapOutliersForm cols={numericCols} onAdd={addOp} />
                </Section>
                <Section title="Drop Outliers">
                  <DropOutliersForm cols={numericCols} onAdd={addOp} />
                </Section>
                <Section title="Sample Rows">
                  <SampleForm onAdd={addOp} totalRows={profile?.total_rows ?? 0} />
                </Section>
                <Section title="Text Cleaning">
                  <TextCleanForm cols={[...textCols, ...catCols, ...allCols].filter((v, i, a) => a.indexOf(v) === i)} onAdd={addOp} />
                </Section>
              </div>
            )}

            {/* Tab: Feature Engineering */}
            {activeTab === "feature" && (
              <div className="space-y-3">
                <Section title="Encode Categorical">
                  <EncodeForm cols={catCols.length ? catCols : allCols} onAdd={addOp} />
                </Section>
                <Section title="Scale Numeric">
                  <ScaleForm cols={numericCols} onAdd={addOp} />
                </Section>
                <Section title="Log Transform (Skewed Columns)">
                  <LogTransformForm cols={numericCols} onAdd={addOp} />
                </Section>
                <Section title="Sqrt Transform">
                  <SqrtTransformForm cols={numericCols} onAdd={addOp} />
                </Section>
                <Section title="Bin / Discretize">
                  <BinForm cols={numericCols} onAdd={addOp} />
                </Section>
                <Section title="Extract from Datetime">
                  <DatetimeExtractForm cols={datetimeCols.length ? datetimeCols : allCols} onAdd={addOp} />
                </Section>
              </div>
            )}
          </div>

          {/* ── Pipeline (2 cols) ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Pipeline <span className="text-muted-foreground font-normal">({ops.length} steps)</span></h2>
                {ops.length > 0 && (
                  <button onClick={() => { setOps([]); setResult(null); }} className="text-xs text-red-400 hover:text-red-600 transition">Clear all</button>
                )}
              </div>

              {ops.length === 0 ? (
                <div className="bg-muted rounded-xl border-2 border-dashed border-border py-10 text-center">
                  <Wand2 className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Add operations from the left panel</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {ops.map((op, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => { dragIdx.current = i; }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIdx.current !== null) reorderOps(dragIdx.current, i);
                        setDragOverIdx(null);
                        dragIdx.current = null;
                      }}
                      onDragEnd={() => { setDragOverIdx(null); dragIdx.current = null; }}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 select-none transition",
                        OP_COLORS[op.type] ?? "bg-muted text-foreground border-border",
                        dragOverIdx === i ? "ring-2 ring-brand/50 ring-offset-1 scale-[1.01]" : "cursor-grab active:cursor-grabbing active:opacity-60"
                      )}
                    >
                      <GripVertical className="w-3.5 h-3.5 flex-shrink-0 opacity-30" />
                      <span className="text-xs font-medium flex-shrink-0 opacity-40 w-4">{i + 1}.</span>
                      <span className="flex-1 text-xs leading-snug truncate">{opLabel(op)}</span>
                      <button
                        onClick={() => removeOp(i)}
                        className="flex-shrink-0 hover:opacity-70 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {ops.length > 0 && (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => applyMutation.mutate()}
                    disabled={applyMutation.isPending}
                    className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {applyMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</>
                      : <><Wand2 className="w-4 h-4" /> Apply {ops.length} Operations</>
                    }
                  </button>

                  {result && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-xs text-emerald-800 space-y-1">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> Done — {result.rows.toLocaleString()} rows × {result.columns} columns
                      </p>
                      {result.errors?.length > 0 && (
                        <div className="space-y-0.5">
                          {result.errors.map((e, i) => (
                            <p key={i} className="text-amber-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {e.op}: {e.error}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {result && (
                    <button
                      onClick={() => datasetsApi.export(datasetId).then((res) => {
                        const url = URL.createObjectURL(new Blob([res.data]));
                        const a = document.createElement("a");
                        a.href = url; a.download = `${dataset?.name ?? "dataset"}_transformed.csv`; a.click();
                        URL.revokeObjectURL(url);
                      })}
                      className="w-full py-2.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Export Transformed CSV
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Smart Clean ───────────────────────────────────────────────────────────────
interface SmartCleanSuggestion {
  column: string;
  issue_type: "whitespace" | "inconsistent_casing" | "mixed_date_format" | string;
  severity: "low" | "medium" | "high" | string;
  description: string;
  affected_count: number;
  affected_pct: number;
  operation: TransformOp;
  examples: { before: string; after: string }[];
}

const ISSUE_LABELS: Record<string, string> = {
  whitespace: "Whitespace",
  inconsistent_casing: "Inconsistent Casing",
  fuzzy_duplicates: "Near-Duplicate Values",
  mixed_date_format: "Mixed Date Format",
};

function severityMeta(sev: string) {
  if (sev === "high") return { Icon: AlertOctagon, color: "text-rose-600 bg-rose-50 border-rose-200" };
  if (sev === "medium") return { Icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" };
  return { Icon: Info, color: "text-blue-600 bg-blue-50 border-blue-200" };
}

function SmartCleanPanel({
  datasetId, ops, addOp,
}: { datasetId: string; ops: TransformOp[]; addOp: (op: TransformOp) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["smart-clean", datasetId],
    queryFn: () => datasetsApi.getSmartClean(datasetId).then((r) => r.data),
  });

  const suggestions: SmartCleanSuggestion[] = data?.suggestions ?? [];

  const isAdded = (sugg: SmartCleanSuggestion) =>
    ops.some((o) => o.type === sugg.operation.type && "column" in o && o.column === sugg.column);

  const pending = suggestions.filter((s) => !isAdded(s));

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border py-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Scanning for cleanable issues…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
        Failed to load Smart Clean suggestions.
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-10 text-center">
        <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-sm text-emerald-700 font-medium">No cleanable issues detected</p>
        <p className="text-xs text-emerald-600 mt-1">Casing, whitespace, and date formats all look consistent.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <WandSparkles className="w-4 h-4 text-brand" />
          <span className="text-sm font-semibold text-foreground">
            {suggestions.length} issue{suggestions.length !== 1 ? "s" : ""} found
          </span>
        </div>
        {pending.length > 0 && (
          <button
            onClick={() => pending.forEach((s) => addOp(s.operation))}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition"
          >
            <Plus className="w-3 h-3" /> Add all {pending.length} to pipeline
          </button>
        )}
      </div>

      {suggestions.map((sugg, i) => (
        <SmartCleanCard
          key={`${sugg.column}-${sugg.issue_type}-${i}`}
          suggestion={sugg}
          added={isAdded(sugg)}
          onAdd={() => addOp(sugg.operation)}
        />
      ))}
    </div>
  );
}

function SmartCleanCard({
  suggestion, added, onAdd,
}: { suggestion: SmartCleanSuggestion; added: boolean; onAdd: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { Icon, color } = severityMeta(suggestion.severity);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className={cn("flex items-center justify-center w-7 h-7 rounded-lg border flex-shrink-0", color)}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-semibold text-foreground">{suggestion.column}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", color)}>
              {ISSUE_LABELS[suggestion.issue_type] ?? suggestion.issue_type}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {suggestion.affected_count.toLocaleString()} rows · {suggestion.affected_pct}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
          {suggestion.examples.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] text-brand hover:underline mt-1.5 flex items-center gap-0.5"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expanded ? "Hide" : "Show"} before → after examples
            </button>
          )}
        </div>
        <button
          onClick={onAdd}
          disabled={added}
          className={cn(
            "flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition",
            added ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-brand text-white hover:bg-[#2a0d8a]"
          )}
        >
          {added ? <><CheckCircle className="w-3.5 h-3.5" /> Added</> : <><Plus className="w-3.5 h-3.5" /> Add to pipeline</>}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border bg-muted/60 px-4 py-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Before</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">After</span>
            {suggestion.examples.map((ex, i) => (
              <Fragment key={i}>
                <span className="font-mono text-muted-foreground truncate">{ex.before}</span>
                <span className="font-mono text-emerald-700 truncate">{ex.after}</span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
      >
        {title}
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function QuickButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 bg-card rounded-xl border border-border hover:border-brand/30 transition text-xs font-medium text-foreground flex items-center gap-2"
    >
      <span className="text-muted-foreground">{icon}</span> {label}
    </button>
  );
}

function ColSelect({ cols, value, onChange, placeholder }: { cols: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand bg-card">
      {placeholder && <option value="">{placeholder}</option>}
      {cols.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// ── Operation Forms ───────────────────────────────────────────────────────────
function MultiColSelectForm({ cols, buttonLabel, onAdd }: { cols: string[]; buttonLabel: string; onAdd: (cols: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (c: string) => setSelected((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);
  return (
    <div className="space-y-2">
      <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-0.5">
        {cols.map((c) => (
          <label key={c} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-muted rounded">
            <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} className="rounded" />
            <span className="text-xs font-mono text-foreground truncate">{c}</span>
          </label>
        ))}
      </div>
      <button onClick={() => { if (selected.length) { onAdd(selected); setSelected([]); } }} disabled={!selected.length}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] disabled:opacity-50 transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> {buttonLabel}
      </button>
    </div>
  );
}

function FillMissingForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [strategy, setStrategy] = useState<"mean" | "median" | "mode" | "constant" | "ffill" | "bfill">("median");
  const [value, setValue] = useState("");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <ColSelect cols={cols} value={col} onChange={setCol} />
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand bg-card">
          {["mean", "median", "mode", "constant", "ffill", "bfill"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {strategy === "constant" && (
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Fill value"
          className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
      )}
      <button onClick={() => col && onAdd({ type: "fill_missing", column: col, strategy, value: value || undefined })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function RenameForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [newName, setNewName] = useState("");
  return (
    <div className="flex gap-2 flex-wrap">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New name"
        className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand min-w-0" />
      <button onClick={() => col && newName && onAdd({ type: "rename_column", old_name: col, new_name: newName })}
        disabled={!newName}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] disabled:opacity-50 transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function CastTypeForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [toType, setToType] = useState<"int" | "float" | "str" | "datetime" | "bool">("float");
  return (
    <div className="flex gap-2 flex-wrap">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <select value={toType} onChange={(e) => setToType(e.target.value as typeof toType)}
        className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand bg-card">
        {["int", "float", "str", "datetime", "bool"].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <button onClick={() => col && onAdd({ type: "cast_type", column: col, to_type: toType })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function CreateColumnForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [name, setName] = useState("");
  const [expr, setExpr] = useState("");
  return (
    <div className="space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New column name"
        className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
      <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder={`Expression, e.g. ${cols[0] ?? "col_a"} * 2`}
        className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand font-mono" />
      <p className="text-xs text-muted-foreground">Use column names directly. Supports np.log(), np.sqrt(), abs(), +, -, *, /</p>
      <button onClick={() => name && expr && onAdd({ type: "create_column", name, expression: expr })}
        disabled={!name || !expr}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] disabled:opacity-50 transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function ReorderForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [order, setOrder] = useState(cols.join(", "));
  return (
    <div className="space-y-2">
      <textarea value={order} onChange={(e) => setOrder(e.target.value)} rows={2}
        className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand font-mono resize-none"
        placeholder="col1, col2, col3 ..." />
      <p className="text-xs text-muted-foreground">Comma-separated column order. Unlisted columns are appended at the end.</p>
      <button onClick={() => onAdd({ type: "reorder_columns", columns: order.split(",").map((c) => c.trim()).filter(Boolean) })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function SortForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [asc, setAsc] = useState(true);
  return (
    <div className="flex gap-2 flex-wrap">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <select value={asc ? "asc" : "desc"} onChange={(e) => setAsc(e.target.value === "asc")}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-brand">
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
      <button onClick={() => col && onAdd({ type: "sort_rows", by: [col], ascending: [asc] })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function FilterRowsForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [op, setOp] = useState("eq");
  const [value, setValue] = useState("");
  const ops = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "not_contains", "startswith", "endswith"];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <ColSelect cols={cols} value={col} onChange={setCol} />
        <select value={op} onChange={(e) => setOp(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-brand">
          {ops.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value"
          className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      <button onClick={() => col && value && onAdd({ type: "filter_rows", column: col, operator: op, value })}
        disabled={!col || !value}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] disabled:opacity-50 transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Keep matching rows
      </button>
    </div>
  );
}

function ClipForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  return (
    <div className="space-y-2">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <div className="grid grid-cols-2 gap-2">
        <input value={lower} onChange={(e) => setLower(e.target.value)} placeholder="Min (optional)"
          className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
        <input value={upper} onChange={(e) => setUpper(e.target.value)} placeholder="Max (optional)"
          className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      <button onClick={() => col && onAdd({ type: "clip", column: col, lower: lower ? parseFloat(lower) : undefined, upper: upper ? parseFloat(upper) : undefined })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function CapOutliersForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [method, setMethod] = useState<"iqr" | "percentile">("iqr");
  return (
    <div className="flex gap-2 flex-wrap">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-brand">
        <option value="iqr">IQR</option>
        <option value="percentile">1st–99th %ile</option>
      </select>
      <button onClick={() => col && onAdd({ type: "cap_outliers", column: col, method })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function DropOutliersForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [method, setMethod] = useState<"iqr" | "zscore">("iqr");
  return (
    <div className="flex gap-2 flex-wrap">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-brand">
        <option value="iqr">IQR</option>
        <option value="zscore">Z-Score</option>
      </select>
      <button onClick={() => col && onAdd({ type: "drop_outliers", column: col, method })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function SampleForm({ onAdd, totalRows }: { onAdd: (op: TransformOp) => void; totalRows: number }) {
  const [mode, setMode] = useState<"n" | "frac">("frac");
  const [n, setN] = useState("1000");
  const [frac, setFrac] = useState("0.1");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(["n", "frac"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={cn("text-xs px-2.5 py-1 rounded-md transition", mode === m ? "bg-brand text-white" : "bg-muted text-muted-foreground")}>
            {m === "n" ? "Row count" : "Fraction"}
          </button>
        ))}
      </div>
      {mode === "n"
        ? <input type="number" value={n} onChange={(e) => setN(e.target.value)} placeholder="Number of rows"
            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
        : <input type="number" value={frac} min="0" max="1" step="0.05" onChange={(e) => setFrac(e.target.value)} placeholder="Fraction (0–1)"
            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
      }
      <p className="text-xs text-muted-foreground">Total rows: {totalRows.toLocaleString()}</p>
      <button onClick={() => onAdd(mode === "n" ? { type: "sample_rows", n: parseInt(n) } : { type: "sample_rows", frac: parseFloat(frac) })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function TextCleanForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [lowercase, setLowercase] = useState(true);
  const [strip, setStrip] = useState(true);
  const [removeSpecial, setRemoveSpecial] = useState(false);
  const [repFrom, setRepFrom] = useState("");
  const [repTo, setRepTo] = useState("");
  return (
    <div className="space-y-2">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={strip} onChange={(e) => setStrip(e.target.checked)} /> Strip whitespace</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={lowercase} onChange={(e) => setLowercase(e.target.checked)} /> Lowercase</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={removeSpecial} onChange={(e) => setRemoveSpecial(e.target.checked)} /> Remove special chars</label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={repFrom} onChange={(e) => setRepFrom(e.target.value)} placeholder="Find text (optional)"
          className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
        <input value={repTo} onChange={(e) => setRepTo(e.target.value)} placeholder="Replace with"
          className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      <button onClick={() => col && onAdd({ type: "text_clean", column: col, lowercase, strip, remove_special: removeSpecial, replace_from: repFrom || undefined, replace_to: repTo || undefined })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function EncodeForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [method, setMethod] = useState<"label" | "onehot">("label");
  return (
    <div className="flex gap-2 flex-wrap">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-brand">
        <option value="label">Label Encode</option>
        <option value="onehot">One-Hot Encode</option>
      </select>
      <button onClick={() => col && onAdd({ type: "encode", column: col, method })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function ScaleForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [method, setMethod] = useState<"standard" | "minmax" | "robust">("standard");
  return (
    <div className="flex gap-2 flex-wrap">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-brand">
        <option value="standard">Standard (Z-score)</option>
        <option value="minmax">Min-Max [0,1]</option>
        <option value="robust">Robust (median/IQR)</option>
      </select>
      <button onClick={() => col && onAdd({ type: "scale", column: col, method })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function LogTransformForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [variant, setVariant] = useState<"log" | "log1p">("log1p");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <ColSelect cols={cols} value={col} onChange={setCol} />
        <select value={variant} onChange={(e) => setVariant(e.target.value as typeof variant)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="log1p">log1p (safe for 0s)</option>
          <option value="log">log (skip zeros)</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">Creates a new column `{col}_log1p`. Original column is kept.</p>
      <button onClick={() => col && onAdd({ type: "log_transform", column: col, variant })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function SqrtTransformForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  return (
    <div className="space-y-2">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <p className="text-xs text-muted-foreground">Creates `{col}_sqrt`. Clips negative values to 0.</p>
      <button onClick={() => col && onAdd({ type: "sqrt_transform", column: col })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function BinForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const [bins, setBins] = useState(5);
  const [strategy, setStrategy] = useState<"cut" | "qcut">("cut");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <ColSelect cols={cols} value={col} onChange={setCol} />
        <input type="number" value={bins} min={2} max={20} onChange={(e) => setBins(parseInt(e.target.value))} placeholder="# bins"
          className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand" />
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="cut">Equal-width</option>
          <option value="qcut">Equal-frequency</option>
        </select>
      </div>
      <button onClick={() => col && onAdd({ type: "bin", column: col, bins, strategy })}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function DatetimeExtractForm({ cols, onAdd }: { cols: string[]; onAdd: (op: TransformOp) => void }) {
  const [col, setCol] = useState(cols[0] ?? "");
  const allParts = ["year", "month", "day", "hour", "minute", "weekday", "quarter"];
  const [parts, setParts] = useState<string[]>(["year", "month", "day"]);
  const toggle = (p: string) => setParts((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  return (
    <div className="space-y-2">
      <ColSelect cols={cols} value={col} onChange={setCol} />
      <div className="flex flex-wrap gap-2">
        {allParts.map((p) => (
          <button key={p} onClick={() => toggle(p)}
            className={cn("text-xs px-2 py-0.5 rounded border transition", parts.includes(p) ? "bg-brand text-white border-brand" : "bg-card text-muted-foreground border-border hover:border-brand/40")}>
            {p}
          </button>
        ))}
      </div>
      <button onClick={() => col && parts.length && onAdd({ type: "extract_datetime", column: col, parts })}
        disabled={!parts.length}
        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-[#2a0d8a] disabled:opacity-50 transition flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}
