"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Database, LayoutDashboard, FileSearch, Layers,
  TrendingUp, Activity, Type, Lightbulb, Wand2, Code2, ShieldCheck,
} from "lucide-react";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { RowLimitSelector } from "@/components/shared/RowLimitSelector";

interface NavItem { label: string; href: string; id: string; icon: React.ComponentType<{ className?: string }> }
interface NavGroup { label: string; items: NavItem[] }

const EXPLORE_GROUP: NavGroup = {
  label: "Explore",
  items: [
    { label: "Analysis",          href: "/analysis",           id: "analysis",           icon: LayoutDashboard },
    { label: "Profile",           href: "/profile",            id: "profile",            icon: FileSearch },
    { label: "Correlations",      href: "/correlations",       id: "correlations",       icon: Layers },
    { label: "Feature Importance",href: "/feature-importance", id: "feature-importance", icon: TrendingUp },
    { label: "Time Series",       href: "/timeseries",         id: "timeseries",         icon: Activity },
    { label: "Text",              href: "/text",               id: "text",               icon: Type },
  ],
};

const TOOLS_GROUP: NavGroup = {
  label: "Tools",
  items: [
    { label: "Transform", href: "/transform", id: "transform", icon: Wand2 },
    { label: "SQL",       href: "/sql",       id: "sql",       icon: Code2 },
    { label: "Rules",     href: "/rules",     id: "rules",     icon: ShieldCheck },
  ],
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1.5 text-[9px] font-bold tracking-widest uppercase text-sidebar-foreground/40 select-none">
      {children}
    </p>
  );
}

export function DatasetNav() {
  const pathname = usePathname();
  const { datasetId } = useParams<{ datasetId: string }>();

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const base = `/datasets/${datasetId}`;
  const isActive = (id: string) => (id === "overview" ? pathname === base : pathname.startsWith(`${base}/${id}`));

  const itemClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
      !active && "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
    );
  const itemStyle = (active: boolean) =>
    active
      ? {
          backgroundColor: "hsl(var(--primary) / 0.10)",
          color: "hsl(var(--primary))",
          fontWeight: 600,
          borderLeft: "1px solid hsl(var(--primary))",
        }
      : {};

  const hypothesesActive = isActive("hypotheses");

  return (
    <aside className="w-56 flex-shrink-0 h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="px-4 pt-5 pb-3 border-b border-sidebar-border">
        <Link
          href={dataset ? `/workspaces/${dataset.workspace_id}/datasets` : "#"}
          className="flex items-center gap-1 text-[10px] font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-3 h-3" /> Datasets
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-3.5 h-3.5 text-brand flex-shrink-0" />
          <h1 className="text-sm font-bold text-sidebar-foreground leading-tight truncate" title={dataset?.name}>
            {dataset?.name ?? "…"}
          </h1>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-3">
        <Link href={base} className={itemClass(isActive("overview"))} style={itemStyle(isActive("overview"))}>
          <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">Overview</span>
        </Link>

        <Link
          href={`${base}/hypotheses`}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg text-xs font-semibold transition-colors border",
            hypothesesActive
              ? "bg-violet-600 text-white border-violet-600 shadow-sm"
              : "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-100"
          )}
        >
          <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">Hypotheses</span>
        </Link>

        <SectionLabel>{EXPLORE_GROUP.label}</SectionLabel>
        <div className="space-y-0.5">
          {EXPLORE_GROUP.items.map((item) => {
            const active = isActive(item.id);
            const Icon = item.icon;
            return (
              <Link key={item.id} href={`${base}${item.href}`} className={itemClass(active)} style={itemStyle(active)}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <SectionLabel>{TOOLS_GROUP.label}</SectionLabel>
        <div className="space-y-0.5">
          {TOOLS_GROUP.items.map((item) => {
            const active = isActive(item.id);
            const Icon = item.icon;
            return (
              <Link key={item.id} href={`${base}${item.href}`} className={itemClass(active)} style={itemStyle(active)}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <RowLimitSelector datasetId={datasetId} />
      </div>
    </aside>
  );
}
