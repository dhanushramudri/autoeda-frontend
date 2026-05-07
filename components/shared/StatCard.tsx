import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: "default" | "blue" | "green" | "amber" | "red";
  icon?: React.ReactNode;
}

const colorMap = {
  default: "bg-white border-gray-200 text-gray-900",
  blue: "bg-blue-50 border-blue-200 text-blue-900",
  green: "bg-emerald-50 border-emerald-200 text-emerald-900",
  amber: "bg-amber-50 border-amber-200 text-amber-900",
  red: "bg-red-50 border-red-200 text-red-900",
};

export function StatCard({ label, value, sub, color = "default", icon }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border p-4", colorMap[color])}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
