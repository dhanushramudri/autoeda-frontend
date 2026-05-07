import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";
import type { InsightCard as InsightCardType } from "@/types";

const severityConfig = {
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon_color: "text-blue-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    icon_color: "text-amber-500",
  },
  danger: {
    icon: AlertTriangle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon_color: "text-red-500",
  },
  critical: {
    icon: AlertTriangle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon_color: "text-red-500",
  },
  success: {
    icon: CheckCircle,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    icon_color: "text-emerald-500",
  },
};

export function InsightCard({ insight }: { insight: InsightCardType }) {
  const cfg =
    severityConfig[insight.severity as keyof typeof severityConfig] ?? severityConfig.info;
  const Icon = cfg.icon;

  return (
    <div className={cn("rounded-lg border p-3.5 flex gap-3", cfg.bg, cfg.border)}>
      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", cfg.icon_color)} />
      <div className="min-w-0">
        {insight.chart_type && (
          <p className={cn("text-[10px] font-semibold uppercase tracking-wide mb-0.5 opacity-60", cfg.text)}>
            {insight.chart_type}
          </p>
        )}
        <p className={cn("text-xs leading-relaxed", cfg.text)}>{insight.insight}</p>
      </div>
    </div>
  );
}

export function InsightList({ insights }: { insights: InsightCardType[] }) {
  if (!insights || !insights.length) return null;
  return (
    <div className="space-y-2">
      {insights.map((ins, i) => (
        <InsightCard key={i} insight={ins} />
      ))}
    </div>
  );
}
