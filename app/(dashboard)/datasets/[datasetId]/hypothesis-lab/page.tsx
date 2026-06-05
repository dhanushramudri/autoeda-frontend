"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  TrendingUp,
  FlaskConical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Sparkles,
  Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureImportance {
  feature: string;
  importance: number;
}

interface MutualInfo {
  feature: string;
  score: number;
}

interface CorrelationEntry {
  feature: string;
  correlation: number;
}

interface FeatureMeta {
  feature: string;
  rf_importance: number;
  mi_score: number;
  correlation: number;
  recommendation: "keep_strong" | "keep" | "consider_drop" | "drop";
  missing_pct: number;
}

interface FIData {
  target: string;
  problem_type: string;
  model_score: number;
  n_samples: number;
  n_features: number;
  top_features: string[];
  drop_candidates: string[];
  importances: FeatureImportance[];
  mutual_info: MutualInfo[];
  correlations: CorrelationEntry[];
  leakage_suspects: string[];
  redundant_groups: string[][];
  warnings: string[];
  feature_meta: FeatureMeta[];
}

type AssumptionStatus = "pending" | "validating" | "supported" | "refuted" | "inconclusive";
type Confidence = "high" | "medium" | "low";

interface FeatureResult {
  feature: string;
  rank: number;
  meta: FeatureMeta;
  verdict: string;
  confidence: Confidence;
  status: AssumptionStatus;
  evidence: string;
  suggestion: string | null;
}

interface Synthesis {
  features: FeatureResult[];
  primaryStatus: AssumptionStatus;
  overallConfidence: Confidence;
}

interface Assumption {
  id: string;
  text: string;
  status: AssumptionStatus;
  confidence: Confidence | null;
  synthesis: Synthesis | null;
}

// ── Mock data (replace with real API calls) ───────────────────────────────────

