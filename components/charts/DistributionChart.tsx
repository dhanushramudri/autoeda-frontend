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
  ReferenceLine,
} from "recharts";
import type { DistributionResult } from "@/types";

interface Props {
  data: DistributionResult;
  column: string;
}

export function DistributionChart({ data, column }: Props) {
  const { histogram, kde, box } = data;

  const chartData = histogram.bins.map((bin, i) => ({
    bin: bin.toFixed(2),
    count: histogram.counts[i],
    density: kde?.y[Math.round((i / histogram.bins.length) * (kde.x.length - 1))] ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* Histogram + KDE */}
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
            {kde && <Line dataKey="density" type="monotone" stroke="#f59e0b" dot={false} strokeWidth={2} yAxisId={0} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Box plot stats */}
      {box && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Min", value: box.min },
            { label: "Q1", value: box.q1 },
            { label: "Median", value: box.median },
            { label: "Q3", value: box.q3 },
            { label: "Max", value: box.max },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-gray-800">
                {typeof value === "number" ? value.toFixed(3) : value ?? "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Normality test */}
      {data.normality_test && (
        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-4 text-xs">
          <span className="text-gray-500">
            Normality ({data.normality_test.test}):
          </span>
          <span className="font-mono text-gray-700">
            p = {data.normality_test.p_value?.toFixed(4) ?? "—"}
          </span>
          <span
            className={
              data.normality_test.is_normal
                ? "text-emerald-600 font-medium"
                : "text-amber-600 font-medium"
            }
          >
            {data.normality_test.is_normal ? "Normal" : "Non-normal"}
          </span>
        </div>
      )}
    </div>
  );
}
