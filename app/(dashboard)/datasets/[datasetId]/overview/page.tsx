"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { edaApi, datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { QualityGauge } from "@/components/charts/QualityGauge";
import { InsightCard } from "@/components/shared/InsightCard";
import { StatCard } from "@/components/shared/StatCard";
import { LoadingBar } from "@/components/shared/LoadingBar";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  BarChart3,
  Columns3,
  HardDrive,
  AlertTriangle,
  Copy,
  Zap,
} from "lucide-react";

export default function DatasetOverviewPage() {
  const params = useParams();
  const datasetId = params.datasetId as string;

  const { data: dataset, isLoading: datasetLoading } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  const { data: quality, isLoading: qualityLoading } = useQuery({
    queryKey: queryKeys.eda.qualityScore(datasetId),
    queryFn: () => edaApi.qualityScore(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => edaApi.profile(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: queryKeys.eda.insights(datasetId),
    queryFn: () => edaApi.insights(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  const isLoading =
    datasetLoading || qualityLoading || profileLoading || insightsLoading;

  if (isLoading) return <LoadingBar />;
  if (!dataset || !quality || !profile)
    return <EmptyState title="No data" description="Could not load dataset overview" />;

  const memoryMb = profile.memory_mb || 0;
  const duplicatePct = profile.duplicate_pct || 0;
  const totalMissing = profile.columns.reduce(
    (sum: number, col: any) => sum + (col.missing_count || 0),
    0
  );
  const totalCells = (profile.total_rows || 0) * (profile.total_columns || 0);
  const missingPct =
    totalCells > 0
      ? ((totalMissing / totalCells) * 100).toFixed(2)
      : "0";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{dataset.name}</h1>
          <p className="text-gray-600 mt-1">{dataset.description}</p>
        </div>

        {/* Quality Score */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0" style={{ width: "200px", height: "200px" }}>
              <QualityGauge score={quality.overall || 75} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Data Quality Assessment
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Completeness</span>
                  <span className="text-lg font-semibold">
                    {quality.completeness || 100}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Consistency</span>
                  <span className="text-lg font-semibold">
                    {quality.consistency || 100}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Uniqueness</span>
                  <span className="text-lg font-semibold">
                    {quality.uniqueness || 100}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Validity</span>
                  <span className="text-lg font-semibold">
                    {quality.validity || 100}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Rows"
            value={profile.total_rows?.toLocaleString() || "0"}
            icon={BarChart3}
            color="blue"
          />
          <StatCard
            title="Columns"
            value={profile.total_columns?.toString() || "0"}
            icon={Columns3}
            color="green"
          />
          <StatCard
            title="Memory"
            value={`${memoryMb.toFixed(2)} MB`}
            icon={HardDrive}
            color="purple"
          />
          <StatCard
            title="Missing %"
            value={`${missingPct}%`}
            icon={AlertTriangle}
            color="orange"
          />
        </div>

        {/* Issues & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Issues */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Top Data Quality Issues
            </h2>
            {quality.issues && quality.issues.length > 0 ? (
              <div className="space-y-3">
                {quality.issues.slice(0, 5).map((issue: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border-l-4 border-red-500 bg-red-50"
                  >
                    <p className="text-sm text-gray-800">
                      {issue.description}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Column: {issue.column}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No issues detected</p>
            )}
          </div>

          {/* Suggestions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              Recommendations
            </h2>
            {quality.suggestions && quality.suggestions.length > 0 ? (
              <div className="space-y-2">
                {quality.suggestions.slice(0, 5).map((suggestion: string, idx: number) => (
                  <div key={idx} className="p-2 rounded text-sm text-gray-700 bg-blue-50">
                    {suggestion}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No recommendations</p>
            )}
          </div>
        </div>

        {/* Insights */}
        {insights && insights.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Key Insights
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {insights.map((insight: any, idx: number) => (
                <InsightCard key={idx} insight={insight} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