const MOCK_FI: FIData = {
  target: "churn",
  problem_type: "classification",
  model_score: 0.847,
  n_samples: 12400,
  n_features: 14,
  top_features: ["support_tickets", "days_since_login", "plan_tier", "total_spend", "age"],
  drop_candidates: ["referral_code", "signup_source"],
  importances: [
    { feature: "support_tickets",  importance: 0.241 },
    { feature: "days_since_login", importance: 0.198 },
    { feature: "plan_tier",        importance: 0.154 },
    { feature: "total_spend",      importance: 0.121 },
    { feature: "age",              importance: 0.089 },
    { feature: "contract_length",  importance: 0.072 },
    { feature: "num_logins",       importance: 0.058 },
    { feature: "region",           importance: 0.031 },
    { feature: "referral_code",    importance: 0.021 },
    { feature: "signup_source",    importance: 0.015 },
  ],
  mutual_info: [
    { feature: "support_tickets",  score: 0.312 },
    { feature: "days_since_login", score: 0.267 },
    { feature: "plan_tier",        score: 0.198 },
    { feature: "total_spend",      score: 0.145 },
    { feature: "age",              score: 0.093 },
  ],
  correlations: [
    { feature: "support_tickets",  correlation: 0.68 },
    { feature: "days_since_login", correlation: -0.59 },
    { feature: "total_spend",      correlation: -0.44 },
    { feature: "age",              correlation: 0.21 },
    { feature: "region",           correlation: 0.08 },
  ],
  leakage_suspects: [],
  redundant_groups: [],
  warnings: [],
  feature_meta: [
    { feature: "support_tickets",  rf_importance: 0.241, mi_score: 0.312, correlation: 0.68,  recommendation: "keep_strong",   missing_pct: 0 },
    { feature: "days_since_login", rf_importance: 0.198, mi_score: 0.267, correlation: -0.59, recommendation: "keep_strong",   missing_pct: 2.1 },
    { feature: "plan_tier",        rf_importance: 0.154, mi_score: 0.198, correlation: 0.31,  recommendation: "keep_strong",   missing_pct: 0 },
    { feature: "total_spend",      rf_importance: 0.121, mi_score: 0.145, correlation: -0.44, recommendation: "keep",          missing_pct: 0 },
    { feature: "age",              rf_importance: 0.089, mi_score: 0.093, correlation: 0.21,  recommendation: "keep",          missing_pct: 5.3 },
    { feature: "contract_length",  rf_importance: 0.072, mi_score: 0.071, correlation: -0.28, recommendation: "keep",          missing_pct: 0 },
    { feature: "num_logins",       rf_importance: 0.058, mi_score: 0.062, correlation: -0.22, recommendation: "keep",          missing_pct: 0 },
    { feature: "region",           rf_importance: 0.031, mi_score: 0.029, correlation: 0.08,  recommendation: "consider_drop", missing_pct: 0 },
    { feature: "referral_code",    rf_importance: 0.021, mi_score: 0.018, correlation: 0.04,  recommendation: "drop",          missing_pct: 41 },
    { feature: "signup_source",    rf_importance: 0.015, mi_score: 0.012, correlation: 0.03,  recommendation: "drop",          missing_pct: 0 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRank(feature: string, fiData: FIData): number | null {
  const idx = fiData.importances.findIndex((i) => i.feature === feature);
  return idx >= 0 ? idx + 1 : null;
}

function getFIMeta(feature: string, fiData: FIData): FeatureMeta | null {
  return fiData.feature_meta.find((f) => f.feature === feature) ?? null;
}

function extractAnyFeatureMentions(text: string, fiData: FIData): string[] {
  const cols = fiData.feature_meta.map((f) => f.feature);
  const words = text.toLowerCase().split(/\W+/);
  return cols.filter((col) => {
    const parts = col.toLowerCase().split("_");
    return parts.some((p) => words.includes(p)) || words.includes(col.toLowerCase());
  });
}

function synthesize(hypothesis: string, fiData: FIData): Synthesis | null {
  const mentioned = extractAnyFeatureMentions(hypothesis, fiData);
  if (!mentioned.length) return null;

  const results: FeatureResult[] = mentioned
    .map((feat): FeatureResult | null => {
      const meta = getFIMeta(feat, fiData);
      const rank = getRank(feat, fiData);
      const n = fiData.feature_meta.length;
      if (!meta || rank === null) return null;

      const { rf_importance: rfImp, mi_score: miScore, correlation: corr, recommendation: rec } = meta;

      let verdict: string, confidence: Confidence, status: AssumptionStatus, evidence: string, suggestion: string | null;

      if (rec === "keep_strong") {
        verdict = `Strong agreement — ${feat} is ranked #${rank} of ${n} features (RF: ${rfImp.toFixed(3)}, MI: ${miScore.toFixed(3)}). Your hypothesis is well-supported by the data.`;
        confidence = "high";
        status = "supported";
        evidence = `RF importance: ${rfImp.toFixed(3)} · MI score: ${miScore.toFixed(3)} · Correlation with target: ${corr.toFixed(3)} · Rank: #${rank}/${n}`;
        suggestion = null;
      } else if (rec === "keep") {
        verdict = `Moderate support — ${feat} ranks #${rank}/${n} with some predictive signal (RF: ${rfImp.toFixed(3)}). Your hypothesis has partial data backing.`;
        confidence = "medium";
        status = "supported";
        evidence = `RF importance: ${rfImp.toFixed(3)} · MI score: ${miScore.toFixed(3)} · Rank: #${rank}/${n}`;
        suggestion = `Consider pairing ${feat} with a stronger predictor like ${fiData.top_features[0]}.`;
      } else if (rec === "consider_drop") {
        verdict = `Weak signal — ${feat} ranks #${rank}/${n} and scores low on all methods. The data only partially supports this hypothesis.`;
        confidence = "low";
        status = "inconclusive";
        evidence = `RF importance: ${rfImp.toFixed(3)} · MI score: ${miScore.toFixed(3)} · Rank: #${rank}/${n}`;
        suggestion = `The top predictor for ${fiData.target} is actually ${fiData.top_features[0]} (RF: ${fiData.importances[0].importance.toFixed(3)}). Re-examine your assumption.`;
      } else {
        verdict = `Refuted — ${feat} ranks last (#${rank}/${n}) and contributes near-zero predictive value. The data does not support this feature being important.`;
        confidence = "low";
        status = "refuted";
        evidence = `RF importance: ${rfImp.toFixed(3)} · MI score: ${miScore.toFixed(3)} · Rank: #${rank}/${n} (bottom)`;
        suggestion = `Consider dropping ${feat} and focusing on ${fiData.top_features.slice(0, 2).join(", ")} instead.`;
      }

      return { feature: feat, rank, meta, verdict, confidence, status, evidence, suggestion };
    })
    .filter((r): r is FeatureResult => r !== null);

  if (!results.length) return null;

  const primaryStatus: AssumptionStatus = results.some((r) => r.status === "supported")
    ? "supported"
    : results.some((r) => r.status === "refuted")
    ? "refuted"
    : "inconclusive";

  const overallConfidence: Confidence = results.some((r) => r.confidence === "high")
    ? "high"
    : results.some((r) => r.confidence === "medium")
    ? "medium"
    : "low";

  return { features: results, primaryStatus, overallConfidence };
}

function surpriseScore(assumptions: Assumption[]): number | null {
  const validated = assumptions.filter(
    (a) => a.status === "supported" || a.status === "refuted"
  );
  if (!validated.length) return null;
  const refuted = validated.filter((a) => a.status === "refuted").length;
  return Math.round((refuted / validated.length) * 100);
}

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  AssumptionStatus,
  { icon: React.ReactNode; borderCls: string; label: string; textCls: string; bgCls: string }
> = {
  pending: {
    icon: <FlaskConical className="w-3.5 h-3.5 text-gray-400" />,
    borderCls: "border-gray-200",
    bgCls: "bg-gray-50",
    label: "Pending",
    textCls: "text-gray-500",
  },
  validating: {
    icon: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
    borderCls: "border-blue-200",
    bgCls: "bg-blue-50",
    label: "Validating…",
    textCls: "text-blue-600",
  },
  supported: {
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    borderCls: "border-emerald-200",
    bgCls: "bg-emerald-50",
    label: "Supported",
    textCls: "text-emerald-700",
  },
  refuted: {
    icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,
    borderCls: "border-red-200",
    bgCls: "bg-red-50",
    label: "Refuted",
    textCls: "text-red-700",
  },
  inconclusive: {
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
    borderCls: "border-amber-200",
    bgCls: "bg-amber-50",
    label: "Inconclusive",
    textCls: "text-amber-700",
  },
};

const CONF_COLOR: Record<Confidence, string> = {
  high:   "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low:    "bg-gray-100 text-gray-500",
};

const REC_BADGE: Record<FeatureMeta["recommendation"], { label: string; cls: string }> = {
  keep_strong:   { label: "Strong",  cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  keep:          { label: "Keep",    cls: "bg-blue-50 text-blue-700 border-blue-100" },
  consider_drop: { label: "Weak",    cls: "bg-amber-50 text-amber-700 border-amber-100" },
  drop:          { label: "Drop",    cls: "bg-red-50 text-red-700 border-red-100" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniBar({ value, max, colorCls }: { value: number; max: number; colorCls: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorCls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-gray-400">{value.toFixed(3)}</span>
    </div>
  );
}

function FeatureEvidence({ result, maxRF }: { result: FeatureResult; maxRF: number }) {
  const rec = REC_BADGE[result.meta.recommendation];
  return (
    <div className="bg-white border border-gray-100 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium text-gray-800">{result.feature}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400">rank #{result.rank}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${rec.cls}`}>
            {rec.label}
          </span>
        </div>
      </div>
      <MiniBar value={result.meta.rf_importance} max={maxRF} colorCls="bg-blue-400" />
      {result.suggestion && (
        <p className="text-[11px] text-gray-500 leading-relaxed border-t border-gray-100 pt-2 flex items-start gap-1">
          <Lightbulb className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
          {result.suggestion}
        </p>
      )}
    </div>
  );
}

function AssumptionCard({
  assumption,
  onRemove,
  onValidate,
  fiData,
}: {
  assumption: Assumption;
  onRemove: (id: string) => void;
  onValidate: (id: string) => void;
  fiData: FIData;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[assumption.status];
  const maxRF = Math.max(...fiData.importances.map((i) => i.importance), 0.001);
  const hasDetails =
    !!assumption.synthesis &&
    assumption.status !== "pending" &&
    assumption.status !== "validating";

  return (
    <div className={`border rounded-xl p-4 transition-all ${cfg.bgCls} ${cfg.borderCls}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-snug">{assumption.text}</p>

          {hasDetails && expanded && assumption.synthesis && (
            <div className="mt-3 space-y-2">
              {assumption.synthesis.features.map((r) => (
                <FeatureEvidence key={r.feature} result={r} maxRF={maxRF} />
              ))}
              {assumption.synthesis.features[0] && (
                <p className={`text-xs leading-relaxed ${cfg.textCls}`}>
                  {assumption.synthesis.features[0].verdict}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[11px] font-semibold ${cfg.textCls}`}>{cfg.label}</span>
            {assumption.confidence && (
              <>
                <span className="text-gray-200">·</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${CONF_COLOR[assumption.confidence]}`}>
                  {assumption.confidence} confidence
                </span>
              </>
            )}
            {assumption.synthesis?.features?.length ? (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-[11px] text-gray-400">
                  {assumption.synthesis.features.length} feature
                  {assumption.synthesis.features.length > 1 ? "s" : ""} matched
                </span>
              </>
            ) : null}
            {hasDetails && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 ml-auto"
              >
                {expanded ? (
                  <><ChevronUp className="w-3 h-3" />Hide</>
                ) : (
                  <><ChevronDown className="w-3 h-3" />Evidence</>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {assumption.status === "pending" && (
            <button
              onClick={() => onValidate(assumption.id)}
              className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-violet-400 hover:text-violet-600 transition"
            >
              Validate
            </button>
          )}
          <button
            onClick={() => onRemove(assumption.id)}
            className="p-1 text-gray-300 hover:text-gray-500 transition rounded"
            aria-label="Remove"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SurprisePanel({ score }: { score: number | null }) {
  if (score === null) return null;

  const { colorCls, label, desc } =
    score >= 60
      ? {
          colorCls: "text-red-600",
          label: "High surprise",
          desc: "The data diverges significantly from your assumptions. Excellent opportunity to discover new patterns.",
        }
      : score >= 30
      ? {
          colorCls: "text-amber-600",
          label: "Moderate surprise",
          desc: "Some assumptions are off. Investigate the refuted ones — the data may be revealing something non-obvious.",
        }
      : {
          colorCls: "text-emerald-600",
          label: "Well-calibrated",
          desc: "Your domain knowledge aligns well with the data. High confidence in your feature intuitions.",
        };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <div className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-gray-100 flex items-center justify-center">
        <span className={`text-lg font-bold ${colorCls}`}>{score}%</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">
          Surprise score ·{" "}
          <span className={colorCls}>{label}</span>
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mt-0.5 max-w-md">{desc}</p>
      </div>
    </div>
  );
}

function UnhypothesizedFeatures({
  assumptions,
  fiData,
}: {
  assumptions: Assumption[];
  fiData: FIData;
}) {
  const mentionedFeatures = useMemo(() => {
    const all = new Set<string>();
    assumptions.forEach((a) => extractAnyFeatureMentions(a.text, fiData).forEach((f) => all.add(f)));
    return all;
  }, [assumptions, fiData]);

  const unmentioned = fiData.top_features.filter((f) => !mentionedFeatures.has(f));
  if (!unmentioned.length || assumptions.length < 2) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
      <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-blue-800">
          {unmentioned.length} strong predictor{unmentioned.length > 1 ? "s" : ""} you haven't hypothesized about
        </p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {unmentioned.slice(0, 4).map((f) => {
            const rank = getRank(f, fiData);
            const imp = fiData.importances.find((i) => i.feature === f)?.importance ?? 0;
            return (
              <div
                key={f}
                className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-md px-2 py-1"
              >
                <span className="text-[10px] text-gray-400">#{rank}</span>
                <span className="font-mono text-[11px] text-gray-800">{f}</span>
                <span className="text-[10px] text-blue-500">RF {imp.toFixed(3)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-blue-600 mt-1.5">
          Was this intentional? These might represent patterns worth investigating.
        </p>
      </div>
    </div>
  );
}

function PipelineTracker({ assumptions }: { assumptions: Assumption[] }) {
  const stages = [
    { label: "Added",     icon: <FlaskConical className="w-4 h-4 text-gray-400" />, count: assumptions.length },
    { label: "Tested",    icon: <Zap className="w-4 h-4 text-blue-400" />,          count: assumptions.filter((a) => ["supported", "refuted", "inconclusive"].includes(a.status)).length },
    { label: "Supported", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, count: assumptions.filter((a) => a.status === "supported").length },
    { label: "Refuted",   icon: <XCircle className="w-4 h-4 text-red-500" />,       count: assumptions.filter((a) => a.status === "refuted").length },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stages.map((s) => (
        <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
          <div className="flex justify-center mb-1.5">{s.icon}</div>
          <p className="text-xl font-bold text-gray-900">{s.count}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function FIOverviewStrip({ fiData }: { fiData: FIData }) {
  const maxRF = Math.max(...fiData.importances.map((i) => i.importance), 0.001);

  const BAR_COLORS = [
    "bg-blue-500", "bg-blue-400", "bg-indigo-400", "bg-violet-400",
    "bg-purple-400", "bg-fuchsia-400", "bg-pink-400", "bg-rose-400",
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">
            Feature importance —{" "}
            <span className="font-mono text-blue-600">{fiData.target}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
            {fiData.problem_type}
          </span>
          <span className="text-[11px] text-gray-400">
            OOB {(fiData.model_score * 100).toFixed(1)}% · {fiData.n_samples.toLocaleString()} rows
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {fiData.importances.slice(0, 8).map((item, i) => {
          const rec = fiData.feature_meta.find((f) => f.feature === item.feature)?.recommendation ?? "keep";
          const recBadge = REC_BADGE[rec];
          const pct = (item.importance / maxRF) * 100;
          return (
            <div key={item.feature} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[10px] text-gray-300 w-4 text-right font-mono flex-shrink-0">{i + 1}</span>
              <span className="font-mono text-xs text-gray-700 w-36 flex-shrink-0">{item.feature}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[i] ?? "bg-blue-300"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-gray-400 w-10 text-right flex-shrink-0">
                {item.importance.toFixed(3)}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${recBadge.cls}`}>
                {recBadge.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sample hypotheses ─────────────────────────────────────────────────────────

const SAMPLE_HYPOTHESES = [
  "Users with more support tickets are more likely to churn",
  "High total spend customers have lower churn risk",
  "Referral code strongly predicts long-term retention",
];

// ── Main Component ────────────────────────────────────────────────────────────

type ActiveTab = "lab" | "features";

export default function HypothesisLab() {
  const fiData = MOCK_FI;
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("lab");
  const [isValidatingAll, setIsValidatingAll] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addAssumption = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setAssumptions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, status: "pending", confidence: null, synthesis: null },
    ]);
    setInputText("");
    textareaRef.current?.focus();
  }, [inputText]);

  const removeAssumption = useCallback((id: string) => {
    setAssumptions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const validateOne = useCallback(
    async (id: string) => {
      const assumption = assumptions.find((a) => a.id === id);
      if (!assumption) return;

      setAssumptions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "validating" as const } : a))
      );

      await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));

      const synthesis = synthesize(assumption.text, fiData);
      const status: AssumptionStatus = synthesis?.primaryStatus ?? "inconclusive";
      const confidence: Confidence = synthesis?.overallConfidence ?? "low";

      setAssumptions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status, confidence, synthesis } : a))
      );
    },
    [assumptions, fiData]
  );

  const validateAll = useCallback(async () => {
    const pending = assumptions.filter((a) => a.status === "pending");
    if (!pending.length) return;
    setIsValidatingAll(true);
    for (const a of pending) await validateOne(a.id);
    setIsValidatingAll(false);
  }, [assumptions, validateOne]);

  const addSample = (text: string) => {
    setInputText(text);
    textareaRef.current?.focus();
  };

  const surprise = surpriseScore(assumptions);
  const pendingCount = assumptions.filter((a) => a.status === "pending").length;
  const supportedCount = assumptions.filter((a) => a.status === "supported").length;
  const refutedCount = assumptions.filter((a) => a.status === "refuted").length;

  const TABS: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "lab",      label: "Hypothesis lab",    icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { key: "features", label: "Feature importance", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <FlaskConical className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-bold text-gray-900">Hypothesis lab</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-500">
            target: {fiData.target}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Enter your assumptions — we'll cross-reference them against feature importance,
          correlations, and statistical scores automatically.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Lab Tab ── */}
      {activeTab === "lab" && (
        <div className="space-y-4">
          <PipelineTracker assumptions={assumptions} />

          <SurprisePanel score={surprise} />

          {/* Input */}
          <div className="bg-white border border-gray-300 rounded-xl p-4 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-50 transition-all">
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
              placeholder="e.g. Support tickets heavily predict churn · High spend customers stay longer · Age doesn't matter for retention"
              rows={2}
              className="w-full text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none leading-relaxed bg-transparent"
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 flex-wrap gap-2">
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
                      <><Sparkles className="w-3 h-3" />Validate all ({pendingCount})</>
                    )}
                  </button>
                )}
                <button
                  onClick={addAssumption}
                  disabled={!inputText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:border-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              <span className="text-[11px] text-gray-400">Enter to add · Shift+Enter for newline</span>
            </div>

            {/* Sample prompts */}
            {assumptions.length === 0 && (
              <div className="mt-3 flex gap-1.5 flex-wrap">
                <span className="text-[11px] text-gray-400">Try:</span>
                {SAMPLE_HYPOTHESES.map((h) => (
                  <button
                    key={h}
                    onClick={() => addSample(h)}
                    title={h}
                    className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 bg-gray-50 hover:border-gray-400 hover:text-gray-700 transition max-w-[200px] truncate"
                  >
                    {h.length > 40 ? h.slice(0, 40) + "…" : h}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary strip */}
          {assumptions.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
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

          {/* Unhypothesized features alert */}
          <UnhypothesizedFeatures assumptions={assumptions} fiData={fiData} />

          {/* Assumption cards */}
          {assumptions.length > 0 ? (
            <div className="space-y-2">
              {assumptions.map((a) => (
                <AssumptionCard
                  key={a.id}
                  assumption={a}
                  onRemove={removeAssumption}
                  onValidate={validateOne}
                  fiData={fiData}
                />
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <FlaskConical className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No assumptions yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Add one above — the system will cross-reference it against feature importance automatically.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Features Tab ── */}
      {activeTab === "features" && (
        <div className="space-y-4">
          <FIOverviewStrip fiData={fiData} />

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Model accuracy",    value: `${(fiData.model_score * 100).toFixed(1)}%`, icon: <Zap className="w-3.5 h-3.5 text-emerald-500" /> },
              { label: "Features analysed", value: fiData.n_features,                           icon: <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> },
              { label: "Drop candidates",   value: fiData.drop_candidates.length,               icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {s.icon}
                  <span className="text-[11px] text-gray-400">{s.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {fiData.drop_candidates.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700">
                  {fiData.drop_candidates.length} feature{fiData.drop_candidates.length > 1 ? "s" : ""} score near-zero on all methods
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {fiData.drop_candidates.map((f) => (
                  <span
                    key={f}
                    className="font-mono text-[11px] px-2 py-1 rounded-lg bg-white border border-amber-200 text-amber-700"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}