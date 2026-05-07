"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { CorrelationHeatmap } from "@/components/charts/CorrelationHeatmap";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { InsightList } from "@/components/shared/InsightCard";

const METHODS = ["pearson", "spearman", "kendall"] as const;

export default function CorrelationsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const method = (searchParams.get("method") as typeof METHODS[number]) ?? "pearson";

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.correlations(datasetId, method),
    queryFn: () => datasetsApi.getCorrelations(datasetId, method).then((r) => r.data),
  });

  const setMethod = (m: string) => {
    router.replace(`/datasets/${datasetId}/correlations?method=${m}`);
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Correlations" },
          ]}
        />

        <div className="flex items-center justify-between mt-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Correlations</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Pairwise correlation between numeric columns
            </p>
          </div>
          {/* Method selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition ${
                  m === method
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {data?.insights && data.insights.length > 0 && (
          <div className="mb-6">
            <InsightList insights={data.insights} />
          </div>
        )}

        {isLoading ? (
          <PageSpinner />
        ) : data ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <CorrelationHeatmap data={data} />

            {/* VIF table */}
            {data.vif && data.vif.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Variance Inflation Factor (VIF)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {data.vif.map((v: { column: string; vif: number }) => (
                    <div key={v.column} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                      <span className="font-mono text-gray-600 truncate">{v.column}</span>
                      <span
                        className={`font-semibold ml-2 ${
                          v.vif > 10
                            ? "text-red-600"
                            : v.vif > 5
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {v.vif.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
