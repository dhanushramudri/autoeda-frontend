"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubNavProps {
  datasetId: string;
}

const NAV_ITEMS = [
  { label: "Overview",          href: "",                   id: "overview" },
  { label: "Analysis",          href: "/analysis",          id: "analysis" },
  { label: "Profile",           href: "/profile",           id: "profile" },
  { label: "Missing",           href: "/missing",           id: "missing" },
  { label: "Distributions",     href: "/distributions",     id: "distributions" },
  { label: "Correlations",      href: "/correlations",      id: "correlations" },
  { label: "Outliers",          href: "/outliers",          id: "outliers" },
  { label: "Feature Importance",href: "/feature-importance",id: "feature-importance" },
  { label: "Time Series",       href: "/timeseries",        id: "timeseries" },
  { label: "Text",              href: "/text",              id: "text" },
  { label: "Graph",             href: "/graph",             id: "graph" },
  { label: "Transform",         href: "/transform",         id: "transform" },
  { label: "SQL",               href: "/sql",               id: "sql" },
  { label: "Charts",            href: "/charts",            id: "charts" },
  { label: "Pivot",             href: "/pivot",             id: "pivot" },
  { label: "Rules",             href: "/rules",             id: "rules" },
  { label: "History",           href: "/history",           id: "history" },
];

export function SubNav({ datasetId }: SubNavProps) {
  const pathname = usePathname();

  const isActive = (itemId: string): boolean => {
    if (itemId === "overview") return pathname === `/datasets/${datasetId}`;
    return pathname.endsWith(`/${itemId}`) || pathname.includes(`/${itemId}/`);
  };

  return (
    <nav className="sticky top-0 z-30 bg-white border-b border-gray-100" data-tour="subnav-bar">
      <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.id);
          const isSql = item.id === "sql";

          if (isSql) {
            return (
              <Link
                key={item.id}
                href={`/datasets/${datasetId}${item.href}`}
                className={cn(
                  "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors border",
                  active
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                    : "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                )}
              >
                <Code2 className="w-3.5 h-3.5 flex-shrink-0" />
                SQL
              </Link>
            );
          }

          return (
            <Link
              key={item.id}
              href={`/datasets/${datasetId}${item.href}`}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-brand/10 text-brand"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
