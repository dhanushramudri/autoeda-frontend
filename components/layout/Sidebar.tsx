"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard, Database, BarChart2, GitBranch,
  Sliders, ChevronDown, LogOut, Settings, Users,
  FileSearch, TrendingUp, AlertTriangle, Layers,
  Type, Network, Wand2, Plug, Warehouse, ShieldCheck,
  Code2, PieChart, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/types";

// -- Dataset sub-nav  --  grouped by priority -------------------------------------
// Group 1: Explore  (highest value  --  first stop for any new dataset)
// Group 2: Quality  (data health  --  catch problems early)
// Group 3: Analysis (deeper insights)
// Group 4: Tools    (power-user operations)
// Group 5: Manage   (audit & history)

interface NavItem  { label: string; href: string; icon: React.ComponentType<{ className?: string }> }
interface NavGroup { label: string; items: NavItem[] }

const DATASET_GROUPS: NavGroup[] = [
  {
    label: "Explore",
    items: [
      { label: "Overview",       href: "",               icon: LayoutDashboard },
      { label: "Profile",        href: "/profile",       icon: FileSearch },
      { label: "Distributions",  href: "/distributions", icon: BarChart2 },
      { label: "Correlations",   href: "/correlations",  icon: Layers },
    ],
  },
  {
    label: "Quality",
    items: [
      { label: "Missing Values", href: "/missing",  icon: AlertTriangle },
      { label: "Outliers",       href: "/outliers", icon: ShieldCheck },
      { label: "Quality Rules",  href: "/rules",    icon: ShieldCheck },
    ],
  },
  {
    label: "Analysis",
    items: [
      { label: "Feature Importance",  href: "/feature-importance", icon: TrendingUp },
      { label: "Time Series",         href: "/timeseries",         icon: TrendingUp },
      { label: "Text Analysis",       href: "/text",               icon: Type },
      { label: "Relationship Graph",  href: "/graph",              icon: Network },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Transform Studio", href: "/transform", icon: Wand2 },
      { label: "SQL Editor",       href: "/sql",       icon: Code2 },
      { label: "Chart Builder",    href: "/charts",    icon: PieChart },
      { label: "Pivot Table",      href: "/pivot",     icon: Layers },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "History", href: "/history", icon: GitBranch },
    ],
  },
];

// -- Workspace tools  --  ordered by feature importance ----------------------------
// 1. Warehouse   --  query across all data, highest power
// 2. Compare     --  side-by-side dataset diff, very common
// 3. Join Builder  --  visual join designer
// 4. Data Sources  --  external connections
// 5. Analytics   --  workspace-level metrics
// 6. Members     --  admin / infrequent

const WORKSPACE_LINKS = [
  { label: "Warehouse",        href: "/warehouse",    icon: Warehouse },
  { label: "Compare Datasets", href: "/compare",      icon: GitBranch },
  { label: "Join Builder",     href: "/join-builder", icon: Sliders },
  { label: "Data Sources",     href: "/sources",      icon: Plug },
  { label: "Analytics",        href: "/analytics",    icon: BarChart2 },
  { label: "Members",          href: "/members",      icon: Users },
];

// -- Small helpers --------------------------------------------------------------

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  return (
    !collapsed && (
      <div className="px-4 pt-4 pb-1">
        <span className="text-[9px] font-bold tracking-widest uppercase text-sidebar-foreground/30 select-none">
          {children}
        </span>
      </div>
    )
  );
}

function SubGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-2 pb-0.5 text-[8px] font-semibold uppercase tracking-widest text-sidebar-foreground/25 select-none">
      {children}
    </p>
  );
}

// -- Sidebar --------------------------------------------------------------------

interface SidebarProps {
  datasets?: Dataset[];
  workspaceId?: string;
  activeDatasetId?: string;
}

