"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { AskAiPanel } from "@/components/ai/AskAiPanel";

export default function DatasetLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const datasetId = params?.datasetId as string | undefined;

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId ?? ""),
    queryFn: () => datasetsApi.get(datasetId!).then((r) => r.data),
    enabled: !!datasetId,
  });

  return (
    <>
      {children}
      {datasetId && (
        <AskAiPanel
          datasetId={datasetId}
          datasetName={dataset?.name}
        />
      )}
    </>
  );
}
