"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { workspacesExtraApi, workspacesApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { AlertTriangle, TrendingDown, ChevronRight, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";
import { format } from "date-fns";
import type { WorkspaceAnalytics, DatasetSummary, TrendPoint } from "@/types";

const QUAL_COLOR = (score: number | null) =>
  score == null ? "#94a3b8" : score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

export default function WorkspaceAnalyticsPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: workspace } = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspacesApi.get(workspaceId).then((r) => r.data),
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: queryKeys.analytics.workspace(workspaceId),
    queryFn: () => workspacesExtraApi.getAnalytics(workspaceId).then((r) => r.data as WorkspaceAnalytics),
    enabled: !!workspaceId,
  });

  const datasets = analytics?.datasets ?? [];
  const trends = analytics?.trends ?? [];

  const barData = datasets.map((d) => ({
    name: d.name.length > 14 ? d.name.slice(0, 14) + "..." : d.name,
    quality: d.quality_score ?? 0,
    fill: QUAL_COLOR(d.quality_score),
  }));

  // Group trends by dataset
  const trendDatasets = [...new Set(trends.map((t) => t.dataset_name))];
  const trendMap: Record<string, Record<string, number>> = {};
  trends.forEach((t) => {
    const dateKey = format(new Date(t.run_at), "MMM d");
    if (!trendMap[dateKey]) trendMap[dateKey] = {};
    trendMap[dateKey][t.dataset_name] = t.quality_score;
  });
  const trendChartData = Object.entries(trendMap).map(([date, vals]) => ({ date, ...vals }));

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Breadcrumb items={[
        { label: "Workspaces", href: "/workspaces" },
        { label: workspace?.name ?? "...", href: `/workspaces/${workspaceId}/datasets` },
        { label: "Analytics" },
      ]} />

      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">Workspace Analytics</h1>

      {isLoading && <PageSpinner />}

      {!isLoading && (
        <>
          {/* Callout cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {analytics?.worst_quality && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Worst Quality Dataset</p>
                  <p className="text-lg font-bold text-red-700 mt-0.5">{analytics.worst_quality.name}</p>
                  <p className="text-xs text-red-600">Quality score: {analytics.worst_quality.quality_score ?? "N/A"}/100</p>
                  <button
                    onClick={() => router.push(`/datasets/${analytics!.worst_quality!.id}`)}
                    className="mt-2 text-xs text-red-700 underline flex items-center gap-0.5"
                  >
                    View dataset <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
            {analytics?.most_missing && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <TrendingDown className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Most Missing Data</p>
                  <p className="text-lg font-bold text-amber-700 mt-0.5">{analytics.most_missing.name}</p>
                  <p className="text-xs text-amber-600">
                    {analytics.most_missing.missing_pct != null ? `${analytics.most_missing.missing_pct.toFixed(1)}% missing` : "No data"}
                  </p>
                  <button
                    onClick={() => router.push(`/datasets/${analytics!.most_missing!.id}/missing`)}
                    className="mt-2 text-xs text-amber-700 underline flex items-center gap-0.5"
                  >
                    View missing analysis <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quality scores bar chart */}
          {barData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Quality Scores by Dataset</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 30, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [`${v}/100`, "Quality"]} />
                  <Bar dataKey="quality" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, idx) => (
                      <Bar key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quality trend over time */}
          {trendChartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Quality Score Trends</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {trendDatasets.map((ds, i) => (
                    <Line key={ds} type="monotone" dataKey={ds} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Datasets table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">All Datasets</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Dataset</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Rows</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Columns</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Missing %</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Quality</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Last EDA Run</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr key={ds.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/datasets/${ds.id}`)}>
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium text-gray-800">{ds.name}</p>
                      <p className="text-xs text-gray-400">{ds.status}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-600">{ds.row_count?.toLocaleString() ?? " -- "}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-600">{ds.column_count ?? " -- "}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-600">
                      {ds.missing_pct != null ? `${ds.missing_pct.toFixed(1)}%` : " -- "}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-bold" style={{ color: QUAL_COLOR(ds.quality_score) }}>
                        {ds.quality_score ?? " -- "}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {ds.last_eda_run ? format(new Date(ds.last_eda_run), "MMM d, yyyy") : "Never"}
                    </td>
                    <td className="px-4 py-2.5">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {datasets.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No datasets in this workspace yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