export function Sidebar({ datasets = [], workspaceId, activeDatasetId }: SidebarProps) {
  const pathname  = usePathname();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [expandedDataset, setExpandedDataset] = useState<string | null>(activeDatasetId ?? null);
  const [datasetsExpanded, setDatasetsExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <aside className={cn(
      "min-h-screen bg-sidebar flex flex-col border-r border-sidebar-border shadow-sm transition-all duration-300 ease-in-out",
      sidebarOpen ? "w-64" : "w-20"
    )}>

      {/* -- Logo & Toggle -- */}
      <div className="px-4 py-3 border-b border-sidebar-border flex items-center justify-between">
        {sidebarOpen && (
          <Link href="/workspaces">
            <img src="/logo.png" alt="AutoEDA" className="h-8 w-auto object-contain" />
          </Link>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <ChevronLeft className={cn(
            "w-4 h-4 transition-transform",
            sidebarOpen ? "rotate-0" : "rotate-180"
          )} />
        </button>
      </div>

      {/* -- Nav -- */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">

        {/* -- 1. All Workspaces ------------------------------------------- */}
        {workspaceId && (
          <div className="px-3 pb-1">
            <Link
              href="/workspaces"
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors justify-center sm:justify-start",
                pathname === "/workspaces"
                  ? "bg-brand/10 text-brand font-semibold"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
              title="All Workspaces"
            >
              <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" />
              {sidebarOpen && <span>All Workspaces</span>}
            </Link>
          </div>
        )}

        {workspaceId && (
          <>
            {/* -- 2. Datasets ---------------------------------------------- */}
            <SectionLabel collapsed={!sidebarOpen}>Datasets</SectionLabel>

{/* -- 2. Datasets ---------------------------------------------- */}

<div className="px-3 mt-2" data-tour="datasets-section">
  <button
    onClick={() => setDatasetsExpanded((p) => !p)}
    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition justify-center sm:justify-start"
    title="Datasets"
  >
    <Database className="w-3.5 h-3.5 text-sidebar-foreground/60" />

    {sidebarOpen && (
      <>
        <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/70">
          Datasets
        </span>

        {datasets.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-semibold">
            {datasets.length}
          </span>
        )}

        <div className="flex-1" />
      </>
    )}

    {sidebarOpen && (
      <ChevronDown
        className={cn(
          "w-3.5 h-3.5 text-sidebar-foreground/40 transition-transform",
          datasetsExpanded ? "rotate-0" : "-rotate-90"
        )}
      />
    )}
  </button>
</div>

{datasetsExpanded && (
    <div className={cn(
      "mt-1 space-y-0.5 transition-all duration-300",
      sidebarOpen ? "px-4" : "hidden"
    )}>
      {datasets.length === 0 && (
      <p className="px-3 py-2 text-xs text-sidebar-foreground/30 italic">
        No datasets yet
      </p>
    )}

    {datasets.map((ds) => {
      const base       = `/datasets/${ds.id}`;
      const isExpanded = expandedDataset === ds.id;
      const isActive   = pathname.startsWith(base);

      return (
        <div key={ds.id}>
          <button
            onClick={() => setExpandedDataset(isExpanded ? null : ds.id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
              isActive
                ? "bg-brand text-white shadow-sm"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
            title={ds.name}
          >
            <Database className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />

            <span className="flex-1 text-left truncate">
              {ds.name}
            </span>

            <ChevronDown
              className={cn(
                "w-3 h-3 flex-shrink-0 transition-transform duration-200 opacity-60",
                isExpanded ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>

          {isExpanded && (
            <div className="ml-4 mt-0.5 mb-1 pl-3 border-l border-brand/15">
              {DATASET_GROUPS.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && (
                    <div className="my-1 border-t border-sidebar-border/40" />
                  )}

                  <SubGroupLabel>{group.label}</SubGroupLabel>

                  {group.items.map((section) => {
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
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-normal transition-colors",
                          active
                            ? "text-brand bg-brand/10 font-semibold"
                            : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <Icon className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
                        {section.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    })}
  </div>
)}

            {/* -- 3. Workspace tools --------------------------------------- */}
            {sidebarOpen && <div className="mt-3 mx-3 border-t border-sidebar-border/50" />}
            <SectionLabel collapsed={!sidebarOpen}>Workspace</SectionLabel>

            <div className="px-3 space-y-0.5">
              {WORKSPACE_LINKS.map((link) => {
                const href     = `/workspaces/${workspaceId}${link.href}`;
                const isActive = pathname.includes(link.href);
                const Icon     = link.icon;
                const tourAttr =
                  link.href === "/warehouse"
                    ? "warehouse-link"
                    : link.href === "/join-builder"
                    ? "join-builder-link"
                    : undefined;
                return (
                  <Link
                    key={link.href}
                    href={href}
                    data-tour={tourAttr}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors justify-center sm:justify-start",
                      isActive
                        ? "bg-brand/10 text-brand font-semibold"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                    title={sidebarOpen ? undefined : link.label}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {sidebarOpen && <span>{link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* -- Bottom -- */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors justify-center sm:justify-start",
            pathname === "/settings"
              ? "bg-brand/10 text-brand font-semibold"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          )}
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5 flex-shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-500/10 justify-center sm:justify-start"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          {sidebarOpen && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
