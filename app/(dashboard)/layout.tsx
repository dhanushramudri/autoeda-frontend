"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi, workspacesApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { PROMO_TICKER_HEIGHT } from "@/components/layout/PromoTicker";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);
  
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();

  // Rehydrate on mount
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [token, router, isHydrated]);

  const { data: workspaces } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list().then((r) => r.data),
    enabled: !!token,
  });

  // Derive workspaceId from URL or fall back to store
  const workspaceIdFromPath = pathname.match(/\/workspaces\/([^/]+)/)?.[1];
  const datasetIdFromPath = pathname.match(/\/datasets\/([^/]+)/)?.[1];

  const matchesWorkspace = (id: string | number) =>
    workspaces?.some((w: { id: string | number }) => String(w.id) === String(id)) ?? false;

  const candidateWorkspaceId = workspaceIdFromPath ?? currentWorkspaceId ?? undefined;
  const isCandidateValid = !candidateWorkspaceId || !workspaces || matchesWorkspace(candidateWorkspaceId);
  const activeWorkspaceId = isCandidateValid ? candidateWorkspaceId : undefined;

  useEffect(() => {
    if (workspaces && currentWorkspaceId && !matchesWorkspace(currentWorkspaceId)) {
      setCurrentWorkspace(null);
    }
  }, [workspaces, currentWorkspaceId, setCurrentWorkspace]);

  const { data: datasets } = useQuery({
    queryKey: queryKeys.datasets.list(activeWorkspaceId ?? ""),
    queryFn: () => datasetsApi.list(activeWorkspaceId!).then((r) => r.data),
    enabled: !!activeWorkspaceId,
  });

  if (!isHydrated || !token) return null;

  return (
    <div className="flex overflow-hidden" style={{ height: `calc(100vh - ${PROMO_TICKER_HEIGHT}px)` }}>
      <Sidebar
        datasets={datasets ?? []}
        workspaceId={activeWorkspaceId}
        activeDatasetId={datasetIdFromPath ?? undefined}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
