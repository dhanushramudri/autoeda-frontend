"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { DataTable } from "@/components/shared/DataTable";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { InsightList } from "@/components/shared/InsightCard";
import { cn } from "@/lib/utils";

const TYPE_COLOR: Record<string, string> = {
  numeric: "bg-blue-100 text-blue-700",
  categorical: "bg-purple-100 text-purple-700",
  datetime: "bg-green-100 text-green-700",
  boolean: "bg-amber-100 text-amber-700",
  text: "bg-rose-100 text-rose-700",
  id_like: "bg-gray-100 text-gray-600",
  constant: "bg-red-100 text-red-700",
};

function renderTopValues(v: unknown) {
  if (!v || !Array.isArray(v) || v.length === 0)
    return <span className="text-gray-300">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {(v as Array<unknown>).slice(0, 3).map((item, i) => {
        let val: string;
        let cnt: number;

        if (Array.isArray(item)) {
          // tuple format: [value, count]
          val = String(item[0] ?? "");
          cnt = Number(item[1] ?? 0);
        } else if (item !== null && typeof item === "object") {
          // object format: {value, count} or {val, cnt} or {name, freq}
          const obj = item as Record<string, unknown>;
          val = String(obj.value ?? obj.val ?? obj.name ?? obj.label ?? i);
          cnt = Number(obj.count ?? obj.cnt ?? obj.freq ?? obj.frequency ?? 0);
        } else {
          val = String(item ?? "");
          cnt = 0;
        }

        return (
          <span
            key={`${val}-${i}`}
            className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600"
          >
            {val.slice(0, 20)}
            {cnt > 0 ? ` (${cnt})` : ""}
          </span>
        );
      })}
    </div>
  );
}

export default function ProfilePage() {
  const { datasetId } = useParams<{ datasetId: string }>();

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  if (isLoading) return <PageSpinner />;
  if (!data) return null;

  const columns = [
    {
      key: "name",
      label: "Column",
      render: (v: unknown) => (
        <span className="font-mono text-xs text-gray-800">{String(v)}</span>
      ),
    },
    {
      key: "dtype",
      label: "Type",
      render: (_: unknown, row: Record<string, unknown>) => (
        <span
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-semibold",
            TYPE_COLOR[String(row.semantic_type)] ?? "bg-gray-100 text-gray-600"
          )}
        >
          {String(row.semantic_type ?? row.dtype)}
        </span>
      ),
    },
    {
      key: "missing_pct",
      label: "Missing",
      align: "right" as const,
      render: (v: unknown) => {
        const pct = Number(v);
        return (
          <span className={pct > 20 ? "text-amber-600 font-semibold" : "text-gray-500"}>
            {pct.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: "nunique",
      label: "Unique",
      align: "right" as const,
      render: (v: unknown) => (
        <span className="text-gray-600">{Number(v).toLocaleString()}</span>
      ),
    },
    {
      key: "mean",
      label: "Mean",
      align: "right" as const,
      render: (v: unknown) =>
        v != null ? (
          <span className="font-mono text-xs text-gray-600">{Number(v).toFixed(3)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: "std",
      label: "Std Dev",
      align: "right" as const,
      render: (v: unknown) =>
        v != null ? (
          <span className="font-mono text-xs text-gray-600">{Number(v).toFixed(3)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: "min",
      label: "Min",
      align: "right" as const,
      render: (v: unknown) =>
        v != null ? (
          <span className="font-mono text-xs text-gray-600">{String(v)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: "max",
      label: "Max",
      align: "right" as const,
      render: (v: unknown) =>
        v != null ? (
          <span className="font-mono text-xs text-gray-600">{String(v)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: "top_values",
      label: "Top Values",
      render: renderTopValues,
    },
  ];

  return (
    <div className="p-8 max-w-full mx-auto">
      <Breadcrumb
        items={[
          { label: "Workspaces", href: "/workspaces" },
          { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
          { label: "Profile" },
        ]}
      />

      <div className="flex items-center justify-between mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Column Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.columns.length} columns · {data.row_count?.toLocaleString()} rows
            {data.sampled && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                Sampled
              </span>
            )}
          </p>
        </div>
      </div>

      {data.insights && data.insights.length > 0 && (
        <div className="mb-6">
          <InsightList insights={data.insights} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataTable
          columns={columns as Parameters<typeof DataTable>[0]["columns"]}
          data={data.columns as Record<string, unknown>[]}
          rowKey={(r) => String(r.name)}
        />
      </div>
    </div>
  );
}