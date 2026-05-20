"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

interface HypothesisCard {
  title: string;
  hypothesis: string;
  evidence: string;
  category: string;
  confidence: "high" | "medium" | "low";
  severity: "info" | "warning" | "danger";
  columns: string[];
}

const SEV_BORDER: Record<string, string> = {
  danger:  "border-l-red-400",
  warning: "border-l-amber-400",
  info:    "border-l-blue-400",
};

const SEV_LABEL: Record<string, string> = {
  danger:  "text-red-600",
  warning: "text-amber-600",
  info:    "text-blue-500",
};

const CONF_COLOR: Record<string, string> = {
  high:   "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low:    "bg-gray-100 text-gray-500",
};

function HypCard({ card }: { card: HypothesisCard }) {
  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${SEV_BORDER[card.severity]} rounded-xl p-4`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{card.title}</p>
        <span className={`flex-shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${CONF_COLOR[card.confidence]}`}>
          {card.confidence}
        </span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed mb-3">{card.hypothesis}</p>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${SEV_LABEL[card.severity]}`}>{card.category}</span>
          <span className="text-gray-200">·</span>
          <code className="text-[11px] text-gray-500 font-mono bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
            {card.evidence}
          </code>
        </div>
        {card.columns.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {card.columns.slice(0, 4).map((col) => (
              <span key={col} className="text-[11px] font-mono text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                {col}
              </span>
            ))}
            {card.columns.length > 4 && (
              <span className="text-[11px] text-gray-400">+{card.columns.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HypothesesPage() {
  const params = useParams();
  const datasetId = params.datasetId as string;

  const { data: dataset } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["hypotheses", datasetId],
    queryFn: () =>
      datasetsApi.getHypotheses(datasetId).then(
        (r) => r.data as { hypotheses: HypothesisCard[]; source: string; count: number }
      ),
    enabled: false,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const hypotheses = data?.hypotheses ?? [];
  const isRunning = isLoading || isFetching;

  const danger  = hypotheses.filter((h) => h.severity === "danger").length;
  const warning = hypotheses.filter((h) => h.severity === "warning").length;

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-5xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Hypotheses" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between mt-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hypotheses</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              AI-generated findings from your EDA results
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-[#2a0d8a] disabled:opacity-50 transition"
          >
            {isRunning ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
            ) : data ? (
              <><RefreshCw className="w-3.5 h-3.5" /> Refresh</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Generate</>
            )}
          </button>
        </div>

        {/* Summary strip — only after results */}
        {data && !isRunning && (
          <div className="flex items-center gap-3 mb-5 text-xs text-gray-500">
            <span><strong className="text-gray-900">{data.count}</strong> finding{data.count !== 1 ? "s" : ""}</span>
            <span className="text-gray-200">|</span>
            <span>{data.source === "ai" ? "AI-generated" : "Rule-based"}</span>
            {danger > 0 && (
              <>
                <span className="text-gray-200">|</span>
                <span className="text-red-600 font-medium">{danger} critical</span>
              </>
            )}
            {warning > 0 && (
              <>
                <span className="text-gray-200">|</span>
                <span className="text-amber-600 font-medium">{warning} warning{warning > 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        )}

        {/* Idle */}
        {!data && !isRunning && !isError && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p className="text-sm text-gray-400">
              Click <strong className="text-gray-600">Generate</strong> to analyse correlations, distributions,
              outliers and feature importance for insights.
            </p>
          </div>
        )}

        {/* Loading */}
        {isRunning && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 flex items-center justify-center gap-3 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analysing dataset…
          </div>
        )}

        {/* Error */}
        {isError && !isRunning && (
          <div className="bg-white border border-red-200 rounded-xl p-6 text-center">
            <p className="text-sm text-red-600">Could not generate hypotheses. Make sure the dataset has been profiled.</p>
          </div>
        )}

        {/* Cards */}
        {hypotheses.length > 0 && !isRunning && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {hypotheses.map((card, idx) => (
              <HypCard key={idx} card={card} />
            ))}
          </div>
        )}

        {data && hypotheses.length === 0 && !isRunning && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p className="text-sm text-gray-400">No significant patterns found. Try running correlations or outlier detection first.</p>
          </div>
        )}
      </div>
    </>
  );
}
