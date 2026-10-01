"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { resolveLanding } from "@/lib/landing";

// The site root sends people where the product starts: Solutions (or Workspaces when they have none yet),
// or the login page when they are not signed in.
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    const token = useAuthStore.getState().token ?? sessionStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    resolveLanding().then((dest) => router.replace(dest));
  }, [router]);
  return null;
}
