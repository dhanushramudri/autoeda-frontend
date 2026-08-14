"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";
import { WordCloud } from "@/components/charts/WordCloud";
import { cn } from "@/lib/utils";
import { Type, AlertTriangle, XCircle, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";


interface TextResult {
  column: string;
  total_rows: number;
  total_texts: number;
  missing_count: number;
  missing_pct: number;
  empty_count: number;
  empty_pct: number;
  duplicate_count: number;
  duplicate_pct: number;
  top_duplicates: Array<{ text: string; count: number }>;
  avg_length: number;
  median_length: number;
  avg_char_length: number;
  median_char_length: number;
  min_char_length: number;
  max_char_length: number;
  vocabulary_size: number;
  type_token_ratio: number;
  word_freq: Array<{ word: string; count: number }>;
  tfidf_keywords: Array<{ word: string; score: number }>;
  bigrams: Array<{ ngram: string; count: number }>;
  trigrams: Array<{ ngram: string; count: number }>;
  sentiment_dist: { positive: number; negative: number; neutral: number };
  language: string;
  length_distribution: { bins: number[]; counts: number[] };
  char_length_distribution: { bins: number[]; counts: number[] };
  quality_flags: {
    outlier_short_count: number; outlier_short_pct: number;
    outlier_long_count: number; outlier_long_pct: number;
    all_caps_count: number; all_caps_pct: number;
    numeric_only_count: number; numeric_only_pct: number;
    avg_special_char_ratio: number;
  };
  pii: {
    emails: { count: number; unique_count: number; samples: string[] };
    urls: { count: number; unique_count: number; samples: string[] };
    phone_numbers: { count: number; unique_count: number; samples: string[] };
  };
  insights: Array<{ type: string; level: "info" | "warning" | "danger"; message: string }>;
  sampled: boolean;
  sample_size: number | null;
  error?: string | null;
}


const LEVEL_CFG = {
  danger: { cls: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800", icon: <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" /> },
  warning: { cls: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800", icon: <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" /> },
  info: { cls: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800", icon: <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" /> },
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold truncate" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function HBarChart({ data, dataKey, nameKey, color, height = 280 }: {
  data: Array<Record<string, unknown>>; dataKey: string; nameKey: string; color: string; height?: number;
}) {
  if (data.length === 0) return <p className="text-xs text-muted-foreground py-6 text-center">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 90 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
        <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 10, fontFamily: "monospace" }} tickLine={false} width={85} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function HistogramChart({ bins, counts, color }: { bins: number[]; counts: number[]; height?: number; color: string }) {
  if (!bins?.length || !counts?.length) return <p className="text-xs text-muted-foreground py-6 text-center">No data</p>;
  const data = counts.map((c, i) => ({
    range: `${bins[i]}–${bins[i + 1]}`,
    count: c,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="range" tick={{ fontSize: 9 }} tickLine={false} interval={Math.ceil(data.length / 8)} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function NgramChips({ items, color }: { items: Array<{ ngram: string; count: number }>; color: string }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">None found</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 20).map((item) => (
        <span key={item.ngram} className={cn("px-2.5 py-1 rounded-full text-xs font-medium", color)}>
          {item.ngram} <span className="opacity-60">({item.count})</span>
        </span>
      ))}
    </div>
  );
}


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

  const textCols: string[] = profile?.columns
    .filter((c: { semantic_type: string }) => ["text", "categorical"].includes(c.semantic_type))
    .map((c: { name: string }) => c.name) ?? [];

  const activeCol = searchParams.get("column") ?? textCols[0] ?? "";

  const { data: rawData, isLoading } = useQuery<TextResult>({
    queryKey: queryKeys.eda.text(datasetId, activeCol),
    queryFn: () => datasetsApi.getText(datasetId, activeCol).then((r) => r.data),
    enabled: !!activeCol,
  });

  const data: TextResult | undefined = rawData && {
    ...rawData,
    total_rows: rawData.total_rows ?? rawData.total_texts ?? 0,
    missing_count: rawData.missing_count ?? 0,
    missing_pct: rawData.missing_pct ?? 0,
    empty_count: rawData.empty_count ?? 0,
    empty_pct: rawData.empty_pct ?? 0,
    duplicate_count: rawData.duplicate_count ?? 0,
    duplicate_pct: rawData.duplicate_pct ?? 0,
    top_duplicates: rawData.top_duplicates ?? [],
    avg_char_length: rawData.avg_char_length ?? 0,
    median_char_length: rawData.median_char_length ?? 0,
    min_char_length: rawData.min_char_length ?? 0,
    max_char_length: rawData.max_char_length ?? 0,
    vocabulary_size: rawData.vocabulary_size ?? 0,
    type_token_ratio: rawData.type_token_ratio ?? 0,
    tfidf_keywords: rawData.tfidf_keywords ?? [],
    word_freq: rawData.word_freq ?? [],
    bigrams: rawData.bigrams ?? [],
    trigrams: rawData.trigrams ?? [],
    length_distribution: rawData.length_distribution ?? { bins: [], counts: [] },
    char_length_distribution: rawData.char_length_distribution ?? { bins: [], counts: [] },
    quality_flags: rawData.quality_flags ?? {
      outlier_short_count: 0, outlier_short_pct: 0,
      outlier_long_count: 0, outlier_long_pct: 0,
      all_caps_count: 0, all_caps_pct: 0,
      numeric_only_count: 0, numeric_only_pct: 0,
      avg_special_char_ratio: 0,
    },
    pii: rawData.pii ?? {
      emails: { count: 0, unique_count: 0, samples: [] },
      urls: { count: 0, unique_count: 0, samples: [] },
      phone_numbers: { count: 0, unique_count: 0, samples: [] },
    },
    insights: rawData.insights ?? [],
    sampled: rawData.sampled ?? false,
    sample_size: rawData.sample_size ?? null,
  };

  const setCol = (col: string) => {
    router.replace(`/datasets/${datasetId}/text?column=${encodeURIComponent(col)}`);
  };


  const sd = data?.sentiment_dist;
  const sentimentTotal = sd ? (sd.positive + sd.negative + sd.neutral) || 1 : 1;
  const hasPii = data?.pii && (data.pii.emails.count > 0 || data.pii.urls.count > 0 || data.pii.phone_numbers.count > 0);

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
          <h1 className="text-2xl font-bold text-foreground">Text Analysis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vocabulary, n-grams, sentiment, data quality, and PII detection
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Columns</p>
              <div className="space-y-0.5">
                {textCols.map((col) => (
                  <button
                    key={col}
                    onClick={() => setCol(col)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs transition truncate",
                      col === activeCol ? "bg-blue-50 dark:bg-blue-950/40 text-brand font-semibold" : "text-muted-foreground hover:bg-muted"
                    )}
                    title={col}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div className="flex-1 space-y-6 min-w-0">
              {isLoading ? (
                <PageSpinner />
              ) : !data || data.total_texts === 0 ? (
                <EmptyState
                  icon={<Type className="w-12 h-12" />}
                  title="No data"
                  description={data?.error ?? `No usable values found in '${activeCol}'.`}
                />
              ) : (
                <>
                  {data.sampled && (
                    <p className="text-[10px] text-muted-foreground">
                      Word/sentiment/keyword stats computed from a random sample of {data.sample_size?.toLocaleString()} rows
                      (out of {data.total_texts.toLocaleString()}) for performance. Row-count stats (missing, empty, duplicates) reflect the full column.
                    </p>
                  )}

                  {/* Insights */}
                  {data.insights.length > 0 && (
                    <div className="space-y-2">
                      {data.insights.map((ins, i) => {
                        const cfg = LEVEL_CFG[ins.level];
                        return (
                          <div key={i} className={cn("rounded-xl p-3 border flex gap-2.5", cfg.cls)}>
                            {cfg.icon}
                            <p className="text-xs leading-relaxed">{ins.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Core stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Total Rows" value={data.total_rows.toLocaleString()} sub={`${data.total_texts.toLocaleString()} non-null`} />
                    <StatCard label="Missing" value={`${data.missing_pct}%`} sub={`${data.missing_count.toLocaleString()} rows`} color={data.missing_pct > 20 ? "#DC2626" : undefined} />
                    <StatCard label="Empty / Blank" value={`${data.empty_pct}%`} sub={`${data.empty_count.toLocaleString()} rows`} color={data.empty_pct > 10 ? "#D97706" : undefined} />
                    <StatCard label="Duplicates" value={`${data.duplicate_pct}%`} sub={`${data.duplicate_count.toLocaleString()} rows`} color={data.duplicate_pct > 30 ? "#D97706" : undefined} />
                    <StatCard label="Vocabulary Size" value={data.vocabulary_size.toLocaleString()} sub="unique words" />
                    <StatCard label="Type-Token Ratio" value={data.type_token_ratio} sub="vocab / total words" />
                    <StatCard label="Avg Length" value={`${data.avg_length} words`} sub={`median ${data.median_length}`} />
                    <StatCard label="Char Length" value={`${data.avg_char_length} avg`} sub={`min ${data.min_char_length} · max ${data.max_char_length}`} />
                  </div>

                  {/* PII */}
                  {hasPii && (
                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                        <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Possible PII Detected</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {([
                          ["Emails", data.pii.emails],
                          ["URLs", data.pii.urls],
                          ["Phone Numbers", data.pii.phone_numbers],
                        ] as const).map(([label, stat]) => (
                          <div key={label} className="bg-card rounded-lg p-3 border border-red-100 dark:border-red-800/40">
                            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                            <p className="text-base font-bold text-red-700 dark:text-red-400">{stat.count.toLocaleString()}</p>
                            {stat.samples.length > 0 && (
                              <p className="text-[10px] text-muted-foreground font-mono truncate mt-1" title={stat.samples.join(", ")}>
                                e.g. {stat.samples[0]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sentiment */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Sentiment Distribution</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        ["Positive", sd?.positive ?? 0, "text-emerald-600 dark:text-emerald-400"],
                        ["Neutral", sd?.neutral ?? 0, "text-muted-foreground"],
                        ["Negative", sd?.negative ?? 0, "text-red-500 dark:text-red-400"],
                      ] as const).map(([label, value, color]) => (
                        <div key={label} className="text-center bg-muted rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className={cn("text-xl font-bold", color)}>{((value / sentimentTotal) * 100).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">{value.toLocaleString()} texts</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Word cloud + top words */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Word Cloud</h3>
                      {data.word_freq.length > 0 ? (
                        <WordCloud
                          words={data.word_freq.map((w) => ({ text: w.word, value: w.count }))}
                          width={500}
                          height={260}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground py-10 text-center">No words found</p>
                      )}
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Top 20 Words (by frequency)</h3>
                      <HBarChart
                        data={[...data.word_freq].sort((a, b) => b.count - a.count).slice(0, 20)}
                        dataKey="count" nameKey="word" color="#3b82f6"
                      />
                    </div>
                  </div>

                  {/* TF-IDF keywords */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-foreground">TF-IDF Keywords</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Down-weights generic words — different signal than raw frequency above</p>
                    <HBarChart
                      data={data.tfidf_keywords.slice(0, 20)}
                      dataKey="score" nameKey="word" color="#7C3AED"
                    />
                  </div>

                  {/* Bigrams + Trigrams */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Top Bigrams</h3>
                      <NgramChips items={data.bigrams} color="bg-blue-50 dark:bg-blue-950/40 text-brand" />
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Top Trigrams</h3>
                      <NgramChips items={data.trigrams} color="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400" />
                    </div>
                  </div>

                  {/* Length distributions */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Word-Length Distribution</h3>
                      <HistogramChart bins={data.length_distribution.bins} counts={data.length_distribution.counts} color="#0891B2" />
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Character-Length Distribution</h3>
                      <HistogramChart bins={data.char_length_distribution.bins} counts={data.char_length_distribution.counts} color="#059669" />
                    </div>
                  </div>

                  {/* Quality flags + duplicates */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Quality Flags</h3>
                      <div className="space-y-2 text-xs">
                        {[
                          ["Outlier-short values", data.quality_flags.outlier_short_count, data.quality_flags.outlier_short_pct],
                          ["Outlier-long values", data.quality_flags.outlier_long_count, data.quality_flags.outlier_long_pct],
                          ["ALL-CAPS values", data.quality_flags.all_caps_count, data.quality_flags.all_caps_pct],
                          ["Numeric-only values", data.quality_flags.numeric_only_count, data.quality_flags.numeric_only_pct],
                        ].map(([label, count, pct]) => (
                          <div key={label as string} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-mono font-semibold text-foreground">
                              {(count as number).toLocaleString()} <span className="text-muted-foreground">({pct}%)</span>
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-muted-foreground">Avg special-char ratio</span>
                          <span className="font-mono font-semibold text-foreground">{data.quality_flags.avg_special_char_ratio}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Most Repeated Values</h3>
                      {data.top_duplicates.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No duplicate values found.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {data.top_duplicates.map((d, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-b-0">
                              <span className="text-xs text-muted-foreground truncate font-mono" title={d.text}>{d.text}</span>
                              <span className="text-[10px] font-bold text-muted-foreground flex-shrink-0">×{d.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Language */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-1">Detected Language</h3>
                    <p className="text-base font-mono text-foreground">{data.language}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
