"use client";

import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspacesApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Bell, User, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();

  const [wsOpen, setWsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const { data: workspaces } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list().then((r) => r.data),
  });

  const currentWs = workspaces?.find((w) => w.id === currentWorkspaceId);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSwitchWorkspace = (id: string) => {
    setCurrentWorkspace(id);
    router.push(`/workspaces/${id}/datasets`);
    setWsOpen(false);
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 gap-4 flex-shrink-0">
      {/* Workspace switcher */}
      <div className="relative" ref={wsRef}>
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
            {(workspaces ?? []).map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitchWorkspace(ws.id)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
              >
                <span className="flex-1 text-left truncate">{ws.name}</span>
                {ws.id === currentWorkspaceId && (
                  <Check className="w-3.5 h-3.5 text-blue-500" />
                )}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => { router.push("/workspaces"); setWsOpen(false); }}
                className="w-full text-left px-4 py-2 text-xs text-blue-600 hover:bg-blue-50 transition"
              >
                Manage workspaces →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Notification bell (placeholder) */}
      <button className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">
        <Bell className="w-4 h-4" />
      </button>

      {/* User menu */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => setUserOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
            {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-medium text-gray-800 leading-tight">
              {user?.full_name ?? user?.email}
            </p>
            {user?.is_admin && (
              <p className="text-[10px] text-blue-500">Admin</p>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
        </button>

        {userOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1.5 animate-fade-in">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800 truncate">
                {user?.full_name ?? "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => { router.push("/settings"); setUserOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
