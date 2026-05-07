"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  LayoutDashboard,
  Database,
  BarChart2,
  GitBranch,
  Sliders,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  Users,
  FileSearch,
  TrendingUp,
  AlertTriangle,
  Layers,
  Type,
  Network,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const datasetSections: NavItem[] = [
  { label: "Overview", href: "", icon: LayoutDashboard },
  { label: "Profile", href: "/profile", icon: FileSearch },
  { label: "Missing Values", href: "/missing", icon: AlertTriangle },
  { label: "Distributions", href: "/distributions", icon: BarChart2 },
  { label: "Correlations", href: "/correlations", icon: Layers },
  { label: "Outliers", href: "/outliers", icon: AlertTriangle },
  { label: "Feature Importance", href: "/feature-importance", icon: TrendingUp },
  { label: "Time Series", href: "/timeseries", icon: TrendingUp },
  { label: "Text Analysis", href: "/text", icon: Type },
  { label: "Relationship Graph", href: "/graph", icon: Network },
  { label: "Transform Studio", href: "/transform", icon: Wand2 },
];

interface SidebarProps {
  datasets?: Dataset[];
  workspaceId?: string;
  activeDatasetId?: string;
}

export function Sidebar({ datasets = [], workspaceId, activeDatasetId }: SidebarProps) {
  const pathname = usePathname();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [expandedDataset, setExpandedDataset] = useState<string | null>(activeDatasetId ?? null);

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col border-r border-slate-800">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <Link href="/workspaces" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" fill="white" opacity="0.8" />
              <path d="M14 14h7v7h-7z" fill="white" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
              Jman Group
            </p>
            <p className="text-sm font-bold text-white leading-tight">AutoEDA</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        {/* Workspace link */}
        {workspaceId && (
          <div className="px-3 mb-2">
            <Link
              href="/workspaces"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-sidebar-hover text-xs font-medium transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              All Workspaces
            </Link>
          </div>
        )}

        {/* Datasets section */}
        {workspaceId && (
          <>
            <div className="px-5 mb-1.5 mt-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                Datasets
              </span>
            </div>

            {datasets.length === 0 && (
              <p className="px-5 py-2 text-xs text-slate-600">No datasets yet</p>
            )}

            {datasets.map((ds) => {
              const base = `/datasets/${ds.id}`;
              const isExpanded = expandedDataset === ds.id;
              const isActive = pathname.startsWith(base);

              return (
                <div key={ds.id}>
                  <button
                    onClick={() => setExpandedDataset(isExpanded ? null : ds.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 mx-2 py-2 rounded-lg text-xs font-medium transition",
                      isActive
                        ? "text-white bg-sidebar-active"
                        : "text-slate-400 hover:text-white hover:bg-sidebar-hover"
                    )}
                    style={{ width: "calc(100% - 16px)" }}
                  >
                    <Database className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{ds.name}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="ml-6 mt-0.5 mb-1 border-l border-slate-800 pl-2">
                      {datasetSections.map((section) => {
                        const href = `${base}${section.href}`;
                        const active =
                          section.href === ""
                            ? pathname === base
                            : pathname.startsWith(href);
                        const Icon = section.icon;
                        return (
                          <Link
                            key={section.href}
                            href={href}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition",
                              active
                                ? "text-blue-400 bg-blue-950/40"
                                : "text-slate-500 hover:text-slate-200 hover:bg-sidebar-hover"
                            )}
                          >
                            <Icon className="w-3 h-3 flex-shrink-0" />
                            {section.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Workspace actions */}
            <div className="px-5 mt-4 mb-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                Workspace
              </span>
            </div>
            <div className="px-3">
              <Link
                href={`/workspaces/${workspaceId}/compare`}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition",
                  pathname.includes("/compare")
                    ? "text-white bg-sidebar-active"
                    : "text-slate-400 hover:text-white hover:bg-sidebar-hover"
                )}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Compare Datasets
              </Link>
              <Link
                href={`/workspaces/${workspaceId}/members`}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition",
                  pathname.includes("/members")
                    ? "text-white bg-sidebar-active"
                    : "text-slate-400 hover:text-white hover:bg-sidebar-hover"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Members
              </Link>
            </div>
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-800 px-3 py-3 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-sidebar-hover text-xs font-medium transition"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 text-xs font-medium transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
