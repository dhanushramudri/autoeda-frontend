"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import type { TimeSeriesResult } from "@/types";

interface Props {
  data: TimeSeriesResult;
  timeCol: string;
  valueCol: string;
}

export function TimeSeriesChart({ data, timeCol, valueCol }: Props) {
  const chartData = data.values.map((v, i) => ({
    t: data.index[i],
    value: v,
    isAnomaly: data.anomalies?.includes(i),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          {valueCol} over {timeCol}
        </h4>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 9 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={1.5}
            />
            {/* Anomaly dots */}
            {chartData
              .filter((d) => d.isAnomaly)
              .map((d, i) => (
                <ReferenceDot
                  key={i}
                  x={d.t}
                  y={d.value}
                  r={4}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={1.5}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
        {data.anomalies && data.anomalies.length > 0 && (
          <p className="text-xs text-red-500 mt-1">
            {data.anomalies.length} anomalies detected (red dots)
          </p>
        )}
      </div>

      {/* Rolling stats */}
      {data.rolling_mean && data.rolling_mean.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Rolling Mean (window=7)</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={data.rolling_mean.map((v, i) => ({ t: data.index[i + 6], value: v }))}
              margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="t" tick={{ fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="value" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ADF test */}
      {data.stationarity && (
        <div className="bg-gray-50 rounded-lg p-3 text-xs flex items-center gap-6">
          <span className="text-gray-500">ADF Stationarity:</span>
          <span className="font-mono text-gray-700">
            stat = {data.stationarity.adf_statistic?.toFixed(4) ?? "—"}
          </span>
          <span className="font-mono text-gray-700">
            p = {data.stationarity.p_value?.toFixed(4) ?? "—"}
          </span>
          <span
            className={
              data.stationarity.is_stationary
                ? "text-emerald-600 font-medium"
                : "text-amber-600 font-medium"
            }
          >
            {data.stationarity.is_stationary ? "Stationary" : "Non-stationary"}
          </span>
        </div>
      )}
    </div>
  );
}
