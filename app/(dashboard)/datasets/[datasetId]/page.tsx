"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { StatCard } from "@/components/shared/StatCard";
import { InsightList } from "@/components/shared/InsightCard";
import { QualityGauge } from "@/components/charts/QualityGauge";
import { SubNav } from "@/components/layout/SubNav";
import {
  Database,
  Rows,
  Columns,
  MemoryStick,
  FileText,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const EDA_LINKS = [
  { label: "Column Profile", href: "profile", desc: "Types, stats, and sample values for each column" },
  { label: "Missing Values", href: "missing", desc: "Which columns have nulls and by how much" },
  { label: "Distributions", href: "distributions", desc: "Histograms, KDE, and normality tests" },
  { label: "Correlations", href: "correlations", desc: "Pearson, Spearman, Kendall heatmaps" },
  { label: "Outliers", href: "outliers", desc: "IQR, Z-score, and Isolation Forest detection" },
  { label: "Feature Importance", href: "feature-importance", desc: "Target-based feature ranking" },
  { label: "Time Series", href: "timeseries", desc: "Trends, seasonality, ADF test" },
  { label: "Text Analysis", href: "text", desc: "Word frequency, sentiment, n-grams" },
  { label: "Relationship Graph", href: "graph", desc: "Column dependency force-directed graph" },
  { label: "Transform Studio", href: "transform", desc: "Clean, encode, and export your data" },
];

export default function DatasetOverviewPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();

  const { data: dataset, isLoading } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: quality } = useQuery({
    queryKey: queryKeys.eda.quality(datasetId),
    queryFn: () => datasetsApi.getQualityScore(datasetId).then((r) => r.data),
    enabled: dataset?.status === "ready",
  });

  const { data: insights } = useQuery({
    queryKey: queryKeys.eda.insights(datasetId),
    queryFn: () => datasetsApi.getInsights(datasetId).then((r) => r.data),
    enabled: dataset?.status === "ready",
  });

  if (isLoading) return <PageSpinner />;
  if (!dataset) return null;

  return (
    <>
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
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{dataset.name}</h1>
            {dataset.description && (
              <p className="text-sm text-gray-500 mt-0.5">{dataset.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
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
          value={dataset.row_count?.toLocaleString() ?? "—"}
          icon={<Rows className="w-4 h-4" />}
        />
        <StatCard
          label="Columns"
          value={dataset.column_count ?? "—"}
          icon={<Columns className="w-4 h-4" />}
        />
        <StatCard
          label="Source"
          value={dataset.source_type ?? "—"}
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Data Quality Score</h2>
          <QualityGauge data={quality} />
        </div>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Auto-Insights ({insights.length})
          </h2>
          <InsightList insights={insights} />
        </div>
      )}

      {/* EDA navigation grid */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-4">Explore Analysis Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EDA_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(`/datasets/${datasetId}/${link.href}`)}
              className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition group"
              disabled={dataset.status !== "ready"}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-gray-800">{link.label}</span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition" />
              </div>
              <p className="text-xs text-gray-400">{link.desc}</p>
            </button>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
