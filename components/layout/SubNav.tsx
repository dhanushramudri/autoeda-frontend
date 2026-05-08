"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SubNavProps {
  datasetId: string;
}

const NAV_ITEMS = [
  { label: "Overview", href: "", id: "overview" },
  { label: "Analysis", href: "/analysis", id: "analysis" },
  { label: "Profile", href: "/profile", id: "profile" },
  { label: "Missing", href: "/missing", id: "missing" },
  { label: "Distributions", href: "/distributions", id: "distributions" },
  { label: "Correlations", href: "/correlations", id: "correlations" },
  { label: "Outliers", href: "/outliers", id: "outliers" },
  { label: "Feature Importance", href: "/feature-importance", id: "feature-importance" },
  { label: "Time Series", href: "/timeseries", id: "timeseries" },
  { label: "Text", href: "/text", id: "text" },
  { label: "Graph", href: "/graph", id: "graph" },
  { label: "Transform", href: "/transform", id: "transform" },
  { label: "Pivot", href: "/pivot", id: "pivot" },
  { label: "Charts", href: "/charts", id: "charts" },
  { label: "Rules", href: "/rules", id: "rules" },
  { label: "History", href: "/history", id: "history" },
  { label: "SQL", href: "/sql", id: "sql" },
];

export function SubNav({ datasetId }: SubNavProps) {
  const pathname = usePathname();

  const isActive = (itemId: string): boolean => {
    if (itemId === "overview") {
      return pathname === `/datasets/${datasetId}`;
    }
    return pathname.endsWith(`/${itemId}`) || pathname.includes(`/${itemId}/`);
  };

  return  (
  <nav className="sticky top-0 z-30 bg-white border-b border-gray-100">
    <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={`/datasets/${datasetId}${item.href}`}
          className={cn(
            "flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors",
            isActive(item.id)
              ? "bg-brand/10 text-brand"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  </nav>
);
}
