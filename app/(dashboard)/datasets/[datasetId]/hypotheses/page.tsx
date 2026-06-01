"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { datasetsApi } from "@/lib/api";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  Loader2, RefreshCw, Sparkles, Plus, X, CheckCircle2,
  XCircle, AlertTriangle, FlaskConical, ChevronDown,
  ChevronUp, Send, Lightbulb, Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HypothesisCard {
  title: string;
  hypothesis: string;
  evidence: string;
  category: string;
  confidence: "high" | "medium" | "low";
  severity: "info" | "warning" | "danger";
  columns: string[];
}

interface UserAssumption {
  id: string;
  text: string;
  status: "pending" | "validating" | "supported" | "refuted" | "inconclusive";
  verdict?: string;
  evidence?: string;
  confidence?: "high" | "medium" | "low";
  columns?: string[];
}

// ── Style maps ────────────────────────────────────────────────────────────────

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
const STATUS_CFG = {
  pending:      { icon: <FlaskConical className="w-3.5 h-3.5 text-gray-400" />,    cls: "bg-gray-50 border-gray-200",    label: "Pending",      text: "text-gray-500" },
  validating:   { icon: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />, cls: "bg-blue-50 border-blue-200", label: "Validating…", text: "text-blue-600" },
  supported:    { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />, cls: "bg-emerald-50 border-emerald-200", label: "Supported",  text: "text-emerald-700" },
  refuted:      { icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,          cls: "bg-red-50 border-red-200",       label: "Refuted",      text: "text-red-700" },
  inconclusive: { icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,  cls: "bg-amber-50 border-amber-200",   label: "Inconclusive", text: "text-amber-700" },
};

// ── Validate assumption via backend API (secure, no API key exposure) ────────

async function validateAssumptionWithBackend(
  datasetId: string,
  assumption: string,
  source: string = "user"
): Promise<Omit<UserAssumption, "id" | "text">> {
  const response = await datasetsApi.validateAssumption(datasetId, assumption, source);
  const data = response.data;

  return {
    verdict: data.verdict ?? "Could not determine.",
    evidence: data.evidence ?? "—",
    confidence: data.confidence ?? "low",
    status: data.status ?? "inconclusive",
    columns: data.columns ?? [],
  };
}

// ── HypCard ───────────────────────────────────────────────────────────────────

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

// ── AssumptionCard ────────────────────────────────────────────────────────────

