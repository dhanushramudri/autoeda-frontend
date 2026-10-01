"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolveLanding } from "@/lib/landing";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    resolveLanding().then((dest) => router.replace(dest));
  }, [router]);
  return null;
}
