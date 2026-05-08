"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { InsightList } from "@/components/shared/InsightCard";
import { SubNav } from "@/components/layout/SubNav";
import { ColumnDetailPanel } from "@/components/shared/ColumnDetailPanel";
import { cn } from "@/lib/utils";
import { Download, Tag, X } from "lucide-react";
import type { ColumnProfile, ColumnMeta } from "@/types";

const TYPE_COLOR: Record<string, string> = {
  numeric: "bg-blue-100 text-brand",
  categorical: "bg-purple-100 text-purple-700",
  datetime: "bg-green-100 text-green-700",
  boolean: "bg-amber-100 text-amber-700",
  text: "bg-rose-100 text-rose-700",
  id_like: "bg-gray-100 text-gray-600",
  constant: "bg-red-100 text-red-700",
};

const QUICK_TAGS = ["target", "feature", "id", "sensitive", "drop"];
const TAG_COLORS: Record<string, string> = {
  target: "bg-emerald-100 text-emerald-700",
  feature: "bg-blue-100 text-brand",
  id: "bg-gray-100 text-gray-600",
  sensitive: "bg-red-100 text-red-700",
  drop: "bg-amber-100 text-amber-700",
};

function renderTopValues(v: unknown) {
  if (!v || !Array.isArray(v) || v.length === 0)
    return <span className="text-gray-300">--</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {(v as Array<Record<string, unknown>>).slice(0, 3).map((item, i) => {
        const val = String(item.value ?? item.val ?? item.name ?? i);
        const cnt = Number(item.count ?? item.cnt ?? 0);
        return (
          <span key={`${val}-${i}`} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">
            {val.slice(0, 16)}{cnt > 0 ? ` (${cnt})` : ""}
          </span>
        );
      })}
    </div>
  );
}

export default function ProfilePage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const qc = useQueryClient();
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const [editingTagCol, setEditingTagCol] = useState<string | null>(null);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const { data: allMeta } = useQuery({
    queryKey: queryKeys.columnMeta.all(datasetId),
    queryFn: () => datasetsApi.getAllColumnMetadata(datasetId).then((r) => r.data as ColumnMeta[]),
    enabled: !!datasetId,
  });

  const tagMutation = useMutation({
    mutationFn: ({ column, tags, notes }: { column: string; tags: string[]; notes?: string }) =>
      datasetsApi.upsertColumnMetadata(datasetId, column, { tags, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.columnMeta.all(datasetId) }),
  });

  const metaMap: Record<string, ColumnMeta> = {};
  (allMeta ?? []).forEach((m) => { metaMap[m.column] = m; });

  const toggleTag = useCallback((colName: string, tag: string) => {
    const current = metaMap[colName]?.tags ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    tagMutation.mutate({ column: colName, tags: next, notes: metaMap[colName]?.notes ?? undefined });
  }, [metaMap, tagMutation]);

  const exportCsv = () => {
    if (!data?.columns) return;
    const headers = ["name", "dtype", "semantic_type", "missing_pct", "unique_count", "mean", "std", "min", "max"];
    const rows = data.columns.map((c: ColumnProfile) =>
      headers.map((h) => {
        const v = (c as unknown as Record<string, unknown>)[h];
        return v != null ? String(v) : "";
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${dataset?.name ?? "profile"}_profile.csv`;
    a.click();
  };

  if (isLoading) return <><SubNav datasetId={datasetId} /><PageSpinner /></>;
  if (!data) return null;

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-full mx-auto">
        <Breadcrumb items={[
          { label: "Workspaces", href: "/workspaces" },
          { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
          { label: "Profile" },
        ]} />

        <div className="flex items-center justify-between mt-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Column Profile</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {data.total_columns} columns · {data.total_rows?.toLocaleString()} rows
              {data.sampled && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Sampled</span>
              )}
            </p>
          </div>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        {data.insights && data.insights.length > 0 && (
          <div className="mb-5">
            <InsightList insights={data.insights} />
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Column", "Type", "Missing", "Unique", "Mean", "Std Dev", "Min", "Max", "Top Values", "Tags"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.columns as ColumnProfile[]).map((col) => {
                const meta = metaMap[col.name];
                const tags = meta?.tags ?? [];
                const isSensitive = tags.includes("sensitive");
                return (
                  <tr key={col.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isSensitive && <span title="Sensitive">ðŸ"'</span>}
                        <button
                          onClick={() => setSelectedCol(col.name)}
                          className="font-mono text-xs text-brand hover:underline text-left"
                        >
                          {col.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", TYPE_COLOR[col.semantic_type] ?? "bg-gray-100 text-gray-600")}>
                        {col.semantic_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={col.missing_pct > 20 ? "text-amber-600 font-semibold text-xs" : "text-gray-500 text-xs"}>
                        {col.missing_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{col.unique_count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{col.mean != null ? col.mean.toFixed(3) : "-"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{col.std != null ? col.std.toFixed(3) : "-"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{col.min != null ? String(col.min) : "-"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{col.max != null ? String(col.max) : "-"}</td>
                    <td className="px-4 py-2.5">{renderTopValues(col.top_values)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1 items-center">
                        {tags.map((tag) => (
                          <span key={tag} className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5", TAG_COLORS[tag] ?? "bg-gray-100 text-gray-600")}>
                            {tag}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleTag(col.name, tag); }}
                              className="ml-0.5 hover:opacity-70"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingTagCol(editingTagCol === col.name ? null : col.name); }}
                          className="text-[10px] text-gray-400 hover:text-brand flex items-center gap-0.5"
                        >
                          <Tag className="w-2.5 h-2.5" />
                        </button>
                        {editingTagCol === col.name && (
                          <div className="absolute z-20 mt-6 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1 flex-wrap min-w-[160px]">
                            {QUICK_TAGS.map((t) => (
                              <button
                                key={t}
                                onClick={() => { toggleTag(col.name, t); setEditingTagCol(null); }}
                                className={cn("text-[10px] px-2 py-1 rounded-full border transition", tags.includes(t) ? "bg-brand text-white border-brand" : "border-gray-200 text-gray-600 hover:border-brand/60")}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCol && (
        <ColumnDetailPanel
          datasetId={datasetId}
          columnName={selectedCol}
          onClose={() => setSelectedCol(null)}
        />
      )}
    </>
  );
}
