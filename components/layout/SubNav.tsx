"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SubNavProps {
  datasetId: string;
}

const NAV_ITEMS = [
  { label: "Overview", href: "", id: "overview" },
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
];

export function SubNav({ datasetId }: SubNavProps) {
  const pathname = usePathname();

  const isActive = (itemId: string): boolean => {
    if (itemId === "overview") {
      return pathname === `/datasets/${datasetId}`;
    }
    return pathname.endsWith(`/${itemId}`) || pathname.includes(`/${itemId}/`);
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="flex overflow-x-auto scrollbar-hide">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={`/datasets/${datasetId}${item.href}`}
            className={cn(
              "flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
              isActive(item.id)
                ? "border-b-2 border-blue-600 text-blue-600"
                : "border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
