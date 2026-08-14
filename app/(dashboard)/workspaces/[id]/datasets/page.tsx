"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { datasetsApi, workspacesApi, workspacesExtraApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  Upload, Database, FileText, ChevronRight, Clock, Rows, Columns,
  CheckCircle, AlertCircle, Loader2, X, Plus, GitMerge, Trash2,
  FileSpreadsheet, FileCode, ChevronDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Dataset } from "@/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExt(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

type Preview = { columns: string[]; rows: string[][] };

async function parseCsvPreview(file: File): Promise<Preview> {
  const text = await file.slice(0, 80_000).text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const parseLine = (l: string) =>
    l.split(",").map((c) => c.trim().replace(/^"|"$/g, "").slice(0, 40));
  const columns = parseLine(lines[0] ?? "").slice(0, 7);
  const rows = lines
    .slice(1, 6)
    .map((l) => parseLine(l).slice(0, 7).map((v, i) => (i < columns.length ? v : "")));
  return { columns, rows };
}

async function parseTsvPreview(file: File): Promise<Preview> {
  const text = await file.slice(0, 80_000).text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const parseLine = (l: string) => l.split("\t").map((c) => c.slice(0, 40));
  const columns = parseLine(lines[0] ?? "").slice(0, 7);
  const rows = lines.slice(1, 6).map((l) => parseLine(l).slice(0, 7));
  return { columns, rows };
}

async function parseJsonPreview(file: File): Promise<Preview> {
  try {
    const text = await file.slice(0, 200_000).text();
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    const columns = arr.length ? Object.keys(arr[0]).slice(0, 7) : [];
    const rows = arr.slice(0, 5).map((item) => columns.map((c) => String(item[c] ?? "").slice(0, 40)));
    return { columns, rows };
  } catch {
    return { columns: ["(parse error)"], rows: [] };
  }
}

type SheetMeta = { name: string; selected: boolean };

