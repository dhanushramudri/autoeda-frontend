"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Lightbulb } from "lucide-react";

interface SubNavProps {
  datasetId: string;
}

const NAV_ITEMS = [
  { label: "Overview",          href: "",                   id: "overview" },
  { label: "Analysis",          href: "/analysis",          id: "analysis" },
  { label: "Profile",           href: "/profile",           id: "profile" },
  { label: "Correlations",      href: "/correlations",      id: "correlations" },
  { label: "Feature Importance",href: "/feature-importance",id: "feature-importance" },
  { label: "Time Series",       href: "/timeseries",        id: "timeseries" },
  { label: "Text",              href: "/text",              id: "text" },
  { label: "Hypotheses",        href: "/hypotheses",        id: "hypotheses" },
  { label: "Transform",         href: "/transform",         id: "transform" },
  { label: "SQL",               href: "/sql",               id: "sql" },
  { label: "Pivot",             href: "/pivot",             id: "pivot" },
  { label: "Rules",             href: "/rules",             id: "rules" },
];

export function SubNav({ datasetId }: SubNavProps) {
  const pathname = usePathname();

  const isActive = (itemId: string): boolean => {
    if (itemId === "overview") return pathname === `/datasets/${datasetId}`;
    return pathname.endsWith(`/${itemId}`) || pathname.includes(`/${itemId}/`);
  };

  return (
    <nav className="sticky top-0 z-30 bg-white border-b border-gray-100" data-tour="subnav-bar">
      <div className="flex items-center px-3 py-2">
        {/* Scrollable tab list */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide min-w-0">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.id);
            const isHypotheses = item.id === "hypotheses";

            if (isHypotheses) {
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
                        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
                        {item.label}
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
      </div>
    </nav>
  );
}