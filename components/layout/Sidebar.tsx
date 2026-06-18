"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard, Database, BarChart2, GitBranch,
  Sliders, ChevronDown, LogOut, Settings, Users,
  FileSearch, TrendingUp, AlertTriangle, Layers,
  Type, Network, Wand2, Plug, Warehouse, ShieldCheck,
  Code2, PieChart, ChevronLeft, MessageSquarePlus,
  HelpCircle, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/types";
import { useTour } from "@/hooks/useTourContext";
import { tourSteps } from "@/lib/tourSteps";

// -- Dataset sub-nav  --  grouped by priority -------------------------------------
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

const WORKSPACE_LINKS = [
  { label: "Warehouse",        href: "/warehouse",    icon: Warehouse },
  { label: "Join Builder",     href: "/join-builder", icon: Sliders },
  { label: "Data Sources",     href: "/sources",      icon: Plug },
  { label: "Members",          href: "/members",      icon: Users },
];

// -- Animated SVG background (rose-pink data motifs) ----------------------------
function SidebarBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 256 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <style>{`
          @keyframes sfloat1 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-14px)} }
          @keyframes sfloat2 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
          @keyframes sfloat3 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-18px)} }
          @keyframes sdash   { to { stroke-dashoffset: -36; } }
          .sf1 { animation: sfloat1 7s ease-in-out infinite; }
          .sf2 { animation: sfloat2 9s ease-in-out infinite 1.2s; }
          .sf3 { animation: sfloat3 6s ease-in-out infinite 2.4s; }
          .sline { stroke-dasharray:5 4; animation: sdash 3.5s linear infinite; }
        `}</style>
      </defs>

      {/* TOP — small bar chart */}
      <g transform="translate(10,60)">
        <g className="sf2" opacity="0.10">
          <rect x="0"  y="28" width="10" height="16" rx="2" fill="#ff6196"/>
          <rect x="14" y="10" width="10" height="34" rx="2" fill="#ff6196"/>
          <rect x="28" y="18" width="10" height="26" rx="2" fill="#ff6196"/>
          <rect x="42" y="4"  width="10" height="40" rx="2" fill="#ff6196"/>
          <rect x="56" y="14" width="10" height="30" rx="2" fill="#ff6196"/>
        </g>
      </g>

      {/* TOP RIGHT — line chart */}
      <g transform="translate(150,30)">
        <g className="sf1" opacity="0.08">
          <polyline points="0,40 22,20 44,32 66,8 88,22"
            fill="none" stroke="#ff6196" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="0"  cy="40" r="3" fill="#ff6196"/>
          <circle cx="22" cy="20" r="3" fill="#ff6196"/>
          <circle cx="44" cy="32" r="3" fill="#ff6196"/>
          <circle cx="66" cy="8"  r="3" fill="#ff6196"/>
          <circle cx="88" cy="22" r="3" fill="#ff6196"/>
        </g>
      </g>

      {/* MID LEFT — scatter */}
      <g transform="translate(8,280)">
        <g className="sf3" opacity="0.08">
          {[[0,18],[18,4],[32,28],[50,12],[68,36],[85,8],[100,22]].map(([cx,cy],i)=>(
            <circle key={i} cx={cx} cy={cy} r="3.5" fill="#ff6196"/>
          ))}
          <line x1="0" y1="34" x2="104" y2="4" stroke="#ff6196" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.4"/>
        </g>
      </g>

      {/* MID RIGHT — small bars */}
      <g transform="translate(160,260)">
        <g className="sf2" opacity="0.09">
          <rect x="0"  y="40" width="10" height="20" rx="2" fill="#ff6196"/>
          <rect x="14" y="20" width="10" height="40" rx="2" fill="#ff6196"/>
          <rect x="28" y="30" width="10" height="30" rx="2" fill="#ff6196"/>
          <rect x="42" y="10" width="10" height="50" rx="2" fill="#ff6196"/>
        </g>
      </g>

      {/* BOTTOM LEFT — line chart */}
      <g transform="translate(10,580)">
        <g className="sf1" opacity="0.09">
          <polyline points="0,44 28,22 56,36 84,10 112,28 140,6"
            fill="none" stroke="#ff6196" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="0"   cy="44" r="3" fill="#ff6196"/>
          <circle cx="28"  cy="22" r="3" fill="#ff6196"/>
          <circle cx="56"  cy="36" r="3" fill="#ff6196"/>
          <circle cx="84"  cy="10" r="3" fill="#ff6196"/>
          <circle cx="112" cy="28" r="3" fill="#ff6196"/>
          <circle cx="140" cy="6"  r="3" fill="#ff6196"/>
        </g>
      </g>

      {/* BOTTOM RIGHT — scatter */}
      <g transform="translate(150,700)">
        <g className="sf3" opacity="0.08">
          {[[0,0],[16,24],[36,8],[50,40],[68,16],[84,32]].map(([cx,cy],i)=>(
            <circle key={i} cx={cx} cy={cy} r="4" fill="#ff6196"/>
          ))}
          <line x1="0" y1="38" x2="88" y2="4" stroke="#ff6196" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.4"/>
        </g>
      </g>

      {/* Animated connector lines */}
      <g opacity="0.05">
        <line className="sline" x1="30"  y1="590" x2="120" y2="390" stroke="#ff6196" strokeWidth="1.2"/>
        <line className="sline" x1="180" y1="80"  x2="240" y2="260" stroke="#ff6196" strokeWidth="1.2"/>
        <line className="sline" x1="60"  y1="170" x2="200" y2="290" stroke="#ff6196" strokeWidth="1.2"/>
        <line className="sline" x1="140" y1="680" x2="220" y2="530" stroke="#ff6196" strokeWidth="1.2"/>
      </g>
    </svg>
  );
}

