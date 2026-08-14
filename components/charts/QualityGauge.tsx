"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { QualityScore } from "@/types";
import { cn } from "@/lib/utils";

function scoreColor(score: number) {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  return "Poor";
}

function DimBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold" style={{ color: scoreColor(value) }}>
          {value.toFixed(0)}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: scoreColor(value) }}
        />
      </div>
    </div>
  );
}

export function QualityGauge({ data }: { data: QualityScore }) {
  const color = scoreColor(data.overall);
  const chartData = [{ value: data.overall, fill: color }];

  return (
    <div className="flex flex-col md:flex-row gap-6 items-center">
      {/* Radial gauge */}
      <div className="relative w-48 h-48 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="90%"
            startAngle={180}
            endAngle={-180}
            data={chartData}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "#f3f4f6" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {data.overall.toFixed(0)}
          </span>
          <span className="text-xs font-medium" style={{ color }}>
            {scoreLabel(data.overall)}
          </span>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="flex-1 space-y-3 w-full">
        <DimBar label="Completeness" value={data.completeness} />
        <DimBar label="Consistency" value={data.consistency} />
        <DimBar label="Uniqueness" value={data.uniqueness} />
      </div>
    </div>
  );
}
