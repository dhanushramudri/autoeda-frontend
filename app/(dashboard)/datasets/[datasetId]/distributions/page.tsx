"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function DistributionsRedirect() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const column = searchParams.get("column");

  useEffect(() => {
    const dest = column
      ? `/datasets/${datasetId}/profile?tab=distributions&column=${encodeURIComponent(column)}`
      : `/datasets/${datasetId}/profile?tab=distributions`;
    router.replace(dest);
  }, [datasetId, router, column]);

  return null;
}
