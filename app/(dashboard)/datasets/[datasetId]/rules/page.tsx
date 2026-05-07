"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Plus, Trash2, Play, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { QualityRule, RuleResult, RuleType, ColumnProfile } from "@/types";

const RULE_TYPES: { value: RuleType; label: string; description: string }[] = [
  { value: "not_null", label: "Not Null", description: "Column must have no missing values" },
  { value: "range", label: "Numeric Range", description: "Values must be between min and max" },
  { value: "regex", label: "Regex Pattern", description: "Values must match a regex pattern" },
  { value: "unique", label: "Unique Values", description: "All values must be unique" },
  { value: "allowed_values", label: "Allowed Values", description: "Values must be in an allowed list" },
];

export default function RulesPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const qc = useQueryClient();
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [addingRule, setAddingRule] = useState(false);
  const [draft, setDraft] = useState<Partial<QualityRule & { min?: string; max?: string; pattern?: string; values?: string }>>({});

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
    enabled: !!datasetId,
  });

  const columns: ColumnProfile[] = profile?.columns ?? [];

  const { data: results, isLoading: resultsLoading, refetch } = useQuery({
    queryKey: queryKeys.rules.results(datasetId),
    queryFn: () => datasetsApi.getRuleResults(datasetId).then((r) => r.data as { rules: RuleResult[]; pass_rate: number }),
    enabled: false,
  });

  const saveMutation = useMutation({
    mutationFn: () => datasetsApi.saveRules(datasetId, rules),
    onSuccess: () => refetch(),
  });

  const addRule = () => {
    if (!draft.rule_type) return;
    const params: Record<string, unknown> = {};
    if (draft.rule_type === "range") {
      if (draft.min !== undefined) params.min = Number(draft.min);
      if (draft.max !== undefined) params.max = Number(draft.max);
    } else if (draft.rule_type === "regex") {
      params.pattern = draft.pattern ?? "";
    } else if (draft.rule_type === "allowed_values") {
      params.values = (draft.values ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    }
    setRules((prev) => [...prev, {
      column_name: draft.column_name ?? null,
      rule_type: draft.rule_type as RuleType,
      params,
    }]);
    setAddingRule(false);
    setDraft({});
  };

  const passRatePct = results ? Math.round(results.pass_rate * 100) : null;
  const passColor = passRatePct == null ? "text-gray-500" : passRatePct >= 90 ? "text-emerald-600" : passRatePct >= 70 ? "text-amber-600" : "text-red-600";

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Data Quality Rules</h1>
            <p className="text-sm text-gray-500 mt-0.5">Define custom rules and validate your data against them.</p>
          </div>
          {passRatePct != null && (
            <div className="text-center">
              <div className={`text-3xl font-bold ${passColor}`}>{passRatePct}%</div>
              <p className="text-xs text-gray-400">Overall Pass Rate</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Rule builder */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Rules ({rules.length})</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setAddingRule(true)}
                  className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {rules.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No rules defined yet. Click Add to create one.</p>
              )}
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-start justify-between bg-gray-50 rounded-lg p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">{RULE_TYPES.find((r) => r.value === rule.rule_type)?.label}</p>
                    {rule.column_name && <p className="text-xs text-gray-400 truncate">{rule.column_name}</p>}
                  </div>
                  <button onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400 ml-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {addingRule && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                  value={draft.rule_type ?? ""}
                  onChange={(e) => setDraft({ rule_type: e.target.value as RuleType })}
                >
                  <option value="">Rule type…</option>
                  {RULE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {draft.rule_type && draft.rule_type !== "unique" && draft.rule_type !== "allowed_values" && (
                  <select
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                    value={draft.column_name ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, column_name: e.target.value }))}
                  >
                    <option value="">Column…</option>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                )}
                {draft.rule_type === "unique" && (
                  <select
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                    value={draft.column_name ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, column_name: e.target.value }))}
                  >
                    <option value="">Column…</option>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                )}
                {draft.rule_type === "range" && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <input className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none" placeholder="Min" value={draft.min ?? ""} onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))} />
                    <input className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none" placeholder="Max" value={draft.max ?? ""} onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))} />
                  </div>
                )}
                {draft.rule_type === "regex" && (
                  <input className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none font-mono" placeholder="Regex pattern" value={draft.pattern ?? ""} onChange={(e) => setDraft((d) => ({ ...d, pattern: e.target.value }))} />
                )}
                {draft.rule_type === "allowed_values" && (
                  <>
                    <select
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                      value={draft.column_name ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, column_name: e.target.value }))}
                    >
                      <option value="">Column…</option>
                      {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none" placeholder="Values (comma-separated)" value={draft.values ?? ""} onChange={(e) => setDraft((d) => ({ ...d, values: e.target.value }))} />
                  </>
                )}
                <div className="flex gap-1.5">
                  <button onClick={addRule} disabled={!draft.rule_type} className="flex-1 text-xs bg-blue-600 text-white rounded-lg py-1.5 disabled:opacity-40">Add</button>
                  <button onClick={() => { setAddingRule(false); setDraft({}); }} className="text-xs border border-gray-200 rounded-lg py-1.5 px-2">✕</button>
                </div>
              </div>
            )}

            <button
              onClick={() => saveMutation.mutate()}
              disabled={rules.length === 0 || saveMutation.isPending}
              className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-blue-700 transition"
            >
              <Play className="w-3.5 h-3.5" />
              {saveMutation.isPending ? "Running…" : "Save & Validate"}
            </button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-3">
            {resultsLoading && <PageSpinner />}
            {results?.rules.map((r, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {r.fail_count === 0
                        ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                        : r.fail_pct > 20 ? <XCircle className="w-4 h-4 text-red-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                      <span className="text-sm font-medium text-gray-800">{r.label}</span>
                    </div>
                    {r.column && <p className="text-xs text-gray-400 mt-0.5 ml-6">{r.column}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${r.pass_pct >= 90 ? "text-emerald-600" : r.pass_pct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                      {r.pass_pct.toFixed(1)}%
                    </span>
                    <p className="text-xs text-gray-400">pass rate</p>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full ${r.pass_pct >= 90 ? "bg-emerald-500" : r.pass_pct >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${r.pass_pct}%` }}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{r.fail_count.toLocaleString()} failures</span>
                  <span>{r.fail_pct.toFixed(1)}% fail rate</span>
                </div>
                {r.sample_failing_rows.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-blue-600 cursor-pointer">Show sample failing rows</summary>
                    <div className="mt-2 overflow-x-auto">
                      <pre className="text-xs bg-gray-50 rounded p-2 text-gray-700">
                        {JSON.stringify(r.sample_failing_rows, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            ))}
            {results && results.rules.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
                No rules have been run yet. Add rules and click Save & Validate.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
