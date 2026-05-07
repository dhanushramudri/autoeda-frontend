"use client";

import { useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi, workspacesApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { currentWorkspaceId } = useWorkspaceStore();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
    }
  }, [token, router]);

  // Derive workspaceId from URL or fall back to store
  const workspaceIdFromPath = pathname.match(/\/workspaces\/([^/]+)/)?.[1];
  const datasetIdFromPath = pathname.match(/\/datasets\/([^/]+)/)?.[1];

  // Determine which workspaceId to use for sidebar context
  const activeWorkspaceId = workspaceIdFromPath ?? currentWorkspaceId ?? undefined;

  const { data: datasets } = useQuery({
    queryKey: queryKeys.datasets.list(activeWorkspaceId ?? ""),
    queryFn: () => datasetsApi.list(activeWorkspaceId!).then((r) => r.data),
    enabled: !!activeWorkspaceId,
  });

  if (!token) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
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