function AssumptionCard({
  assumption,
  onRemove,
  onValidate,
}: {
  assumption: UserAssumption;
  onRemove: (id: string) => void;
  onValidate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[assumption.status];

  return (
    <div className={`border rounded-xl p-4 transition-all ${cfg.cls}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-snug">{assumption.text}</p>

          {/* Verdict (expanded) */}
          {assumption.verdict && expanded && (
            <div className="mt-3 space-y-2">
              <p className={`text-xs leading-relaxed ${cfg.text}`}>{assumption.verdict}</p>
              {assumption.evidence && (
                <code className="text-[11px] font-mono text-gray-500 bg-white border border-gray-100 px-1.5 py-0.5 rounded">
                  {assumption.evidence}
                </code>
              )}
              {assumption.columns && assumption.columns.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {assumption.columns.map((col) => (
                    <span key={col} className="text-[11px] font-mono text-gray-400 bg-white border border-gray-100 px-1.5 py-0.5 rounded">
                      {col}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
            {assumption.confidence && (
              <>
                <span className="text-gray-200">·</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${CONF_COLOR[assumption.confidence]}`}>
                  {assumption.confidence} confidence
                </span>
              </>
            )}
            {assumption.verdict && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 ml-auto"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" />Hide</> : <><ChevronDown className="w-3 h-3" />Details</>}
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {assumption.status === "pending" && (
            <button
              onClick={() => onValidate(assumption.id)}
              className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition"
            >
              Validate
            </button>
          )}
          <button
            onClick={() => onRemove(assumption.id)}
            className="p-1 text-gray-300 hover:text-gray-500 transition rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HypothesesPage() {
  const params = useParams();
  const datasetId = params.datasetId as string;

  // ── Assumption state
  const [assumptions, setAssumptions] = useState<UserAssumption[]>([]);
  const [inputText, setInputText] = useState("");
  const [isValidatingAll, setIsValidatingAll] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Dataset
  const { data: dataset } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  // ── EDA data for validation context
  const { data: profile } = useQuery({
    queryKey: ["profile", datasetId],
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });
  const { data: correlations } = useQuery({
    queryKey: ["correlations", datasetId],
    queryFn: () => datasetsApi.getCorrelations(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });
  const { data: outliers } = useQuery({
    queryKey: ["outliers", datasetId],
    queryFn: () => datasetsApi.getOutliers(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  // ── AI hypotheses
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

  // ── Handlers
  const addAssumption = () => {
    const text = inputText.trim();
    if (!text) return;
    setAssumptions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, status: "pending" },
    ]);
    setInputText("");
    textareaRef.current?.focus();
  };

  const removeAssumption = (id: string) => {
    setAssumptions((prev) => prev.filter((a) => a.id !== id));
  };

  const validateOne = async (id: string) => {
    const assumption = assumptions.find((a) => a.id === id);
    if (!assumption) return;

    setAssumptions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "validating" } : a))
    );

    try {
      const result = await validateAssumptionWithBackend(
        datasetId,
        assumption.text,
        "user"
      );
      setAssumptions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...result } : a))
      );
    } catch {
      setAssumptions((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: "inconclusive", verdict: "Validation failed — check that EDA data has been computed.", evidence: "error", confidence: "low", columns: [] }
            : a
        )
      );
    }
  };

  const validateAll = async () => {
    const pending = assumptions.filter((a) => a.status === "pending");
    if (!pending.length) return;
    setIsValidatingAll(true);
    for (const a of pending) {
      await validateOne(a.id);
    }
    setIsValidatingAll(false);
  };

  const pendingCount = assumptions.filter((a) => a.status === "pending").length;
  const supportedCount = assumptions.filter((a) => a.status === "supported").length;
  const refutedCount = assumptions.filter((a) => a.status === "refuted").length;

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

        {/* ── Section 1: Validate Your Assumptions ── */}
        <div className="mt-6 mb-10">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-violet-500" />
            <h2 className="text-base font-bold text-gray-900">Validate Your Assumptions</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Enter hypotheses from business context, client KT sessions, or your own intuition — we'll validate them against the data.
          </p>

          {/* Input */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addAssumption();
                }
              }}
              placeholder="e.g. High-value customers tend to churn less · Price and total_amount are correlated · Orders spike on weekends"
              rows={2}
              className="w-full text-sm text-gray-700 placeholder-gray-300 resize-none focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <p className="text-[11px] text-gray-300">Press Enter or click Add to queue your assumption</p>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <button
                    onClick={validateAll}
                    disabled={isValidatingAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition"
                  >
                    {isValidatingAll ? (
                      <><Loader2 className="w-3 h-3 animate-spin" />Validating {pendingCount}…</>
                    ) : (
                      <><Sparkles className="w-3 h-3" />Validate All ({pendingCount})</>
                    )}
                  </button>
                )}
                <button
                  onClick={addAssumption}
                  disabled={!inputText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 disabled:opacity-40 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Summary strip */}
          {assumptions.length > 0 && (
            <div className="flex items-center gap-3 mb-3 text-xs text-gray-400">
              <span><strong className="text-gray-700">{assumptions.length}</strong> assumption{assumptions.length !== 1 ? "s" : ""}</span>
              {supportedCount > 0 && (
                <><span className="text-gray-200">|</span><span className="text-emerald-600 font-medium">{supportedCount} supported</span></>
              )}
              {refutedCount > 0 && (
                <><span className="text-gray-200">|</span><span className="text-red-600 font-medium">{refutedCount} refuted</span></>
              )}
              {pendingCount > 0 && (
                <><span className="text-gray-200">|</span><span className="text-gray-500">{pendingCount} pending</span></>
              )}
            </div>
          )}

          {/* Assumption cards */}
          {assumptions.length > 0 ? (
            <div className="space-y-2">
              {assumptions.map((a) => (
                <AssumptionCard
                  key={a.id}
                  assumption={a}
                  onRemove={removeAssumption}
                  onValidate={validateOne}
                />
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <FlaskConical className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">
                No assumptions yet. Add one above to get started.
              </p>
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[11px] font-medium text-gray-300 uppercase tracking-widest">AI-Generated Findings</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* ── Section 2: AI Hypothesis Generator ── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-gray-900">Hypothesis Generator</h2>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
            >
              {isRunning ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analysing…</>
              ) : data ? (
                <><RefreshCw className="w-3.5 h-3.5" />Refresh</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" />Generate</>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">AI-generated findings from correlations, distributions, outliers, and feature importance.</p>

          {data && !isRunning && (
            <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
              <span><strong className="text-gray-900">{data.count}</strong> finding{data.count !== 1 ? "s" : ""}</span>
              <span className="text-gray-200">|</span>
              <span>{data.source === "ai" ? "AI-generated" : "Rule-based"}</span>
              {danger > 0 && (
                <><span className="text-gray-200">|</span><span className="text-red-600 font-medium">{danger} critical</span></>
              )}
              {warning > 0 && (
                <><span className="text-gray-200">|</span><span className="text-amber-600 font-medium">{warning} warning{warning > 1 ? "s" : ""}</span></>
              )}
            </div>
          )}

          {!data && !isRunning && !isError && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <p className="text-sm text-gray-400">
                Click <strong className="text-gray-600">Generate</strong> to analyse correlations, distributions,
                outliers and feature importance for insights.
              </p>
            </div>
          )}

          {isRunning && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 flex items-center justify-center gap-3 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analysing dataset…
            </div>
          )}

          {isError && !isRunning && (
            <div className="bg-white border border-red-200 rounded-xl p-6 text-center">
              <p className="text-sm text-red-600">Could not generate hypotheses. Make sure the dataset has been profiled.</p>
            </div>
          )}

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
      </div>
    </>
  );
}