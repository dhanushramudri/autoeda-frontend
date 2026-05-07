"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function FeatureImportancePage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const targetCol = searchParams.get("target") ?? "";

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const allCols = profile?.columns.map((c: { name: string }) => c.name) ?? [];
  const activeTarget = targetCol || allCols[allCols.length - 1] || "";

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.featureImportance(datasetId, activeTarget),
    queryFn: () => datasetsApi.getFeatureImportance(datasetId, activeTarget).then((r) => r.data),
    enabled: !!activeTarget,
  });

  const setTarget = (col: string) => {
    router.replace(`/datasets/${datasetId}/feature-importance?target=${encodeURIComponent(col)}`);
  };

  const chartData = Array.isArray(data?.importances)
    ? [...data!.importances]
        .map((item: { feature: string; importance: number }) => ({
          column: item.feature,
          score: item.importance,
        }))
        .sort((a, b) => b.score - a.score)
    : [];

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Feature Importance" },
          ]}
        />

        <div className="flex items-center justify-between mt-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feature Importance</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Relative importance of each feature for predicting the target
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mr-2">Target column:</label>
            <select
              value={activeTarget}
              onChange={(e) => setTarget(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {allCols.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {!activeTarget ? (
          <EmptyState
            icon={<TrendingUp className="w-12 h-12" />}
            title="Select a target column"
            description="Choose a target column above to compute feature importance scores."
          />
        ) : isLoading ? (
          <PageSpinner />
        ) : data && chartData.length > 0 ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <span className="text-sm font-semibold text-gray-800">Target: </span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                  {data.target}
                </span>
                <span className="text-xs text-gray-400 ml-2">{data.problem_type}</span>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 28)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 80, bottom: 4, left: 120 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="column"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    width={115}
                  />
                  <Tooltip
                    formatter={(v: number) => [v.toFixed(4), "Importance"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={entry.column}
                        fill={`hsl(${220 - i * (140 / chartData.length)}, 70%, 55%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<TrendingUp className="w-12 h-12" />}
            title="No importances computed"
            description="The selected target may not have enough variance to compute feature importances."
          />
        )}
      </div>
    </>
  );
}