// -- Small helpers --------------------------------------------------------------

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  return (
    !collapsed && (
      <div className="px-4 pt-4 pb-1">
        <span className="text-[9px] font-bold tracking-widest uppercase text-sidebar-foreground select-none">
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
  const router      = useRouter();
  const queryClient = useQueryClient();
  const user        = useAuthStore((s) => s.user);
  const clearAuth   = useAuthStore((s) => s.clearAuth);
  const { startTour } = useTour();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [expandedDataset, setExpandedDataset] = useState<string | null>(activeDatasetId ?? null);
  const [datasetsExpanded, setDatasetsExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    clearAuth();
    queryClient.clear();
    router.push("/login");
  };

  const userInitials = (
    user?.full_name
      ? user.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")
      : user?.email?.[0] ?? "U"
  ).toUpperCase();

  return (
    <aside className={cn(
      "relative min-h-screen bg-sidebar flex flex-col border-r border-sidebar-border shadow-sm transition-all duration-300 ease-in-out overflow-hidden",
      sidebarOpen ? "w-64" : "w-20"
    )}>

      {/* ── Animated SVG background ── */}
      <SidebarBackground />

      {/* All content sits above the SVG */}
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">

        {/* -- Logo & Toggle -- */}
        <div className="px-3 min-h-14  border-sidebar-border flex items-center gap-2">
          {sidebarOpen ? (
        <Link href="/workspaces" className="flex-1 flex flex-col items-stretch justify-center min-w-0 py-4 gap-0 pl-3 pr-3 px-3">
            <img
              src="/jman_logo.svg"
              alt="JMAN"
              className="h-5 w-auto object-contain mt-1"
            />
<span className="leading-none select-none w-full text-right -mt-0.5 pr-10">
  <span className="text-[14px] font-serif font-bold text-sidebar-foreground">Auto</span>
  <span className="text-[12px] font-mono font-normal" style={{ color: "hsl(var(--primary))" }}>EDA</span>
</span>
          </Link>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex-1 flex items-center justify-center"
              title="AutoEDA — expand sidebar"
            >
              <span className="leading-none select-none">
                <span className="text-[15px] font-serif font-bold text-sidebar-foreground">A</span>
                <span className="text-[13px] font-mono font-normal" style={{ color: "hsl(var(--primary))" }}>E</span>
              </span>
            </button>
          )}

          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground hover:text-sidebar-foreground"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* -- Nav -- */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">

          {/* -- 1. All Workspaces -- */}
          {workspaceId && (
            <div className="px-3 pb-1">
              <Link
                href="/workspaces"
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  sidebarOpen ? "justify-start" : "justify-center",
                  pathname === "/workspaces"
                    ? "font-semibold"
                    : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
                style={pathname === "/workspaces" ? {
                      backgroundColor: "hsl(var(--primary) / 0.10)",
                      color: "hsl(var(--primary))",
                      borderLeft: "1px solid hsl(var(--primary))",
                    } : {}}
                title="All Workspaces"
              >
                <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" />
                {sidebarOpen && <span>All Workspaces</span>}
              </Link>
            </div>
          )}

          {workspaceId && (
            <>
              {/* -- 2. Datasets -- */}
              <SectionLabel collapsed={!sidebarOpen}>Datasets</SectionLabel>

              <div className="px-3 mt-2" data-tour="datasets-section">
                <Link
                  href={`/workspaces/${workspaceId}/datasets`}
                  onClick={() => setDatasetsExpanded((p) => !p)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition",
                    sidebarOpen ? "justify-start" : "justify-center"
                  )}
                  title="Datasets"
                >
                  <Database className="w-3.5 h-3.5 text-sidebar-foreground" />

                  {sidebarOpen && (
                    <>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/70">
                        Datasets
                      </span>

                      {datasets.length > 0 && (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            backgroundColor: "hsl(var(--primary) / 0.10) / 0.12)",
                            color: "hsl(var(--primary))",
                          }}
                        >
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
                </Link>
              </div>

              {datasetsExpanded && (
                <div className={cn(
                  "mt-1 space-y-0.5 transition-all duration-300",
                  sidebarOpen ? "px-4" : "hidden"
                )}>
                  {datasets.length === 0 && (
                    <p className="px-3 py-2 text-xs text-sidebar-foreground italic">
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
                              ? "shadow-sm font-semibold"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                          style={isActive ? {
                            backgroundColor: "hsl(var(--primary) / 0.10)",
                            color: "hsl(var(--primary))",
                            borderLeft: "1px solid hsl(var(--primary))",
                          } : {}}
                          title={ds.name}
                        >
                          <Database className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                          <span className="flex-1 text-left truncate">{ds.name}</span>
                          <ChevronDown
                            className={cn(
                              "w-3 h-3 flex-shrink-0 transition-transform duration-200 opacity-60",
                              isExpanded ? "rotate-0" : "-rotate-90"
                            )}
                          />
                        </button>

                        {isExpanded && (
                          <div
                            className="ml-4 mt-0.5 mb-1 pl-3"
                            style={{ borderLeft: "1px solid rgb(255 97 150 / 0.18)" }}
                          >
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
                                          ? "font-semibold"
                                          : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                      )}
                                      style={active ? {
                                          color: "hsl(var(--primary))",
                                          backgroundColor: "hsl(var(--primary) / 0.10)",
                                          borderLeft: "1px solid hsl(var(--primary))",
                                        } : {}}
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

              {/* -- 3. Workspace tools -- */}
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
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        sidebarOpen ? "justify-start" : "justify-center",
                        !isActive && "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                      style={isActive ? {
  backgroundColor: "hsl(var(--primary) / 0.10)",
  color: "hsl(var(--primary))",
  fontWeight: 600,
  borderLeft: "1px solid hsl(var(--primary))",
} : {}}
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

          {/* Feedback */}
          <Link
            href="/feedback"
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              sidebarOpen ? "justify-start" : "justify-center",
              pathname === "/feedback"
                ? "bg-amber-50 text-amber-700"
                : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            )}
            title="Feedback"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 flex-shrink-0" />
            {sidebarOpen && <span>Feedback</span>}
          </Link>

          {/* Tour */}
          <button
            onClick={() => startTour(tourSteps)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              sidebarOpen ? "justify-start" : "justify-center",
              "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
            title="Tour Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {sidebarOpen && <span>Tour Guide</span>}
          </button>

          {/* User card */}
          <div className="relative pt-1 mt-1 border-t border-sidebar-border/50" ref={userMenuRef}>

            {/* User popover — opens above */}
            {userMenuOpen && (
              <div className={cn(
                "absolute bottom-full mb-2 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 z-50 animate-fade-in",
                sidebarOpen ? "left-0 right-0" : "left-0 w-52"
              )}>
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {user?.full_name ?? "User"}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={() => { router.push("/settings"); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 opacity-60" />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            )}

            {/* Trigger button */}
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors",
                sidebarOpen ? "justify-start" : "justify-center"
              )}
              title={user?.full_name ?? user?.email ?? "Account"}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ backgroundColor: "hsl(var(--primary) / 0.10))" }}
              >
                {userInitials}
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                      {user?.full_name ?? user?.email}
                    </p>
                    {user?.is_admin && (
                      <p className="text-[10px] leading-tight" style={{ color: "hsl(var(--primary))" }}>
                        Admin
                      </p>
                    )}
                  </div>
                  <ChevronUp className={cn(
                    "w-3.5 h-3.5 text-sidebar-foreground/40 transition-transform flex-shrink-0",
                    !userMenuOpen && "rotate-180"
                  )} />
                </>
              )}
            </button>
          </div>
        </div>

      </div>{/* end z-10 wrapper */}
    </aside>
  );
}