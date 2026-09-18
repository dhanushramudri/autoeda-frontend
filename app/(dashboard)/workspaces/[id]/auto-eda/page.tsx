"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { AutoEdaPanel } from "@/components/auto-eda/AutoEdaPanel";
import { Microscope, Database } from "lucide-react";

export default function AutoEdaPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopedDatasetId = searchParams.get("dataset_id") ?? undefined;

  const { data: dataset } = useQuery({
    queryKey: ["dataset", scopedDatasetId],
    queryFn: () => datasetsApi.get(scopedDatasetId!).then((r) => r.data),
    enabled: !!scopedDatasetId,
  });

  const { data: workspaceDatasets } = useQuery({
    queryKey: queryKeys.datasets.list(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId).then((r) => r.data as Array<{ id: string; name: string }>),
    enabled: !scopedDatasetId,
  });

  const clearScope = () => router.push(`/workspaces/${workspaceId}/auto-eda`);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 pt-6 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
            <Microscope className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <h1 className="text-xl font-bold text-foreground">Auto EDA</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          An autonomous EDA agent: it plans its own worklist, runs every analysis for real, and writes up the findings.
        </p>
        {scopedDatasetId && (
          <div className="flex items-center gap-2 mb-1 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
              <Database className="w-3 h-3" />
              Scoped to {dataset?.name ?? `dataset #${scopedDatasetId}`}
            </span>
            <button onClick={clearScope} className="text-xs text-muted-foreground hover:text-muted-foreground">
              Clear scope
            </button>
          </div>
        )}
      </div>

      <AutoEdaPanel
        workspaceId={workspaceId}
        scopedDatasetId={scopedDatasetId}
        datasets={workspaceDatasets ?? (dataset ? [{ id: String(dataset.id), name: dataset.name }] : [])}
      />
    </div>
  );
}
