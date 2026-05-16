"use client";

import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { InsightList } from "@/components/shared/InsightCard";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable } from "@/components/shared/DataTable";
import { AskAiButton } from "@/components/ai/AskAiButton";
import { useAiContextStore } from "@/store/aiContextStore";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const METHODS = ["iqr", "zscore", "isolation_forest"] as const;

export default function OutliersPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const method = (searchParams.get("method") ?? "iqr") as typeof METHODS[number];
  const column = searchParams.get("column") ?? undefined;

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const numericCols = profile?.columns
    .filter((c: { semantic_type: string }) => c.semantic_type === "numeric")
    .map((c: { name: string }) => c.name) ?? [];

  const activeCol = column || numericCols[0] || undefined;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.outliers(datasetId, method, activeCol),
    queryFn: () => datasetsApi.getOutliers(datasetId, method, activeCol).then((r) => r.data),
    enabled: !!activeCol || method === "isolation_forest",
  });

  const setPageContext = useAiContextStore((s) => s.setPageContext);

  useEffect(() => {
    if (!data) return;
    const worstCols = [...(data.columns ?? [])]
      .sort((a: { outlier_pct: number }, b: { outlier_pct: number }) => b.outlier_pct - a.outlier_pct)
      .slice(0, 3)
      .map((c: { name: string; outlier_pct: number }) => `${c.name}: ${c.outlier_pct.toFixed(1)}%`)
      .join(", ");
    setPageContext({
      page: "outliers",
      label: `Outliers (${method}${activeCol ? ` → ${activeCol}` : ""})`,
      details: {
        method,
        column: activeCol ?? "all",
        total_outliers: data.total_outliers ?? 0,
        worst_columns: worstCols || "none",
      },
      suggestedQuestions: [
        `Should I remove or cap the outliers in ${activeCol ?? "these columns"}?`,
        "What's the difference between IQR, Z-Score, and Isolation Forest?",
        "How do these outliers affect model performance?",
      ],
    });
    return () => setPageContext(null);
  }, [data, method, activeCol, setPageContext]);

  const setParam = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, val);
    router.replace(`/datasets/${datasetId}/outliers?${params.toString()}`);
  };

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Outliers" },
          ]}
        />

        <div className="flex items-start justify-between mt-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Outlier Detection</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Identify anomalous values using statistical methods
            </p>
          </div>
          <div className="flex gap-3">
            {/* Method */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setParam("method", m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    m === method ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m === "iqr" ? "IQR" : m === "zscore" ? "Z-Score" : "Iso Forest"}
                </button>
              ))}
            </div>

            {/* Column selector (not for iso forest) */}
            {method !== "isolation_forest" && numericCols.length > 0 && (
              <select
                value={activeCol ?? ""}
                onChange={(e) => setParam("column", e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {numericCols.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
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
          <div className="space-y-6">
            {(() => {
              const avgPct =
                data.columns.length > 0
                  ? data.columns.reduce(
                      (sum: number, c: { outlier_pct: number }) => sum + c.outlier_pct,
                      0
                    ) / data.columns.length
                  : 0;
              return (
                <div className="grid grid-cols-3 gap-4">
                  <StatCard
                    label="Total Outliers"
                    value={data.total_outliers?.toLocaleString() ?? "0"}
                    color={data.total_outliers > 0 ? "amber" : "green"}
                  />
                  <StatCard
                    label="Avg Outlier %"
                    value={`${avgPct.toFixed(2)}%`}
                    color={avgPct > 5 ? "red" : "default"}
                  />
                  <StatCard
                    label="Method"
                    value={method.toUpperCase().replace("_", " ")}
                  />
                </div>
              );
            })()}

            {/* Per-column breakdown */}
            {data.columns && data.columns.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">By Column</h3>
                  <AskAiButton
                    question={`I'm looking at outlier detection results using ${method}. What should I do about these outliers — remove, cap, or keep them?`}
                    label="What should I do?"
                    variant="chip"
                  />
                </div>
                <DataTable
                  columns={[
                    { key: "column", label: "Column", render: (v) => <span className="font-mono text-xs">{String(v)}</span> },
                    { key: "count", label: "Outliers", align: "right", sortable: true, render: (v) => Number(v).toLocaleString() },
                    {
                      key: "pct",
                      label: "%",
                      align: "right",
                      sortable: true,
                      render: (v) => (
                        <span className={Number(v) > 5 ? "text-amber-600 font-semibold" : "text-gray-600"}>
                          {Number(v).toFixed(2)}%
                        </span>
                      ),
                    },
                    { key: "lower_bound", label: "Lower Bound", align: "right", render: (v) => v != null ? Number(v).toFixed(3) : "--" },
                    { key: "upper_bound", label: "Upper Bound", align: "right", render: (v) => v != null ? Number(v).toFixed(3) : "--" },
                  ]}
                  data={data.columns.map((col: { name: string; outlier_count: number; outlier_pct: number; bounds: Record<string, number | null> }) => ({
                    column: col.name,
                    count: col.outlier_count,
                    pct: col.outlier_pct,
                    lower_bound: col.bounds?.lower ?? col.bounds?.lower_bound ?? null,
                    upper_bound: col.bounds?.upper ?? col.bounds?.upper_bound ?? null,
                  }))}
                  rowKey={(r) => String(r.column)}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
