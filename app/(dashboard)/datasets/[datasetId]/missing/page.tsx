"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { MissingHeatmap } from "@/components/charts/MissingHeatmap";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable } from "@/components/shared/DataTable";
import { SubNav } from "@/components/layout/SubNav";

export default function MissingPage() {
  const { datasetId } = useParams<{ datasetId: string }>();

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.missing(datasetId),
    queryFn: () => datasetsApi.getMissing(datasetId).then((r) => r.data),
  });

  if (isLoading) return <PageSpinner />;
  if (!data) return null;

  const missingCols = data.columns.filter((c: any) => c.count > 0);

  const tableData = missingCols
    .map((col: any) => ({
      column: col.name,
      missing_count: col.count,
      missing_pct: col.pct,
      dtype: col.dtype ?? "—",
    }))
    .sort((a: any, b: any) => b.missing_pct - a.missing_pct);

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Missing Values" },
          ]}
        />

        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Missing Values</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {missingCols.length} columns with missing data
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total Missing"
            value={data.total_missing?.toLocaleString() ?? "0"}
            color={data.missing_pct > 20 ? "red" : data.missing_pct > 5 ? "amber" : "green"}
          />
          <StatCard
            label="Missing %"
            value={`${(data.missing_pct ?? 0).toFixed(1)}%`}
            color={data.missing_pct > 20 ? "red" : "default"}
          />
          <StatCard
            label="Affected Columns"
            value={missingCols.length}
            sub={`of ${data.columns.length} total`}
          />
        </div>

        {missingCols.length > 0 && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Missing by Column</h2>
              <MissingHeatmap data={data} />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <DataTable
                columns={[
                  { key: "column", label: "Column", render: (v) => <span className="font-mono text-xs">{String(v)}</span> },
                  { key: "missing_count", label: "Count", align: "right" as const, sortable: true, render: (v) => Number(v).toLocaleString() },
                  {
                    key: "missing_pct",
                    label: "Missing %",
                    align: "right" as const,
                    sortable: true,
                    render: (v) => {
                      const pct = Number(v);
                      return (
                        <span className={pct > 50 ? "text-red-600 font-semibold" : pct > 20 ? "text-amber-600" : "text-gray-600"}>
                          {pct.toFixed(2)}%
                        </span>
                      );
                    },
                  },
                  { key: "dtype", label: "Type", render: (v) => <span className="text-xs text-gray-500">{String(v)}</span> },
                ]}
                data={tableData as unknown as Record<string, unknown>[]}
                rowKey={(r) => String(r.column)}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
