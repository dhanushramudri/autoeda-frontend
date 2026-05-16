"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { MissingResult } from "@/types";
import { AskAiButton } from "@/components/ai/AskAiButton";

interface Props {
  data: MissingResult;
}

export function MissingHeatmap({ data }: Props) {
  const chartData = (data.columns ?? [])
    .filter((col: { name: string; count: number; pct: number }) => col.count > 0)
    .map((col: { name: string; count: number; pct: number }) => ({
      column: col.name,
      pct: col.pct,
      count: col.count,
    }))
    .sort((a, b) => b.pct - a.pct);

  if (chartData.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-emerald-600 font-medium">
        No missing values found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <AskAiButton
          question="Looking at the missing value chart, which columns should I drop vs impute? What strategy do you recommend?"
          label="How to fix missing values"
          variant="chip"
        />
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 28)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 60, bottom: 4, left: 100 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="column"
            tick={{ fontSize: 10 }}
            tickLine={false}
            width={95}
          />
          <Tooltip
            formatter={(v: number, _: string, entry) => [
              `${v.toFixed(1)}% (${(entry.payload as { count: number }).count} rows)`,
              "Missing",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {chartData.map((entry) => (
              <Cell
                key={entry.column}
                fill={
                  entry.pct > 50
                    ? "#ef4444"
                    : entry.pct > 20
                    ? "#f59e0b"
                    : "#3b82f6"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
