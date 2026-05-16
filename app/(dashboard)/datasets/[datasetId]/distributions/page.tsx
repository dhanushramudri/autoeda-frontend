"use client";

import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAiContextStore } from "@/store/aiContextStore";
import { BarChart2 } from "lucide-react";

export default function DistributionsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedCol = searchParams.get("column") ?? "";
  const setPageContext = useAiContextStore((s) => s.setPageContext);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const numericCols = profile?.columns
    .filter((c: { semantic_type: string }) =>
      ["numeric", "boolean"].includes(c.semantic_type)
    )
    .map((c: { name: string }) => c.name) ?? [];

  const activeCol = selectedCol || numericCols[0] || "";

  const { data: distData, isLoading } = useQuery({
    queryKey: queryKeys.eda.distributions(datasetId, activeCol),
    queryFn: () => datasetsApi.getDistributions(datasetId, activeCol).then((r) => r.data),
    enabled: !!activeCol,
  });

  // Register page context for the AI panel
  useEffect(() => {
    if (!activeCol) return;
    const colProfile = profile?.columns?.find((c: { name: string }) => c.name === activeCol);
    setPageContext({
      page: "distributions",
      label: `Distributions → ${activeCol}`,
      details: {
        column: activeCol,
        dtype: colProfile?.dtype ?? "unknown",
        missing_pct: colProfile?.missing_pct ?? 0,
        skewness: colProfile?.skewness ?? null,
        mean: colProfile?.mean ?? null,
        unique_count: colProfile?.unique_count ?? null,
      },
      suggestedQuestions: [
        `Is the ${activeCol} column normally distributed?`,
        `How should I handle the skewness in ${activeCol}?`,
        `What does the distribution of ${activeCol} tell me?`,
      ],
    });
    return () => setPageContext(null);
  }, [activeCol, profile, setPageContext]);

  const setCol = (col: string) => {
    router.replace(`/datasets/${datasetId}/distributions?column=${encodeURIComponent(col)}`);
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Distributions" },
          ]}
        />

        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Distributions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Histograms, KDE curves, and normality tests for numeric columns
          </p>
        </div>

        {numericCols.length === 0 ? (
          <EmptyState
            icon={<BarChart2 className="w-12 h-12" />}
            title="No numeric columns"
            description="This dataset has no numeric columns to analyze."
          />
        ) : (
          <div className="flex gap-6">
            {/* Column list */}
            <div className="w-48 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Columns
              </p>
              <div className="space-y-0.5">
                {numericCols.map((col: string) => (
                  <button
                    key={col}
                    onClick={() => setCol(col)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition truncate ${
                      col === activeCol
                        ? "bg-blue-50 text-brand font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                    title={col}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
              {isLoading ? (
                <PageSpinner />
              ) : distData ? (
                <DistributionChart data={distData} column={activeCol} />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