type FileEntry = {
  id: string;
  file: File;
  datasetName: string;
  ext: string;
  sizeLabel: string;
  // Excel
  sheets: SheetMeta[] | null;
  sheetPreviews: Record<string, Preview | null>;
  activeSheet: string;
  // Non-Excel
  preview: Preview | null;
  previewLoading: boolean;
  // Upload state
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

function makeEntry(file: File): FileEntry {
  const ext = getExt(file);
  return {
    id: `${file.name}-${file.size}-${Date.now()}`,
    file,
    datasetName: file.name.replace(/\.[^.]+$/, ""),
    ext,
    sizeLabel: formatSize(file.size),
    sheets: null,
    sheetPreviews: {},
    activeSheet: "",
    preview: null,
    previewLoading: ["csv", "tsv", "json"].includes(ext),
    status: "pending",
  };
}

function FileIcon({ ext }: { ext: string }) {
  if (["xlsx", "xls"].includes(ext))
    return <FileSpreadsheet className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
  if (ext === "json")
    return <FileCode className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
  if (ext === "parquet")
    return <Database className="w-5 h-5 text-orange-500 dark:text-orange-400" />;
  return <FileText className="w-5 h-5 text-brand" />;
}

function PreviewTable({ preview }: { preview: Preview }) {
  if (!preview.columns.length) return <p className="text-xs text-muted-foreground italic">No data</p>;
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="min-w-full text-[11px]">
        <thead>
          <tr className="bg-muted">
            {preview.columns.map((c, i) => (
              <th key={i} className="px-2 py-1 text-left font-semibold text-muted-foreground whitespace-nowrap max-w-[120px] truncate border-b border-border">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-card" : "bg-muted/50"}>
              {preview.columns.map((_, ci) => (
                <td key={ci} className="px-2 py-1 text-muted-foreground max-w-[120px] truncate whitespace-nowrap">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── UploadModal ───────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  pending: "",
  uploading: "border-brand/30 bg-brand/5",
  done: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/40",
  error: "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/40",
};

function UploadModal({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);

  // ── parse preview after entry is added ──
  useEffect(() => {
    const unparsed = entries.filter((e) => e.previewLoading && e.sheets === null && !["xlsx", "xls", "parquet"].includes(e.ext));
    if (!unparsed.length) return;

    unparsed.forEach(async (entry) => {
      let preview: Preview = { columns: [], rows: [] };
      try {
        if (entry.ext === "csv") preview = await parseCsvPreview(entry.file);
        else if (entry.ext === "tsv" || entry.ext === "txt") preview = await parseTsvPreview(entry.file);
        else if (entry.ext === "json") preview = await parseJsonPreview(entry.file);
      } catch { /* ignore */ }
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, preview, previewLoading: false } : e))
      );
    });
  }, [entries]);

  // ── parse Excel sheets ──
  const parseExcel = useCallback(async (entryId: string, file: File) => {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { sheetRows: 7 });
    const sheetPreviews: Record<string, Preview> = {};
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      const headers = ((raw[0] as string[]) ?? []).slice(0, 7).map(String);
      const rows = (raw.slice(1, 6) as string[][]).map((r) =>
        headers.map((_, i) => String(r?.[i] ?? "").slice(0, 40))
      );
      sheetPreviews[name] = { columns: headers, rows };
    }
    const sheets: SheetMeta[] = wb.SheetNames.map((n) => ({ name: n, selected: true }));
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, sheets, sheetPreviews, activeSheet: sheets[0]?.name ?? "", previewLoading: false }
          : e
      )
    );
  }, []);

  // ── add files ──
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const newEntries: FileEntry[] = arr.map(makeEntry);
      setEntries((prev) => {
        const existingNames = new Set(prev.map((e) => e.id));
        return [...prev, ...newEntries.filter((e) => !existingNames.has(e.id))];
      });
      newEntries.forEach((entry) => {
        if (["xlsx", "xls"].includes(entry.ext)) parseExcel(entry.id, entry.file);
      });
    },
    [parseExcel]
  );

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const toggleSheet = (entryId: string, sheetName: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id !== entryId
          ? e
          : {
              ...e,
              sheets: e.sheets!.map((s) =>
                s.name === sheetName ? { ...s, selected: !s.selected } : s
              ),
            }
      )
    );
  };

  // ── upload ──
  const totalDatasets = entries.reduce((sum, e) => {
    if (e.sheets) return sum + e.sheets.filter((s) => s.selected).length;
    return sum + 1;
  }, 0);

  const handleUpload = async () => {
    setUploading(true);

    for (const entry of entries) {
      const targets =
        entry.sheets
          ? entry.sheets
              .filter((s) => s.selected)
              .map((s) => ({
                sheet: s.name,
                name: entry.sheets!.filter((x) => x.selected).length === 1
                  ? entry.datasetName
                  : `${entry.datasetName} — ${s.name}`,
              }))
          : [{ sheet: undefined as string | undefined, name: entry.datasetName }];

      if (!targets.length) continue;

      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status: "uploading" } : e))
      );

      let ok = true;
      for (const { sheet, name } of targets) {
        try {
          await datasetsApi.createViaUpload(workspaceId, entry.file, {
            name,
            source_type: "file",
            config_json: sheet ? JSON.stringify({ sheet_name: sheet }) : undefined,
          });
        } catch {
          ok = false;
        }
      }

      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, status: ok ? "done" : "error" } : e
        )
      );
    }

    qc.invalidateQueries({ queryKey: queryKeys.datasets.list(workspaceId) });
    setUploading(false);
    setAllDone(true);
    setTimeout(onClose, 1400);
  };

  const hasFiles = entries.length > 0;
  const canUpload = hasFiles && !uploading && !allDone && totalDatasets > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Upload Datasets</h2>
            {hasFiles && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {entries.length} file{entries.length !== 1 ? "s" : ""} &middot;{" "}
                {totalDatasets} dataset{totalDatasets !== 1 ? "s" : ""} to upload
              </p>
            )}
          </div>
          <button onClick={onClose} disabled={uploading} className="p-1.5 rounded-lg hover:bg-muted transition">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Drop zone */}
          <div
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl px-6 py-8 text-center cursor-pointer hover:border-brand/50 hover:bg-brand/[0.03] transition group"
          >
            <Upload className="w-8 h-8 text-muted-foreground/60 group-hover:text-brand/50 mx-auto mb-2 transition" />
            <p className="text-sm text-muted-foreground">
              Drop files here or <span className="text-brand font-medium">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">CSV, Excel (.xlsx/.xls), JSON, Parquet, TSV &middot; Multiple files supported</p>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept=".csv,.xlsx,.xls,.json,.parquet,.tsv,.txt"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* File entries */}
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`border rounded-xl overflow-hidden transition ${STATUS_COLOR[entry.status] || "border-border"}`}
            >
              {/* File header row */}
              <div className="flex items-center gap-3 px-4 py-3 bg-card/80">
                <FileIcon ext={entry.ext} />
                <div className="flex-1 min-w-0">
                  <input
                    value={entry.datasetName}
                    onChange={(e) =>
                      setEntries((prev) =>
                        prev.map((x) => x.id === entry.id ? { ...x, datasetName: e.target.value } : x)
                      )
                    }
                    disabled={uploading}
                    className="w-full text-sm font-medium text-foreground bg-transparent outline-none border-b border-transparent focus:border-brand/40 pb-0.5 truncate"
                    placeholder="Dataset name"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {entry.file.name} &middot; {entry.sizeLabel}
                    {entry.sheets && ` &middot; ${entry.sheets.length} sheet${entry.sheets.length !== 1 ? "s" : ""}`}
                  </p>
                </div>

                {/* Status badge */}
                {entry.status === "uploading" && <Loader2 className="w-4 h-4 text-brand animate-spin flex-shrink-0" />}
                {entry.status === "done" && <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />}
                {entry.status === "error" && <AlertCircle className="w-4 h-4 text-red-400 dark:text-red-400 flex-shrink-0" />}

                {entry.status === "pending" && (
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="p-1 rounded-md hover:bg-red-50 dark:bg-red-950/40 text-muted-foreground/60 hover:text-red-400 dark:text-red-400 transition flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Excel: sheet selector */}
              {entry.sheets && (
                <div className="px-4 pb-3 border-t border-border bg-muted/60">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide pt-2.5 mb-2">
                    Sheets — click to toggle upload
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {entry.sheets.map((sheet) => (
                      <button
                        key={sheet.name}
                        onClick={() => !uploading && toggleSheet(entry.id, sheet.name)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                          sheet.selected
                            ? "bg-brand text-white border-brand"
                            : "bg-card text-muted-foreground border-border hover:border-border"
                        }`}
                      >
                        {sheet.selected ? "✓ " : ""}{sheet.name}
                      </button>
                    ))}
                  </div>

                  {/* Sheet preview tabs */}
                  {entry.sheets.length > 0 && (
                    <>
                      <div className="flex gap-1 mb-2">
                        <span className="text-[11px] text-muted-foreground mr-1 self-center">Preview:</span>
                        {entry.sheets.map((s) => (
                          <button
                            key={s.name}
                            onClick={() =>
                              setEntries((prev) =>
                                prev.map((e) => e.id === entry.id ? { ...e, activeSheet: s.name } : e)
                              )
                            }
                            className={`px-2 py-0.5 text-[11px] rounded border transition ${
                              entry.activeSheet === s.name
                                ? "bg-card border-brand/30 text-brand font-medium"
                                : "bg-transparent border-transparent text-muted-foreground hover:text-muted-foreground"
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                      {entry.sheetPreviews[entry.activeSheet]
                        ? <PreviewTable preview={entry.sheetPreviews[entry.activeSheet]!} />
                        : <div className="h-8 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading preview...</div>
                      }
                    </>
                  )}
                </div>
              )}

              {/* CSV/JSON/TSV preview */}
              {!entry.sheets && (
                <div className="px-4 pb-3 border-t border-border bg-muted/40">
                  <div className="pt-2.5">
                    {entry.previewLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Generating preview...
                      </div>
                    ) : entry.preview ? (
                      <PreviewTable preview={entry.preview} />
                    ) : (
                      <p className="text-xs text-muted-foreground italic py-1">No preview available</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {allDone && (
            <div className="flex items-center gap-2 justify-center py-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="w-4 h-4" /> All datasets uploaded successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0 bg-muted/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 transition"
          >
            {allDone ? "Close" : "Cancel"}
          </button>

          <div className="flex items-center gap-3">
            {hasFiles && !allDone && (
              <button
                onClick={() => !uploading && fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-brand transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add more
              </button>
            )}
            <button
              onClick={handleUpload}
              disabled={!canUpload}
              className="flex items-center gap-2 px-5 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-[#2a0d8a] disabled:opacity-40 transition shadow-sm"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Upload {totalDatasets > 0 ? `${totalDatasets} ` : ""}dataset{totalDatasets !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STATUS_ICON ───────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ReactNode> = {
  ready: <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />,
  processing: <Loader2 className="w-4 h-4 text-brand animate-spin" />,
  failed: <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />,
  pending: <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
};

// ── DatasetCard ───────────────────────────────────────────────────────────────

function DatasetCard({ dataset, workspaceId }: { dataset: Dataset; workspaceId: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => datasetsApi.delete(workspaceId, String(dataset.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.datasets.list(workspaceId) }),
  });

  return (
    <div
      onClick={() => dataset.status === "ready" && router.push(`/datasets/${dataset.id}`)}
      className={`bg-card rounded-xl border p-5 transition group ${
        dataset.status === "ready"
          ? "border-border hover:border-brand/30 hover:shadow-md cursor-pointer"
          : "border-border opacity-75"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {STATUS_ICON[dataset.status]}
            <span className="text-xs text-muted-foreground capitalize">{dataset.status}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete dataset "${dataset.name}"?`)) deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-red-50 dark:bg-red-950/40 text-muted-foreground hover:text-red-600 dark:text-red-400"
          >
            {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-foreground mb-0.5 truncate">{dataset.name}</h3>
      {dataset.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{dataset.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {dataset.row_count != null && (
          <span className="flex items-center gap-1">
            <Rows className="w-3 h-3" />{dataset.row_count.toLocaleString()} rows
          </span>
        )}
        {dataset.column_count != null && (
          <span className="flex items-center gap-1">
            <Columns className="w-3 h-3" />{dataset.column_count} cols
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="w-3 h-3" />
          {dataset.created_at ? formatDistanceToNow(new Date(dataset.created_at), { addSuffix: true }) : "--"}
        </span>
      </div>

      {dataset.status === "ready" && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {dataset.source_type === "file" ? "File upload" : dataset.source_type}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-brand transition" />
        </div>
      )}
    </div>
  );
}

// ── JoinModal ─────────────────────────────────────────────────────────────────

function JoinModal({ workspaceId, datasets, onClose }: { workspaceId: string; datasets: Dataset[]; onClose: () => void }) {
  const qc = useQueryClient();
  const readyDatasets = datasets.filter((d) => d.status === "ready");
  const [dsA, setDsA] = useState("");
  const [dsB, setDsB] = useState("");
  const [joinType, setJoinType] = useState("inner");
  const [keyA, setKeyA] = useState("");
  const [keyB, setKeyB] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      workspacesExtraApi.joinDatasets(workspaceId, {
        dataset_a_id: Number(dsA), dataset_b_id: Number(dsB),
        join_type: joinType, keys_a: [keyA], keys_b: [keyB],
        name: name || undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.datasets.list(workspaceId) });
      onClose();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail ?? "Join failed");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Join Datasets</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>}
        <div className="space-y-3">
          {[["Dataset A", dsA, setDsA], ["Dataset B", dsB, setDsB]].map(([label, val, setter], idx) => (
            <div key={idx as number}>
              <label className="block text-sm font-medium text-foreground mb-1">{label as string}</label>
              <select value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand">
                <option value="">Select...</option>
                {readyDatasets.filter((d) => String(d.id) !== (idx === 1 ? dsA : dsB)).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Join Type</label>
            <select value={joinType} onChange={(e) => setJoinType(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand">
              {["inner", "left", "right", "outer"].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Key (A)", keyA, setKeyA], ["Key (B)", keyB, setKeyB]].map(([label, val, setter], i) => (
              <div key={i as number}>
                <label className="block text-sm font-medium text-foreground mb-1">{label as string}</label>
                <input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder="column name" className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Result Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Joined_Sales_Users" className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!dsA || !dsB || !keyA || !keyB || mutation.isPending} className="flex-1 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] disabled:opacity-50 transition">
            {mutation.isPending ? "Joining..." : "Join & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DatasetsPage ──────────────────────────────────────────────────────────────

export default function DatasetsPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const [showUpload, setShowUpload] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const { data: workspace } = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspacesApi.get(workspaceId).then((r) => r.data),
  });

  const { data: datasets, isLoading } = useQuery({
    queryKey: queryKeys.datasets.list(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId).then((r) => r.data),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.some((d: Dataset) => d.status === "processing" || d.status === "pending") ? 3000 : false;
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Breadcrumb items={[{ label: "Workspaces", href: "/workspaces" }, { label: workspace?.name ?? "..." }]} />

      <div className="flex items-center justify-between mt-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{workspace?.name ?? "Datasets"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {datasets?.length ?? 0} dataset{datasets?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] transition shadow-sm">
            <Plus className="w-4 h-4" /> Add Dataset
          </button>
        </div>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : !datasets?.length ? (
        <EmptyState
          icon={<Database className="w-12 h-12" />}
          title="No datasets yet"
          description="Upload CSV, Excel, JSON, or Parquet files to start your exploratory data analysis."
          action={
            <button onClick={() => setShowUpload(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] transition">
              Upload dataset
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(datasets as Dataset[]).map((ds) => (
            <DatasetCard key={ds.id} dataset={ds} workspaceId={workspaceId} />
          ))}
        </div>
      )}

      {showUpload && <UploadModal workspaceId={workspaceId} onClose={() => setShowUpload(false)} />}
      {showJoin && datasets && <JoinModal workspaceId={workspaceId} datasets={datasets as Dataset[]} onClose={() => setShowJoin(false)} />}
    </div>
  );
}
