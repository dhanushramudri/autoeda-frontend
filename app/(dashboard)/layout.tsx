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

  // currentWorkspaceId is persisted in localStorage independently of any
  // server data — if a workspace gets deleted (or this is a stale value
  // from a previous user on a shared browser), it can keep pointing at a
  // workspace that no longer exists/isn't accessible. Validate it against
  // the user's actual current list before trusting it anywhere.
  const { data: workspaces } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list().then((r) => r.data),
    enabled: !!token,
  });

  // Derive workspaceId from URL or fall back to store
  const workspaceIdFromPath = pathname.match(/\/workspaces\/([^/]+)/)?.[1];
  const datasetIdFromPath = pathname.match(/\/datasets\/([^/]+)/)?.[1];

  // Workspace ids come from two different shapes at runtime — a string from
  // the URL, but a raw number from the API/persisted store — so compare as
  // strings to avoid false "doesn't exist" mismatches like "15" !== 15.
  const matchesWorkspace = (id: string | number) =>
    workspaces?.some((w: { id: string | number }) => String(w.id) === String(id)) ?? false;

  const candidateWorkspaceId = workspaceIdFromPath ?? currentWorkspaceId ?? undefined;
  const isCandidateValid = !candidateWorkspaceId || !workspaces || matchesWorkspace(candidateWorkspaceId);
  const activeWorkspaceId = isCandidateValid ? candidateWorkspaceId : undefined;

  // Clean up the stale persisted id so this doesn't have to be re-derived
  // on every render once we know it's bad.
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
