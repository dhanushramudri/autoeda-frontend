"use client";

import { useQuery } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";

export function useJobPoller(jobId: string | null, onComplete?: (result: unknown) => void) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId!).then((r) => r.data),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "completed" || status === "failed") return false;
      return 1500;
    },
    select: (data) => {
      if (data.status === "completed" && onComplete) {
        onComplete(data.result_data);
      }
      return data;
    },
  });
}
