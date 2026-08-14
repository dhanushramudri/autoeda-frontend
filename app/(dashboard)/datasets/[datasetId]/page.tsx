"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi, docsApi, sourcesApi, jobsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { StatCard } from "@/components/shared/StatCard";
import { QualityGauge } from "@/components/charts/QualityGauge";
import { SubNav } from "@/components/layout/SubNav";
import {
  Database, Rows, Columns, FileText, ArrowRight,
  BookOpen, Upload, X, Loader2, CheckCircle2, ChevronDown,
  AlertCircle, RefreshCw, Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const REFRESH_OPTIONS = [
  { label: "Off", value: null },
  { label: "Every 15 min", value: 15 },
  { label: "Every hour", value: 60 },
  { label: "Every 6 hours", value: 360 },
  { label: "Every 24 hours", value: 1440 },
];

// ── Live Sync / Auto-Refresh Widget ─────────────────────────────────────────────

function AutoRefreshWidget({
  datasetId, workspaceId, intervalMinutes, updatedAt, liveSyncEnabled, canLiveSync,
}: {
  datasetId: string; workspaceId: number; intervalMinutes: number | null; updatedAt: string;
  liveSyncEnabled: boolean; canLiveSync: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.datasets.detail(datasetId) });

  const scheduleMut = useMutation({
    mutationFn: (mins: number | null) => datasetsApi.setRefreshSchedule(workspaceId, datasetId, mins),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  const liveSyncMut = useMutation({
    mutationFn: (enabled: boolean) => datasetsApi.setLiveSync(workspaceId, datasetId, enabled),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  // Poll dataset detail every 5s while live sync is on, so "last updated" ticks live
  useEffect(() => {
    if (!liveSyncEnabled) return;
    const id = setInterval(invalidate, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSyncEnabled]);

  const current = REFRESH_OPTIONS.find((o) => o.value === intervalMinutes) ?? REFRESH_OPTIONS[0];
  const isActive = liveSyncEnabled || intervalMinutes != null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
          isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-border bg-card text-muted-foreground hover:bg-muted"
        }`}
      >
        {liveSyncEnabled ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        ) : (
          <RefreshCw className={`w-3.5 h-3.5 ${isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
        )}
        {liveSyncEnabled ? "Live Sync: On" : isActive ? current.label : "Auto-Refresh: Off"}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-card rounded-xl shadow-lg border border-border z-50 py-1.5">
          {canLiveSync ? (
            <>
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Live Sync
              </p>
              <button
                onClick={() => liveSyncMut.mutate(!liveSyncEnabled)}
                disabled={liveSyncMut.isPending}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted transition ${liveSyncEnabled ? "text-emerald-700" : "text-muted-foreground"}`}
              >
                {liveSyncEnabled ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" /> : <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />}
                <span>
                  <span className="text-xs font-semibold block">{liveSyncEnabled ? "On — watching Delta table" : "Turn on Live Sync"}</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">Checks the Delta transaction log every ~20s (metadata only) — reloads automatically only when the table actually changes.</span>
                </span>
              </button>
              <div className="border-t border-border my-1.5" />
              <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Or fixed schedule instead</p>
            </>
          ) : (
            <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Clock className="w-3 h-3" /> Refresh Schedule
            </p>
          )}
          {REFRESH_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => scheduleMut.mutate(opt.value)}
              disabled={scheduleMut.isPending}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted transition ${
                !liveSyncEnabled && opt.value === intervalMinutes ? "text-brand font-semibold" : "text-muted-foreground"
              }`}
            >
              {opt.label}
              {!liveSyncEnabled && opt.value === intervalMinutes && <CheckCircle2 className="w-3.5 h-3.5" />}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1.5 px-3 pb-1">
            <p className="text-[10px] text-muted-foreground">
              Last updated {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export to Databricks Modal ────────────────────────────────────────────────

function ExportToDatabricksModal({
  datasetId, workspaceId, onClose,
}: { datasetId: string; workspaceId: number; onClose: () => void }) {
  const [sourceId, setSourceId] = useState<number | "">("");
  const [catalog, setCatalog]   = useState("");
  const [schema, setSchema]     = useState("");
  const [table, setTable]       = useState("");
  const [mode, setMode]         = useState<"overwrite" | "append">("overwrite");
  const [jobId, setJobId]       = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<{ status: string; message?: string; progress: number; result_data?: { rows_written: number; fqtn: string } } | null>(null);
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: sourcesData } = useQuery({
    queryKey: ["sources-for-export", workspaceId],
    queryFn: () => sourcesApi.list(String(workspaceId)).then((r) => r.data),
  });
  const databricksSources = (sourcesData?.sources ?? []).filter((s: { source_type: string }) => s.source_type === "databricks");

  // Poll job status once we have a jobId
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await jobsApi.get(jobId);
        setJobStatus(res.data);
        if (res.data.status === "completed" || res.data.status === "failed") {
          clearInterval(pollRef.current!);
        }
      } catch { /* ignore */ }
    }, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  const mut = useMutation({
    mutationFn: () =>
      datasetsApi.exportToDatabricks(workspaceId, datasetId, {
        source_id: Number(sourceId),
        catalog, schema, table, mode,
      }).then((r) => r.data),
    onSuccess: (data) => {
      setJobId(data.job_id);
      setJobStatus({ status: "pending", progress: 0, message: "Queued…" });
    },
  });

  const valid = sourceId !== "" && catalog.trim() && schema.trim() && table.trim();
  const isRunning = jobStatus && (jobStatus.status === "pending" || jobStatus.status === "running");
  const isDone    = jobStatus?.status === "completed";
  const isFailed  = jobStatus?.status === "failed";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Upload className="w-4 h-4 text-orange-600" />
            </div>
            <h2 className="text-base font-bold text-foreground">Export to Databricks</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Running state */}
        {isRunning && (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-brand animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Exporting in background…</p>
                <p className="text-xs text-muted-foreground mt-0.5">{jobStatus?.message}</p>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${Math.max(jobStatus?.progress ?? 0, 8)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">You can close this dialog — the export continues in the background. Check the jobs panel (bell icon) for progress.</p>
            <button onClick={onClose} className="w-full py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition">
              Close & continue working
            </button>
          </div>
        )}

        {/* Success */}
        {isDone && jobStatus?.result_data && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-sm font-semibold text-foreground">{jobStatus.result_data.rows_written.toLocaleString()} rows written</p>
            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1.5 rounded-lg">{jobStatus.result_data.fqtn}</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-[#2a0d8a] transition">
              Done
            </button>
          </div>
        )}

        {/* Failed */}
        {isFailed && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-sm font-semibold text-foreground">Export failed</p>
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg font-mono text-center">{jobStatus?.message}</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition">Close</button>
          </div>
        )}

        {/* Form */}
        {!jobId && (
          <>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Databricks Source</label>
                {databricksSources.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">No Databricks sources found.</p>
                ) : (
                  <div className="relative">
                    <select value={sourceId} onChange={(e) => setSourceId(Number(e.target.value))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs appearance-none focus:outline-none focus:border-brand bg-card">
                      <option value="">Select source...</option>
                      {databricksSources.map((s: { id: number; name: string }) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[["Catalog", catalog, setCatalog, "workspace"], ["Schema", schema, setSchema, "autoeda"], ["Table", table, setTable, "my_table"]].map(([label, val, setter, ph]) => (
                  <div key={label as string}>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{label as string}</label>
                    <input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder={ph as string}
                      className="w-full border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-brand font-mono" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Write mode</label>
                <div className="flex gap-2">
                  {(["overwrite", "append"] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition ${mode === m ? "border-brand bg-brand/5 text-brand" : "border-border text-muted-foreground hover:border-border"}`}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{mode === "overwrite" ? "Drops and recreates the table" : "Appends rows to existing table"}</p>
              </div>
              {catalog && schema && table && (
                <div className="bg-muted rounded-lg px-3 py-2 text-[11px] font-mono text-muted-foreground">
                  → <span className="text-brand">{catalog}.{schema}.{table}</span>
                </div>
              )}
              {mut.error && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{(mut.error as Error).message}</p>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition">Cancel</button>
              <button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}
                className="flex-1 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-[#2a0d8a] disabled:opacity-50 flex items-center justify-center gap-1.5 transition">
                {mut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…</> : <><Upload className="w-3.5 h-3.5" /> Export</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const EDA_LINKS = [
  { label: "Column Profile", href: "profile", desc: "Types, stats, and sample values for each column" },
  { label: "Missing Values", href: "missing", desc: "Which columns have nulls and by how much" },
  { label: "Distributions", href: "distributions", desc: "Histograms, KDE, and normality tests" },
  { label: "Correlations", href: "correlations", desc: "Pearson, Spearman, Kendall heatmaps" },
  { label: "Outliers", href: "outliers", desc: "IQR, Z-score, and Isolation Forest detection" },
  { label: "Feature Importance", href: "feature-importance", desc: "Target-based feature ranking" },
  { label: "Time Series", href: "timeseries", desc: "Trends, seasonality, ADF test" },
  { label: "Text Analysis", href: "text", desc: "Word frequency, sentiment, n-grams" },
  { label: "Transform Studio", href: "transform", desc: "Clean, encode, and export your data" },
];

export default function DatasetOverviewPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();
  const [showExport, setShowExport] = useState(false);

  const { data: dataset, isLoading } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: quality } = useQuery({
    queryKey: queryKeys.eda.quality(datasetId),
    queryFn: () => datasetsApi.getQualityScore(datasetId).then((r) => r.data),
    enabled: dataset?.status === "ready",
  });

  const { data: relatedArticles } = useQuery({
    queryKey: queryKeys.docs.forDataset(datasetId),
    queryFn: () => docsApi.articlesForDataset(datasetId).then((r) => r.data),
  });

  if (isLoading) return <PageSpinner />;
  if (!dataset) return null;

  return (
    <>
      {showExport && (
        <ExportToDatabricksModal
          datasetId={datasetId}
          workspaceId={dataset.workspace_id}
          onClose={() => setShowExport(false)}
        />
      )}
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset.workspace_name ?? "Workspace", href: `/workspaces/${dataset.workspace_id}/datasets` },
            { label: dataset.name },
          ]}
        />

        <div className="mt-4 mb-8">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-brand" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{dataset.name}</h1>
              {dataset.source_id != null && (
                <AutoRefreshWidget
                  datasetId={datasetId}
                  workspaceId={dataset.workspace_id}
                  intervalMinutes={dataset.refresh_interval_minutes ?? null}
                  updatedAt={dataset.updated_at}
                  liveSyncEnabled={dataset.live_sync_enabled ?? false}
                  canLiveSync={dataset.source_type === "databricks" && !!dataset.source_table && dataset.source_table.split(".").length === 3}
                />
              )}
              <button
                onClick={() => setShowExport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Export to Databricks
              </button>
            </div>
            {dataset.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{dataset.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Added{" "}
              {dataset.created_at
                ? formatDistanceToNow(new Date(dataset.created_at), { addSuffix: true })
                : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Rows"
          value={dataset.row_count?.toLocaleString() ?? "--"}
          icon={<Rows className="w-4 h-4" />}
        />
        <StatCard
          label="Columns"
          value={dataset.column_count ?? "--"}
          icon={<Columns className="w-4 h-4" />}
        />
        <StatCard
          label="Source"
          value={dataset.source_type ?? "--"}
          icon={<FileText className="w-4 h-4" />}
        />
        <StatCard
          label="Status"
          value={dataset.status}
          color={
            dataset.status === "ready"
              ? "green"
              : dataset.status === "failed"
              ? "red"
              : "amber"
          }
        />
      </div>

      {/* Quality score */}
      {quality && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Data Quality Score</h2>
          <QualityGauge data={quality} />
        </div>
      )}


      {/* Related documentation */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand" /> Related Documentation
          </h2>
          <button onClick={() => router.push("/library")} className="text-xs text-brand hover:text-[#2a0d8a] font-medium">
            Browse Dataset Library
          </button>
        </div>
        {!relatedArticles || relatedArticles.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No documentation linked to this dataset yet. Add an article in the{" "}
            <button onClick={() => router.push("/library")} className="text-brand hover:underline">
              Dataset Library
            </button>{" "}
            describing what it's for.
          </p>
        ) : (
          <div className="space-y-1.5">
            {relatedArticles.map((a: { id: number; title: string; summary?: string | null }) => (
              <button
                key={a.id}
                onClick={() => router.push(`/library/articles/${a.id}`)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition flex items-center justify-between gap-2"
              >
                <span className="text-xs font-medium text-foreground truncate">{a.title}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* EDA navigation grid */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">Explore Analysis Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EDA_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(`/datasets/${datasetId}/${link.href}`)}
              className="text-left bg-card rounded-xl border border-border p-4 hover:border-brand/30 hover:shadow-sm transition group"
              disabled={dataset.status !== "ready"}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-foreground">{link.label}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-brand transition" />
              </div>
              <p className="text-xs text-muted-foreground">{link.desc}</p>
            </button>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
