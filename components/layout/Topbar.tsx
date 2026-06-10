"use client";

import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspacesApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { Workspace } from "@/types";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { NLQueryBar } from "@/components/shared/NLQueryBar";
import { NotificationBell } from "@/components/layout/NotificationBell";

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();

  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);

  const { data: workspaces } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list().then((r) => r.data),
  });

  const currentWs = workspaces?.find((w: Workspace) => w.id === currentWorkspaceId);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSwitchWorkspace = (id: string) => {
    setCurrentWorkspace(id);
    router.push(`/workspaces/${id}/datasets`);
    setWsOpen(false);
  };

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 gap-4 flex-shrink-0">
      {/* Workspace switcher */}
      <div className="relative" ref={wsRef} data-tour="workspace-selector">
        <button
          onClick={() => setWsOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
        >
          <span className="max-w-[160px] truncate">
            {currentWs?.name ?? "Select workspace"}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>

        {wsOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1.5 animate-fade-in">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              Workspaces
            </p>
            {(workspaces ?? []).map((ws: Workspace) => (
              <button
                key={ws.id}
                onClick={() => handleSwitchWorkspace(ws.id)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
              >
                <span className="flex-1 text-left truncate">{ws.name}</span>
                {ws.id === currentWorkspaceId && (
                  <Check className="w-3.5 h-3.5 text-brand" />
                )}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => { router.push("/workspaces"); setWsOpen(false); }}
                className="w-full text-left px-4 py-2 text-xs text-brand hover:bg-brand/10 transition"
              >
                Manage workspaces →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex justify-center">
        <NLQueryBar />
      </div>

      <NotificationBell workspaceId={currentWorkspaceId ?? undefined} />
    </header>
  );
}