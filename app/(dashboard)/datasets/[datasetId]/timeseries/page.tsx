"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";
import { TrendingUp } from "lucide-react";

export default function TimeSeriesPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const datetimeCols = profile?.columns
    .filter((c: { semantic_type: string }) => c.semantic_type === "datetime")
    .map((c: { name: string }) => c.name) ?? [];

  const numericCols = profile?.columns
    .filter((c: { semantic_type: string }) => c.semantic_type === "numeric")
    .map((c: { name: string }) => c.name) ?? [];

  const timeCol = searchParams.get("time_col") ?? datetimeCols[0] ?? "";
  const valueCol = searchParams.get("value_col") ?? numericCols[0] ?? "";

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.timeseries(datasetId, timeCol, valueCol),
    queryFn: () => datasetsApi.getTimeSeries(datasetId, timeCol, valueCol).then((r) => r.data),
    enabled: !!timeCol && !!valueCol,
  });

  const setParams = (key: string, val: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set(key, val);
    router.replace(`/datasets/${datasetId}/timeseries?${p.toString()}`);
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Time Series" },
          ]}
        />

        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Time Series Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Trends, stationarity, seasonality decomposition, and anomaly detection
          </p>
        </div>

        {datetimeCols.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="w-12 h-12" />}
            title="No datetime columns"
            description="This dataset has no datetime columns for time series analysis."
          />
        ) : (
          <>
            <div className="flex gap-4 mb-6">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Time column</label>
                <select
                  value={timeCol}
                  onChange={(e) => setParams("time_col", e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {datetimeCols.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Value column</label>
                <select
                  value={valueCol}
                  onChange={(e) => setParams("value_col", e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {numericCols.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {!timeCol || !valueCol ? (
              <EmptyState
                icon={<TrendingUp className="w-12 h-12" />}
                title="Select columns"
                description="Choose a time column and a value column to analyze."
              />
            ) : isLoading ? (
              <PageSpinner />
            ) : data ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <TimeSeriesChart data={data} timeCol={timeCol} valueCol={valueCol} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
