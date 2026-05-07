"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DistributionResult } from "@/types";

interface Props {
  data: DistributionResult;
  column: string;
}

export function DistributionChart({ data, column }: Props) {
  const { histogram, kde, box_stats, normality } = data;

  const chartData =
    histogram && histogram.bins
      ? histogram.bins.map((bin, i) => ({
          bin: bin != null ? Number(bin).toFixed(2) : String(i),
          count: histogram.counts[i] ?? 0,
          density:
            kde?.y != null
              ? (kde.y[Math.round((i / histogram.bins.length) * (kde.y.length - 1))] ?? 0)
              : 0,
        }))
      : [];

  return (
    <div className="space-y-6">
      {/* Histogram + KDE */}
      {chartData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Distribution — {column}</h4>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="bin"
                tick={{ fontSize: 10 }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, name: string) => [
                  name === "count" ? v : v.toFixed(4),
                  name === "count" ? "Count" : "Density",
                ]}
              />
              <Bar dataKey="count" fill="#3b82f6" opacity={0.7} radius={[2, 2, 0, 0]} />
              {kde && (
                <Line dataKey="density" type="monotone" stroke="#f59e0b" dot={false} strokeWidth={2} yAxisId={0} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Box plot stats */}
      {box_stats && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Min", value: box_stats.min },
            { label: "Q1", value: box_stats.q1 },
            { label: "Median", value: box_stats.median },
            { label: "Q3", value: box_stats.q3 },
            { label: "Max", value: box_stats.max },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-gray-800">
                {typeof value === "number" ? value.toFixed(3) : "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Normality test */}
      {normality && (
        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-4 text-xs">
          <span className="text-gray-500">Normality ({normality.test}):</span>
          <span className="font-mono text-gray-700">
            p = {normality.p_value?.toFixed(4) ?? "—"}
          </span>
          <span
            className={
              normality.is_normal
                ? "text-emerald-600 font-medium"
                : "text-amber-600 font-medium"
            }
          >
            {normality.is_normal ? "Normal" : "Non-normal"}
          </span>
        </div>
      )}
    </div>
  );
}
