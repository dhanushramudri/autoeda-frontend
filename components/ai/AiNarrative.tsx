"use client";

import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { Sparkles, RefreshCw } from "lucide-react";

interface Props {
  datasetId: string;
  datasetReady: boolean;
}

export function AiNarrative({ datasetId, datasetReady }: Props) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ai-narrative", datasetId],
    queryFn: () => datasetsApi.getAiNarrative(datasetId).then((r) => r.data),
    enabled: datasetReady,
    staleTime: 1000 * 60 * 10, // cache 10 min
    retry: false,
  });

  const narrative = data?.narrative as string | null | undefined;

  if (!datasetReady) return null;

  return (
    <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-violet-700 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" /> AI Summary
        </h2>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-violet-400 hover:text-violet-600 transition disabled:opacity-40"
          title="Regenerate"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading || isFetching ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-violet-200/60 rounded w-full" />
          <div className="h-3 bg-violet-200/60 rounded w-5/6" />
          <div className="h-3 bg-violet-200/60 rounded w-4/6" />
        </div>
      ) : narrative ? (
        <p className="text-sm text-gray-700 leading-relaxed">{narrative}</p>
      ) : (
        <p className="text-xs text-violet-400 italic">
          AI summary unavailable — set GEMINI_API_KEY to enable this feature.
        </p>
      )}
    </div>
  );
}
