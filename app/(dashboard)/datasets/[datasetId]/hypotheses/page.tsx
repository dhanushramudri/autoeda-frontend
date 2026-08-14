"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

/**
 * The per-dataset Hypotheses tab now deep-links into the workspace-level
 * hub, pre-scoped to this dataset, rather than maintaining a second
 * implementation. Keeps the SubNav tab and any bookmarked URL working.
 */
export default function HypothesesRedirect() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();

  const { data: dataset } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  useEffect(() => {
    if (dataset?.workspace_id) {
      router.replace(`/workspaces/${dataset.workspace_id}/hypotheses?dataset_id=${datasetId}`);
    }
  }, [dataset, datasetId, router]);

  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground/60">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}
