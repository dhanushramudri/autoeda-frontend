"use client";

import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspacesApi, jobsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { Workspace } from "@/types";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, BookOpen, Bell, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewFeatureNudge } from "@/components/shared/NewFeatureNudge";
import { formatDistanceToNow } from "date-fns";

// ── Jobs Panel ────────────────────────────────────────────────────────────────

interface Job { job_id: string; status: string; progress: number; message?: string }

function JobsPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: jobs, refetch } = useQuery<Job[]>({
    queryKey: ["jobs-panel"],
    queryFn: () => jobsApi.list().then((r) => r.data),
    refetchInterval: open ? 2000 : 8000,
  });

  // Auto-poll faster when there are active jobs
  const hasActive = (jobs ?? []).some((j) => j.status === "pending" || j.status === "running");
  useQuery({
    queryKey: ["jobs-panel-active"],
    queryFn: () => jobsApi.list().then((r) => r.data),
    refetchInterval: hasActive ? 1500 : false,
    enabled: hasActive,
  });

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const activeCount = (jobs ?? []).filter((j) => j.status === "pending" || j.status === "running").length;

  function statusIcon(status: string) {
    if (status === "running" || status === "pending") return <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />;
    if (status === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (status === "failed") return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }

  function statusColor(status: string) {
    if (status === "running" || status === "pending") return "text-brand";
    if (status === "completed") return "text-emerald-600";
    if (status === "failed") return "text-red-600";
    return "text-muted-foreground";
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((v) => !v); refetch(); }}
        className="relative w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition text-muted-foreground"
        title="Background Jobs"
      >
        <Bell className="w-4 h-4" />
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand rounded-full flex items-center justify-center text-[9px] text-white font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-card rounded-xl shadow-xl border border-border z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Background Jobs</span>
            {hasActive && <span className="text-[10px] text-brand animate-pulse">● Live</span>}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {(!jobs || jobs.length === 0) ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">No jobs yet</p>
            ) : jobs.map((job) => (
              <div key={job.job_id} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">{statusIcon(job.status)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium truncate", statusColor(job.status))}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{job.message ?? "—"}</p>
                    {(job.status === "running" || job.status === "pending") && (
                      <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${Math.max(job.progress, 5)}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
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
    <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-4 flex-shrink-0">
      {/* Workspace switcher */}
      <div className="relative" ref={wsRef} data-tour="workspace-selector">
        <button
          onClick={() => setWsOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-border hover:bg-muted transition text-sm font-medium text-foreground"
        >
          <span className="max-w-[160px] truncate">
            {currentWs?.name ?? "Select workspace"}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>

        {wsOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-card rounded-xl shadow-lg border border-border z-50 py-1.5 animate-fade-in">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Workspaces
            </p>
            {(workspaces ?? []).map((ws: Workspace) => (
              <button
                key={ws.id}
                onClick={() => handleSwitchWorkspace(ws.id)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm text-foreground transition"
              >
                <span className="flex-1 text-left truncate">{ws.name}</span>
                {ws.id === currentWorkspaceId && (
                  <Check className="w-3.5 h-3.5 text-brand" />
                )}
              </button>
            ))}
            <div className="border-t border-border mt-1 pt-1">
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

      {/* Jobs panel */}
      <JobsPanel />

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