"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function MissingRedirect() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/datasets/${datasetId}/profile?tab=missing`);
  }, [datasetId, router]);

  return null;
}
