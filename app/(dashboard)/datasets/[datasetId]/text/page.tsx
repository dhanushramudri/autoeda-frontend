"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";
import { Type } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function TextAnalysisPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  const textCols = profile?.columns
    .filter((c: { semantic_type: string }) =>
      ["text", "categorical"].includes(c.semantic_type)
    )
    .map((c: { name: string }) => c.name) ?? [];

  const activeCol = searchParams.get("column") ?? textCols[0] ?? "";

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.eda.text(datasetId, activeCol),
    queryFn: () => datasetsApi.getText(datasetId, activeCol).then((r) => r.data),
    enabled: !!activeCol,
  });

  const setCol = (col: string) => {
    router.replace(`/datasets/${datasetId}/text?column=${encodeURIComponent(col)}`);
  };

  const wordData = data?.word_frequency
    ? Object.entries(data.word_frequency)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 20)
        .map(([word, count]) => ({ word, count: Number(count) }))
    : [];

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Text Analysis" },
          ]}
        />

        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Text Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Word frequency, n-grams, sentiment, and language detection
          </p>
        </div>

        {textCols.length === 0 ? (
          <EmptyState
            icon={<Type className="w-12 h-12" />}
            title="No text columns"
            description="This dataset has no text or categorical columns to analyze."
          />
        ) : (
          <div className="flex gap-6">
            {/* Column list */}
            <div className="w-48 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Columns
              </p>
              <div className="space-y-0.5">
                {textCols.map((col: string) => (
                  <button
                    key={col}
                    onClick={() => setCol(col)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition truncate ${
                      col === activeCol
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                    title={col}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div className="flex-1 space-y-6">
              {isLoading ? (
                <PageSpinner />
              ) : data ? (
                <>
                  {/* Sentiment */}
                  {data.sentiment && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Sentiment Distribution</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Positive", value: data.sentiment.positive, color: "text-emerald-600" },
                          { label: "Neutral", value: data.sentiment.neutral, color: "text-gray-500" },
                          { label: "Negative", value: data.sentiment.negative, color: "text-red-500" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="text-center bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">{label}</p>
                            <p className={`text-xl font-bold ${color}`}>
                              {((value ?? 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                      {data.sentiment.avg_compound != null && (
                        <p className="text-xs text-gray-400 mt-2">
                          Avg compound score: {data.sentiment.avg_compound.toFixed(3)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Word frequency */}
                  {wordData.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Top 20 Words</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={wordData}
                          layout="vertical"
                          margin={{ top: 4, right: 40, bottom: 4, left: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis type="category" dataKey="word" tick={{ fontSize: 10 }} tickLine={false} width={75} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Bigrams */}
                  {data.bigrams && data.bigrams.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Bigrams</h3>
                      <div className="flex flex-wrap gap-2">
                        {data.bigrams.slice(0, 20).map(([phrase, count]: [string, number]) => (
                          <span
                            key={phrase}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                          >
                            {phrase} <span className="opacity-60">({count})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  {data.stats && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Text Statistics</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {Object.entries(data.stats).map(([key, val]) => (
                          <div key={key} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-400 mb-0.5">{key.replace(/_/g, " ")}</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {typeof val === "number" ? val.toFixed(2) : String(val)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
