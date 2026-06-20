"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { QualityGauge } from "@/components/charts/QualityGauge";
import { StatCard } from "@/components/shared/StatCard";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ColumnDetailPanel } from "@/components/shared/ColumnDetailPanel";
import {
  AlertTriangle, Zap, Download, RefreshCw,
  ChevronRight, CheckCircle
} from "lucide-react";
import type { ColumnProfile, QualityScore } from "@/types";

const TYPE_COLORS: Record<string, string> = {
  numeric: "bg-blue-100 text-brand",
  categorical: "bg-purple-100 text-purple-700",
  datetime: "bg-green-100 text-green-700",
  boolean: "bg-amber-100 text-amber-700",
  text: "bg-pink-100 text-pink-700",
  id_like: "bg-gray-100 text-gray-600",
  constant: "bg-red-100 text-red-600",
};

function MiniBar({ pct, color = "bg-blue-400" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function ColumnCard({ col, datasetId, onClick }: { col: ColumnProfile; datasetId: string; onClick: () => void }) {
  const missingColor = col.missing_pct > 50 ? "text-red-600" : col.missing_pct > 20 ? "text-amber-600" : "text-emerald-600";
  const missingBarColor = col.missing_pct > 50 ? "bg-red-400" : col.missing_pct > 20 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand/30 hover:shadow-md cursor-pointer transition group"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-900 truncate mr-2 flex-1">{col.name}</h4>
        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${TYPE_COLORS[col.semantic_type] ?? "bg-gray-100 text-gray-600"}`}>
          {col.semantic_type}
        </span>
      </div>

      <p className="text-xs text-gray-400 mb-2 font-mono">{col.dtype}</p>

      {/* Missing bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-gray-400">Missing</span>
          <span className={`font-medium ${missingColor}`}>{col.missing_pct.toFixed(1)}%</span>
        </div>
        <MiniBar pct={col.missing_pct} color={missingBarColor} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 mt-2">
        <span>{col.unique_count.toLocaleString()} unique</span>
        {col.mean != null && <span>Î¼={col.mean.toFixed(2)}</span>}
        {col.skewness != null && Math.abs(col.skewness) > 1 && (
          <span className="text-amber-600 col-span-2">Skew: {col.skewness.toFixed(2)}</span>
        )}
      </div>

      {/* Top value */}
      {col.top_values?.[0] && (
        <div className="mt-2 pt-2 border-t border-gray-50">
          <p className="text-xs text-gray-400 truncate">
            Top: <span className="text-gray-600 font-medium">{col.top_values[0].value}</span>
            <span className="ml-1 text-gray-300">({col.top_values[0].pct?.toFixed(1)}%)</span>
          </p>
        </div>
      )}

      <div className="mt-2 flex items-center justify-end opacity-0 group-hover:opacity-100 transition">
        <span className="text-xs text-brand flex items-center gap-0.5">
          Details <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DatasetOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const datasetId = params.datasetId as string;
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [searchCol, setSearchCol] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: dataset, isLoading: datasetLoading } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  const { data: quality, isLoading: qualityLoading } = useQuery({
    queryKey: queryKeys.eda.quality(datasetId),
    queryFn: () => datasetsApi.getQualityScore(datasetId).then((r) => r.data as QualityScore),
    enabled: !!datasetId && dataset?.status === "ready",
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
    enabled: !!datasetId && dataset?.status === "ready",
  });

  const isLoading = datasetLoading || qualityLoading || profileLoading;
  if (isLoading) return <><SubNav datasetId={datasetId} /><PageSpinner /></>;
  if (!dataset) return <EmptyState title="No data" description="Could not load dataset overview" />;

  const memoryMb = profile?.memory_mb ?? 0;
  const columns: ColumnProfile[] = profile?.columns ?? [];

  const totalMissing = columns.reduce((s, c) => s + (c.missing_count ?? 0), 0);
  const totalCells = (profile?.total_rows ?? 0) * (profile?.total_columns ?? 0);
  const missingPct = totalCells > 0 ? ((totalMissing / totalCells) * 100).toFixed(2) : "0";

  const filteredCols = columns.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(searchCol.toLowerCase());
    const matchType = typeFilter === "all" || c.semantic_type === typeFilter;
    return matchSearch && matchType;
  });

  const semanticTypes = Array.from(new Set(columns.map((c) => c.semantic_type)));

  const handleReport = async () => {
    const res = await datasetsApi.getReport(datasetId);
    const blob = new Blob([res.data as string], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dataset.name}-report.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset.workspace_name ?? "Workspace", href: `/workspaces/${dataset.workspace_id}/datasets` },
            { label: dataset.name },
          ]}
        />

        <div className="flex items-start justify-between mt-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{dataset.name}</h1>
            {dataset.description && <p className="text-gray-500 mt-0.5 text-sm">{dataset.description}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReport}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition"
            >
              <Download className="w-4 h-4" /> Export Report
            </button>
            <button
              onClick={() => router.push(`/datasets/${datasetId}/history`)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition"
            >
              <RefreshCw className="w-4 h-4" /> History
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Rows" value={profile?.total_rows?.toLocaleString() ?? dataset.row_count?.toLocaleString() ?? "--"} color="blue" />
          <StatCard label="Columns" value={profile?.total_columns ?? dataset.column_count ?? "--"} color="green" />
          <StatCard label="Memory" value={`${memoryMb.toFixed(2)} MB`} />
          <StatCard
            label="Missing %"
            value={`${missingPct}%`}
            color={Number(missingPct) > 20 ? "red" : Number(missingPct) > 5 ? "amber" : "green"}
          />
        </div>

        {/* Quality + Issues */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {quality && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Data Quality Score</h2>
              <QualityGauge data={quality} />
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Issues
            </h2>
            {quality?.issues?.length ? (
              <div className="space-y-2">
                {quality.issues.slice(0, 4).map((issue, idx) => (
                  <div key={idx} className={`text-xs p-2.5 rounded-lg border-l-3 ${
                    issue.severity === "danger" ? "border-l-red-500 bg-red-50 text-red-800"
                    : issue.severity === "warning" ? "border-l-amber-500 bg-amber-50 text-amber-800"
                    : "border-l-blue-500 bg-blue-50 text-blue-800"
                  }`} style={{ borderLeftWidth: "3px" }}>
                    {issue.description}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> No issues detected
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-brand" /> Recommendations
            </h2>
            {quality?.suggestions?.length ? (
              <div className="space-y-1.5">
                {quality.suggestions.slice(0, 4).map((s, idx) => (
                  <div key={idx} className="text-xs p-2 bg-blue-50 rounded-lg text-blue-800">{s}</div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No recommendations</p>
            )}
          </div>
        </div>

        {/* Column Summary Cards */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Column Summary <span className="text-gray-400 font-normal">({columns.length} columns)</span>
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search columns..."
                value={searchCol}
                onChange={(e) => setSearchCol(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-40 outline-none focus:ring-1 focus:ring-brand"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white"
              >
                <option value="all">All types</option>
                {semanticTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredCols.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No columns match the filter.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredCols.map((col) => (
                <ColumnCard
                  key={col.name}
                  col={col}
                  datasetId={datasetId}
                  onClick={() => setSelectedColumn(col.name)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Column Detail Panel */}
      {selectedColumn && (
        <ColumnDetailPanel
          datasetId={datasetId}
          columnName={selectedColumn}
          onClose={() => setSelectedColumn(null)}
          onQuickAction={(op, col) => {
            router.push(`/datasets/${datasetId}/transform?op=${op}&col=${encodeURIComponent(col)}`);
          }}
        />
      )}
    </>
  );
}
