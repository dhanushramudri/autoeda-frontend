"use client";

import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspacesApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { Workspace } from "@/types";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewFeatureNudge } from "@/components/shared/NewFeatureNudge";

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

  const showNudge = pathname === "/workspaces";

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

      <div className="flex-1" />

      <div className="relative">
        {showNudge && (
          <style>{`
            @keyframes icon-ping {
              0%   { transform: scale(1);   opacity: 0.75; }
              100% { transform: scale(2);   opacity: 0;    }
            }
            @keyframes icon-glow-pulse {
              0%, 100% { box-shadow: 0 0 6px 2px rgba(124,58,237,0.30); }
              50%       { box-shadow: 0 0 18px 6px rgba(124,58,237,0.55); }
            }
            .library-ping {
              position: absolute;
              inset: 0;
              border-radius: 9999px;
              border: 2px solid #A78BFA;
              animation: icon-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              pointer-events: none;
            }
            .library-ping-delay {
              animation-delay: 0.6s;
            }
            .library-glow {
              position: absolute;
              inset: 0;
              border-radius: 9999px;
              animation: icon-glow-pulse 2.6s ease-in-out infinite;
              pointer-events: none;
            }
          `}</style>
        )}

        <button
          onClick={() => router.push("/library")}
          title="Dataset Library"
          className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 relative z-10"
          style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}
        >
          <BookOpen className="w-4 h-4 text-white" />
        </button>

        {showNudge && (
          <>
            <span className="library-ping" />
            <span className="library-ping library-ping-delay" />
            <span className="library-glow" />
            <NewFeatureNudge label="Dataset Library" className="top-full right-0 mt-1" />
          </>
        )}
      </div>
    </header>
  );
}