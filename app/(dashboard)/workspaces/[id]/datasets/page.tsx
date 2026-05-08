"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi, workspacesApi, workspacesExtraApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useJobPoller } from "@/hooks/useJobPoller";
import { PageSpinner, AnalysisLoader } from "@/components/shared/LoadingBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  Upload,
  Database,
  FileText,
  ChevronRight,
  Clock,
  Rows,
  Columns,
  CheckCircle,
AlertCircle,
Loader2,
X,
Plus,
GitMerge,
Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Dataset } from "@/types";

const STATUS_ICON: Record<string, React.ReactNode> = {
  ready: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  processing: <Loader2 className="w-4 h-4 text-brand animate-spin" />,
  failed: <AlertCircle className="w-4 h-4 text-red-500" />,
  pending: <Clock className="w-4 h-4 text-amber-500" />,
};

function UploadModal({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name || file.name.replace(/\.[^.]+$/, ""));
      if (description) fd.append("description", description);
      fd.append("source_type", "file");
      const res = await datasetsApi.create(workspaceId, fd);
      return res.data;
    },
    onSuccess: (data) => {
      setJobId(data.job_id ?? null);
      qc.invalidateQueries({ queryKey: queryKeys.datasets.list(workspaceId) });
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Upload failed");
    },
  });

  const { data: job } = useJobPoller(jobId, () => {
    qc.invalidateQueries({ queryKey: queryKeys.datasets.list(workspaceId) });
    setTimeout(onClose, 1200);
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); if (!name) setName(f.name.replace(/\.[^.]+$/, "")); }
  };

  if (jobId && job) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <AnalysisLoader
            label={job.message ?? "Processing dataset..."}
            progress={job.progress ?? 0}
          />
          {job.status === "completed" && (
            <p className="text-center text-emerald-600 text-sm font-medium mt-4">
              Done! Closing...
            </p>
          )}
          {job.status === "failed" && (
            <div className="text-center mt-4">
              <p className="text-red-600 text-sm">{job.message}</p>
              <button onClick={onClose} className="mt-3 text-sm text-gray-500 underline">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Upload Dataset</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-brand/60 hover:bg-brand/10/30 transition mb-4"
        >
          <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          {file ? (
            <p className="text-sm font-medium text-brand">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-gray-500">Drop file or click to browse</p>
              <p className="text-xs text-gray-400 mt-0.5">CSV, Excel, JSON, Parquet, TSV</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".csv,.xlsx,.xls,.json,.parquet,.tsv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setFile(f); if (!name) setName(f.name.replace(/\.[^.]+$/, "")); }
            }}
          />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dataset name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Data 2024"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!file || mutation.isPending}
            className="flex-1 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] disabled:opacity-50 transition"
          >
            {mutation.isPending ? "Uploading..." : "Upload & Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DatasetCard({ dataset, workspaceId }: { dataset: Dataset; workspaceId: string }) {
  const router = useRouter();
  const qc = useQueryClient();

const deleteMutation = useMutation({
mutationFn: () =>
  datasetsApi.delete(workspaceId, String(dataset.id)), onSuccess: () => {
    qc.invalidateQueries({
      queryKey: queryKeys.datasets.list(workspaceId),
    });
  },
});

  return (
    <div
      onClick={() =>
        dataset.status === "ready" &&
        router.push(`/datasets/${dataset.id}`)
      }
      className={`bg-white rounded-xl border p-5 transition group ${
        dataset.status === "ready"
          ? "border-gray-200 hover:border-brand/30 hover:shadow-md cursor-pointer"
          : "border-gray-100 opacity-75"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
          <FileText className="w-5 h-5 text-gray-500" />
        </div>
<div className="flex items-center gap-2">
  <div className="flex items-center gap-1.5">
    {STATUS_ICON[dataset.status]}
    <span className="text-xs text-gray-400 capitalize">
      {dataset.status}
    </span>
  </div>

  <button
    onClick={(e) => {
      e.stopPropagation();

      const confirmed = window.confirm(
        `Delete dataset "${dataset.name}"?`
      );

      if (!confirmed) return;

      deleteMutation.mutate();
    }}
    disabled={deleteMutation.isPending}
    className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
    title="Delete dataset"
  >
    {deleteMutation.isPending ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
    ) : (
      <Trash2 className="w-3.5 h-3.5" />
    )}
  </button>
</div>
      </div>

      <h3 className="font-semibold text-gray-900 mb-0.5 truncate">{dataset.name}</h3>
      {dataset.description && (
        <p className="text-xs text-gray-400 mb-3 line-clamp-1">{dataset.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400">
        {dataset.row_count != null && (
          <span className="flex items-center gap-1">
            <Rows className="w-3 h-3" />
            {dataset.row_count.toLocaleString()} rows
          </span>
        )}
        {dataset.column_count != null && (
          <span className="flex items-center gap-1">
            <Columns className="w-3 h-3" />
            {dataset.column_count} cols
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="w-3 h-3" />
          {dataset.created_at
            ? formatDistanceToNow(new Date(dataset.created_at), { addSuffix: true })
            : "--"}
        </span>
      </div>

      {dataset.status === "ready" && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {dataset.source_type === "file" ? "File upload" : dataset.source_type}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand transition" />
        </div>
      )}
    </div>
  );
}

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
        dataset_a_id: Number(dsA),
        dataset_b_id: Number(dsB),
        join_type: joinType,
        keys_a: [keyA],
        keys_b: [keyB],
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Join Datasets</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dataset A</label>
            <select value={dsA} onChange={(e) => setDsA(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand">
              <option value="">Select...</option>
              {readyDatasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dataset B</label>
            <select value={dsB} onChange={(e) => setDsB(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand">
              <option value="">Select...</option>
              {readyDatasets.filter((d) => d.id !== dsA).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Join Type</label>
            <select value={joinType} onChange={(e) => setJoinType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand">
              {["inner", "left", "right", "outer"].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key (A)</label>
              <input value={keyA} onChange={(e) => setKeyA(e.target.value)} placeholder="column name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key (B)</label>
              <input value={keyB} onChange={(e) => setKeyB(e.target.value)} placeholder="column name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Result Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Joined_Sales_Users" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!dsA || !dsB || !keyA || !keyB || mutation.isPending}
            className="flex-1 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] disabled:opacity-50 transition"
          >
            {mutation.isPending ? "Joining..." : "Join & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
      const hasProcessing = data.some(
        (d: Dataset) => d.status === "processing" || d.status === "pending"
      );
      return hasProcessing ? 3000 : false;
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Workspaces", href: "/workspaces" },
          { label: workspace?.name ?? "..." },
        ]}
      />

      <div className="flex items-center justify-between mt-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{workspace?.name ?? "Datasets"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {datasets?.length ?? 0} dataset{datasets?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <GitMerge className="w-4 h-4" />
            Join
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Dataset
          </button>
        </div>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : !datasets?.length ? (
        <EmptyState
          icon={<Database className="w-12 h-12" />}
          title="No datasets yet"
          description="Upload a CSV, Excel, JSON, or Parquet file to start your exploratory data analysis."
          action={
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] transition"
            >
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

      {showUpload && (
        <UploadModal workspaceId={workspaceId} onClose={() => setShowUpload(false)} />
      )}
      {showJoin && datasets && (
        <JoinModal workspaceId={workspaceId} datasets={datasets as Dataset[]} onClose={() => setShowJoin(false)} />
      )}
    </div>
  );
}
