"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sourcesApi } from "@/lib/api";
import {
  Plug, Plus, Search, Trash2, TestTube2, ExternalLink,
  CheckCircle2, XCircle, Clock, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { ConnectorLogo } from "@/components/shared/ConnectorLogo";

interface DataSource {
  id: number;
  name: string;
  description?: string;
  source_type: string;
  status: "connected" | "failed" | "untested";
  last_tested_at?: string;
  last_error?: string;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mssql: "SQL Server",
  sqlite: "SQLite",
  redshift: "Redshift",
  snowflake: "Snowflake",
  bigquery: "BigQuery",
  mongodb: "MongoDB",
  s3: "Amazon S3",
  azure_blob: "Azure Blob",
  gcs: "Google Cloud Storage",
  google_drive: "Google Drive",
  rest_api: "REST API",
  graphql: "GraphQL",
  csv: "CSV / TSV",
  excel: "Excel",
  json: "JSON",
  parquet: "Parquet",
  databricks: "Databricks",
  fabric: "Microsoft Fabric",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Connected
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
      <Clock className="w-3 h-3" /> Untested
    </span>
  );
}

export default function SourcesPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [testingId, setTestingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sources", workspaceId],
    queryFn: () => sourcesApi.list(workspaceId).then((r) => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => sourcesApi.delete(workspaceId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources", workspaceId] }),
  });

  const testMut = useMutation({
    mutationFn: (id: number) => sourcesApi.test(workspaceId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources", workspaceId] }),
    onSettled: () => setTestingId(null),
  });

  const sources: DataSource[] = data?.sources ?? [];
  const filtered = sources.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (TYPE_LABEL[s.source_type] ?? s.source_type).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Plug className="w-5 h-5 text-brand" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Data Sources</h1>
            <p className="text-xs text-muted-foreground">Connect external databases, APIs, and cloud storage</p>
          </div>
        </div>
        <Link
          href={`/workspaces/${workspaceId}/sources/new`}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-[#2a0d8a] transition"
        >
          <Plus className="w-4 h-4" />
          Add Source
        </Link>
      </div>

      {/* Search bar */}
      <div className="px-6 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sources"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Sources grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
            <Plug className="w-12 h-12 opacity-20" />
            <p className="text-sm font-medium">No data sources yet</p>
            <p className="text-xs">Connect a database, cloud storage, or API to get started</p>
            <Link
              href={`/workspaces/${workspaceId}/sources/new`}
              className="mt-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-[#2a0d8a] transition"
            >
              Add your first source
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((src) => {
              return (
                <div
                  key={src.id}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-brand/30 hover:shadow-sm transition group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center flex-shrink-0">
                      <ConnectorLogo id={src.source_type} className="w-7 h-7" />
                    </div>
                    <StatusBadge status={src.status} />
                  </div>

                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">{src.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {TYPE_LABEL[src.source_type] ?? src.source_type}
                    </p>
                    {src.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{src.description}</p>
                    )}
                    {src.status === "failed" && src.last_error && (
                      <p className="mt-1 text-[10px] text-red-500 truncate" title={src.last_error}>
                        <AlertCircle className="w-2.5 h-2.5 inline mr-0.5" />
                        {src.last_error.slice(0, 60)}...
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                    <Link
                      href={`/workspaces/${workspaceId}/sources/${src.id}/browse`}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs text-brand hover:bg-brand/10 transition font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Browse
                    </Link>
                    <button
                      onClick={() => {
                        setTestingId(src.id);
                        testMut.mutate(src.id);
                      }}
                      disabled={testingId === src.id}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition disabled:opacity-50"
                    >
                      <TestTube2 className="w-3.5 h-3.5" />
                      {testingId === src.id ? "Testing..." : "Test"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${src.name}"?`)) deleteMut.mutate(src.id);
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
}
