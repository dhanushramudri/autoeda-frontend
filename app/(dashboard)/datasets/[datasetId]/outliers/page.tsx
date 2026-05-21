"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function OutliersRedirect() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/datasets/${datasetId}/profile?tab=outliers`);
  }, [datasetId, router]);

  return null;
}
