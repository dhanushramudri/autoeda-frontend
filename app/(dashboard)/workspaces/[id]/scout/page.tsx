"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scoutApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import type { ScoutMessage, ScoutThread, ScoutSuggestion, ScoutToolCall, ScoutConversation } from "@/types";
import {
  Compass, Send, Sparkles, Bot, Loader2, ChevronDown, ChevronUp,
  Database, Wand2, AlertCircle, ShieldAlert, Type, SearchCheck,
  Plus, Trash2, MessageSquare, Link2,
} from "lucide-react";
import { MissingHeatmap } from "@/components/charts/MissingHeatmap";
import { CorrelationHeatmap } from "@/components/charts/CorrelationHeatmap";
import { QualityGauge } from "@/components/charts/QualityGauge";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { DataTable } from "@/components/shared/DataTable";
import type { TextResult } from "@/types";

// No dedicated text-analysis chart component exists in the product yet —
// this is a compact, purpose-built summary rather than a half-fit reuse.
function TextSummary({ result }: { result: Record<string, unknown> }) {
  const r = result as unknown as TextResult;
  if (!r?.word_freq) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-2.5">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><Type className="w-3.5 h-3.5 text-gray-400" />{r.total_texts.toLocaleString()} texts</span>
        <span>avg length {Math.round(r.avg_length)}</span>
        {r.sentiment_dist && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-emerald-600">+{r.sentiment_dist.positive}</span>
            <span className="text-gray-400">·{r.sentiment_dist.neutral}</span>
            <span className="text-red-500">-{r.sentiment_dist.negative}</span>
          </span>
        )}
      </div>
      {r.word_freq.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.word_freq.slice(0, 12).map((w) => (
            <span key={w.word} className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-[11px] text-gray-600">
              {w.word} <span className="text-gray-400">{w.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RelationshipsSummary({ result }: { result: Record<string, unknown> }) {
  const rels = result.relationships as Array<{ dataset_a: string; dataset_b: string; description: string }> | undefined;
  if (!rels?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
      {rels.map((r, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <Link2 className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-gray-700">{r.dataset_a}</span>
            <span className="text-gray-400"> ↔ </span>
            <span className="font-medium text-gray-700">{r.dataset_b}</span>
            <p className="text-gray-400 mt-0.5">{r.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchColumnsSummary({ result }: { result: Record<string, unknown> }) {
  const matches = result.matches as Array<{ dataset_id: number; dataset_name: string; column: string; type: string }> | undefined;
  if (!matches) return null;
  if (!matches.length) {
    return <p className="text-xs text-gray-400 italic px-1">No matching columns found.</p>;
  }
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-1.5">
      {matches.map((m, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <SearchCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-700">{m.column}</span>
          <span className="text-gray-400">in {m.dataset_name}</span>
          <span className="ml-auto text-gray-300 font-mono">{m.type}</span>
        </div>
      ))}
    </div>
  );
}

// OutlierPlot isn't reused here on purpose: its box-plot is a pre-existing
// stub (always renders empty) and its bounds table assumes lower/upper keys
// that isolation_forest's result doesn't have. This summary is built to match
// exactly what get_outliers actually returns.
function OutlierSummary({ result }: { result: Record<string, unknown> }) {
  const columns = result.columns as Array<{ name: string; outlier_count: number; outlier_pct: number; bounds?: { lower?: number; upper?: number } }> | undefined;
  if (!columns?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-2">
      {columns.map((c) => (
        <div key={c.name} className="flex items-center gap-3">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-700 flex-1 truncate">{c.name}</span>
          <span className="text-xs text-gray-400">{c.outlier_count.toLocaleString()} rows</span>
          <span className="text-xs font-semibold text-amber-600 w-12 text-right">{c.outlier_pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function ShapSummary({ result }: { result: Record<string, unknown> }) {
  const shapValues = result.shap_values as Array<{ feature: string; mean_abs_shap?: number; importance?: number }> | undefined;
  if (!shapValues?.length) return null;
  const sorted = [...shapValues].sort((a, b) => (b.mean_abs_shap ?? b.importance ?? 0) - (a.mean_abs_shap ?? a.importance ?? 0)).slice(0, 10);
  const max = Math.max(...sorted.map((s) => s.mean_abs_shap ?? s.importance ?? 0), 1e-9);
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-2">
      {sorted.map((s) => {
        const v = s.mean_abs_shap ?? s.importance ?? 0;
        return (
          <div key={s.feature} className="flex items-center gap-2.5">
            <span className="text-xs text-gray-600 w-32 truncate flex-shrink-0">{s.feature}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, backgroundColor: "hsl(var(--primary))" }} />
            </div>
            <span className="text-[11px] text-gray-400 w-12 text-right">{v.toFixed(3)}</span>
          </div>
        );
      })}
    </div>
  );
}

function QualityRulesSummary({ result }: { result: Record<string, unknown> }) {
  const rules = result.rules as Array<{ label: string; pass_pct: number; fail_count: number }> | undefined;
  if (!rules) return null;
  if (!rules.length) return <p className="text-xs text-gray-400 italic px-1">No quality rules configured for this dataset yet.</p>;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          {r.fail_count === 0 ? (
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex-shrink-0" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-700 flex-1 truncate">{r.label}</span>
          <span className="text-xs text-gray-400">{r.fail_count.toLocaleString()} failing</span>
          <span className="text-xs font-semibold w-12 text-right" style={{ color: r.fail_count === 0 ? "#059669" : "#d97706" }}>{r.pass_pct.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

function StatTestSummary({ result }: { result: Record<string, unknown> }) {
  if (!result.test) return null;
  const p = result.p_value as number;
  const significant = p < 0.05;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700">{String(result.label ?? result.test)}</span>
        <span className={cn("ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full", significant ? "bg-violet-50 text-violet-700" : "bg-gray-50 text-gray-500")}>
          p = {p.toFixed(4)}
        </span>
      </div>
      <p className="text-xs text-gray-500">{String(result.interpretation)}</p>
    </div>
  );
}

function ActionConfirmation({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 w-fit">
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </div>
  );
}

function PythonResultSummary({ result }: { result: Record<string, unknown> }) {
  const value = result.result;
  const stdout = result.stdout as string | undefined;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
      {Array.isArray(value) && value.length > 0 && typeof value[0] === "object" ? (
        <DataTable
          columns={Object.keys(value[0] as object).map((k) => ({ key: k, label: k }))}
          data={value as Record<string, unknown>[]}
          compact
        />
      ) : (
        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
      )}
      {stdout && (
        <pre className="text-[11px] font-mono text-gray-400 border-t border-gray-100 pt-2 whitespace-pre-wrap break-all">{stdout}</pre>
      )}
    </div>
  );
}

type Mode = "agent" | "chat";

// ── Tool-result -> chart mapping ───────────────────────────────────────────────
// Reuses the same chart components the rest of the product already uses, so a
// Scout answer about outliers/correlations/missing-data renders the exact same
// visuals you'd see on the dedicated EDA pages — not a bespoke duplicate.
function ToolResultPreview({ call }: { call: ScoutToolCall }) {
  const r = call.result as Record<string, unknown>;
  if (r?.error) return null;

  switch (call.tool) {
    case "get_missing":
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <MissingHeatmap data={r as any} />
        </div>
      );
    case "get_correlations":
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-3 overflow-x-auto">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <CorrelationHeatmap data={r as any} />
        </div>
      );
    case "get_outliers":
      return <OutlierSummary result={r} />;
    case "get_quality_score":
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <QualityGauge data={r as any} />
        </div>
      );
    case "run_sql":
    case "run_workspace_sql": {
      const columns = r.columns as string[] | undefined;
      const rows = r.rows as unknown[][] | undefined;
      if (!columns?.length || !rows) return null;
      const tableData = rows.slice(0, 50).map((row) =>
        Object.fromEntries(columns.map((c, i) => [c, row[i]])) as Record<string, unknown>
      );
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-2 overflow-x-auto">
          <DataTable
            columns={columns.map((c) => ({ key: c, label: c }))}
            data={tableData}
            compact
          />
        </div>
      );
    }
    case "get_distribution": {
      const column = call.arguments.column as string;
      if (!r.histogram && !r.is_numeric) return null;
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <DistributionChart data={r as any} column={column} />
        </div>
      );
    }
    case "get_timeseries": {
      const timeCol = call.arguments.time_col as string;
      const valueCol = call.arguments.value_col as string;
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <TimeSeriesChart data={r as any} timeCol={timeCol} valueCol={valueCol} />
        </div>
      );
    }
    case "get_text_analysis":
      return <TextSummary result={r} />;
    case "search_columns":
      return <SearchColumnsSummary result={r} />;
    case "get_known_relationships":
      return <RelationshipsSummary result={r} />;
    case "get_shap_explanations":
      return <ShapSummary result={r} />;
    case "evaluate_quality_rules":
      return <QualityRulesSummary result={r} />;
    case "run_statistical_test":
      return <StatTestSummary result={r} />;
    case "run_python":
      return <PythonResultSummary result={r} />;
    case "preview_transform": {
      const preview = r.preview as Array<Record<string, unknown>> | undefined;
      if (!preview?.length) return null;
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-2 overflow-x-auto">
          <DataTable columns={Object.keys(preview[0]).map((c) => ({ key: c, label: c }))} data={preview} compact />
        </div>
      );
    }
    case "add_quality_rule":
      return <ActionConfirmation icon={ShieldAlert} label="Quality rule added" />;
    case "save_chart":
      return <ActionConfirmation icon={Sparkles} label={`Chart "${String(r.name ?? "")}" saved`} />;
    case "create_segment":
      return <ActionConfirmation icon={Plus} label={`Segment "${String(r.name ?? "")}" saved`} />;
    case "list_datasets": {
      const datasets = r.datasets as Array<Record<string, unknown>> | undefined;
      if (!datasets?.length) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {datasets.map((d) => (
            <span key={String(d.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
              <Database className="w-3 h-3" />
              {String(d.name)}
              <span className="text-gray-400">· {String(d.row_count ?? "?")} rows</span>
            </span>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

function ToolTrace({ trace }: { trace: ScoutToolCall[] }) {
  const [open, setOpen] = useState(false);
  if (!trace.length) return null;

  const previews = trace.filter((t) => !("error" in (t.result || {})));
  const errors = trace.filter((t) => "error" in (t.result || {}));

  return (
    <div className="mt-2.5 space-y-2.5">
      {previews.map((t, i) => <ToolResultPreview key={i} call={t} />)}

      {errors.map((t, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span><strong>{t.tool}</strong>: {String((t.result as Record<string, unknown>)?.error)}</span>
        </div>
      ))}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {trace.length} tool {trace.length === 1 ? "call" : "calls"} used
      </button>

      {open && (
        <div className="space-y-1.5 pl-1">
          {trace.map((t, i) => (
            <div key={i} className="text-[11px] font-mono text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
              <span className="text-violet-500">{t.tool}</span>
              <span className="text-gray-400">({JSON.stringify(t.arguments)})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ScoutMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
          <Compass className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
        </div>
      )}
      <div className={cn("max-w-[78%] min-w-0", isUser && "order-first ml-auto")}>
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed",
            isUser
              ? "text-white rounded-br-md"
              : "bg-gray-50 text-gray-800 rounded-bl-md border border-gray-100"
          )}
          style={isUser ? { backgroundColor: "hsl(var(--primary))" } : undefined}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          ) : (
            <span className="scout-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          )}
        </div>
        {!isUser && msg.tool_trace?.length > 0 && <ToolTrace trace={msg.tool_trace} />}
      </div>
    </div>
  );
}

interface StreamingToolCall {
  tool: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
}

interface StreamState {
  tools: StreamingToolCall[];
  answer: string;
}

function StreamingBubble({ state, mode }: { state: StreamState; mode: Mode }) {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
        <Compass className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
      </div>
      <div className="max-w-[78%] min-w-0 space-y-2.5">
        {!state.answer && state.tools.length === 0 && (
          <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-50 border border-gray-100 flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {mode === "agent" ? "Scout is investigating…" : "Scout is thinking…"}
          </div>
        )}
        {state.tools.map((t, i) =>
          t.result ? (
            <ToolResultPreview key={i} call={t as ScoutToolCall} />
          ) : (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-400 px-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running {t.tool}…
            </div>
          )
        )}
        {state.answer && (
          <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-50 text-gray-800 border border-gray-100 text-[13.5px] leading-relaxed">
            <span className="scout-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(state.answer) }} />
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRail({
  workspaceId, activeId, onSelect,
}: {
  workspaceId: string;
  activeId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const qc = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: queryKeys.scout.conversations(workspaceId),
    queryFn: () => scoutApi.listConversations(workspaceId).then((r) => r.data as ScoutConversation[]),
  });

  const createMutation = useMutation({
    mutationFn: () => scoutApi.createConversation(workspaceId).then((r) => r.data as ScoutConversation),
    onSuccess: (convo) => {
      qc.invalidateQueries({ queryKey: queryKeys.scout.conversations(workspaceId) });
      onSelect(convo.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scoutApi.deleteConversation(workspaceId, id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.scout.conversations(workspaceId) });
      if (id === activeId) onSelect(null);
    },
  });

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-100 flex flex-col bg-gray-50/50">
      <div className="p-2.5">
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "hsl(var(--primary))" }}
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
        {conversations?.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "w-full group flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition",
              c.id === activeId ? "bg-white shadow-sm" : "hover:bg-white/70"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs truncate", c.id === activeId ? "text-gray-900 font-medium" : "text-gray-600")}>{c.title}</p>
              <p className="text-[10px] text-gray-400">{formatDistanceToNowStrict(new Date(c.updated_at), { addSuffix: true })}</p>
            </div>
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-gray-100 text-gray-300 hover:text-red-400 transition flex-shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </span>
          </button>
        ))}
        {conversations?.length === 0 && (
          <p className="text-[11px] text-gray-300 text-center py-6 px-2">No conversations yet</p>
        )}
      </div>
    </div>
  );
}

export default function ScoutPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Mode>("agent");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [optimistic, setOptimistic] = useState<ScoutMessage[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: conversations } = useQuery({
    queryKey: queryKeys.scout.conversations(workspaceId),
    queryFn: () => scoutApi.listConversations(workspaceId).then((r) => r.data as ScoutConversation[]),
  });

  // Default to the most recently active conversation once the list loads.
  useEffect(() => {
    if (activeId === null && conversations && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const { data: thread, isLoading } = useQuery({
    queryKey: queryKeys.scout.thread(workspaceId, activeId ?? -1),
    queryFn: () => scoutApi.getMessages(workspaceId, activeId!).then((r) => r.data as ScoutThread),
    enabled: activeId !== null,
  });

  const { data: suggestions } = useQuery({
    queryKey: queryKeys.scout.suggestions(workspaceId),
    queryFn: () => scoutApi.getSuggestions(workspaceId).then((r) => r.data as ScoutSuggestion[]),
  });

  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const isSending = streamState !== null;

  const messages = [...(thread?.messages ?? []), ...optimistic];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamState?.answer, streamState?.tools.length]);

  const handleSend = async (text?: string) => {
    const message = (text ?? draft).trim();
    if (!message || isSending) return;
    setOptimistic([{ id: -1, role: "user", content: message, mode: null, tool_trace: [], created_at: new Date().toISOString() }]);
    setDraft("");
    setStreamState({ tools: [], answer: "" });

    let conversationId = activeId;
    try {
      if (conversationId === null) {
        const created = await scoutApi.createConversation(workspaceId).then((r) => r.data as ScoutConversation);
        conversationId = created.id;
        setActiveId(conversationId);
      }

      for await (const event of scoutApi.streamMessage(workspaceId, conversationId, { message, mode })) {
        if (event.type === "tool_call") {
          setStreamState((prev) => ({
            tools: [...prev!.tools, { tool: event.tool as string, arguments: event.arguments as Record<string, unknown> }],
            answer: prev!.answer,
          }));
        } else if (event.type === "tool_result") {
          setStreamState((prev) => {
            const tools = [...prev!.tools];
            const idx = tools.map((t) => !t.result).lastIndexOf(true);
            if (idx >= 0) tools[idx] = { ...tools[idx], result: event.result as Record<string, unknown> };
            return { tools, answer: prev!.answer };
          });
        } else if (event.type === "answer_chunk") {
          setStreamState((prev) => ({ tools: prev!.tools, answer: prev!.answer + (event.text as string) }));
        } else if (event.type === "error") {
          setStreamState((prev) => ({ tools: prev!.tools, answer: event.message as string }));
          break;
        } else if (event.type === "done") {
          break;
        }
      }
    } catch {
      setStreamState((prev) => ({ tools: prev?.tools ?? [], answer: "Something went wrong reaching Scout. Please try again." }));
    } finally {
      setOptimistic([]);
      setStreamState(null);
      if (conversationId !== null) {
        qc.invalidateQueries({ queryKey: queryKeys.scout.thread(workspaceId, conversationId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.scout.conversations(workspaceId) });
    }
  };

  return (
    <div className="h-[calc(100vh-56px)] flex bg-white">
      <ConversationRail workspaceId={workspaceId} activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 flex flex-col min-w-0">
      <style jsx global>{`
        .scout-markdown .ai-p { margin: 0 0 6px; }
        .scout-markdown .ai-p:last-child { margin-bottom: 0; }
        .scout-markdown .ai-heading { font-weight: 600; margin: 8px 0 4px; color: #111827; }
        .scout-markdown .ai-h1 { font-size: 14.5px; }
        .scout-markdown .ai-h2 { font-size: 13.5px; }
        .scout-markdown .ai-h3 { font-size: 13px; }
        .scout-markdown .ai-ul, .scout-markdown .ai-ol { margin: 4px 0 6px; padding-left: 18px; }
        .scout-markdown .ai-ul { list-style: disc; }
        .scout-markdown .ai-ol { list-style: decimal; }
        .scout-markdown .ai-ul li, .scout-markdown .ai-ol li { margin-bottom: 2px; }
        .scout-markdown .ai-inline-code { background: rgba(0,0,0,0.05); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: ui-monospace, monospace; }
        .scout-markdown strong { font-weight: 600; color: #111827; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}>
            <Compass className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">Scout</h1>
            <p className="text-[11px] text-gray-400 leading-tight">Your AI data analyst for this workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Agent / Chat toggle */}
          <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-xs font-medium">
            {(["agent", "chat"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                  mode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
                )}
              >
                {m === "agent" ? <Wand2 className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                {m === "agent" ? "Agent" : "Chat"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-300">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "hsl(var(--primary) / 0.10)" }}>
              <Compass className="w-7 h-7" style={{ color: "hsl(var(--primary))" }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Ask Scout anything about your data</h2>
              <p className="text-sm text-gray-400">
                Every answer is backed by real analysis Scout ran on your data — not a guess.
              </p>
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="flex flex-col gap-2 w-full">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.label)}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition text-left"
                  >
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
            {streamState && <StreamingBubble state={streamState} mode={mode} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2.5">
          <div className="flex-1 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 focus-within:border-gray-300 transition">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={mode === "agent" ? "Ask Scout to investigate something…" : "Ask a quick question…"}
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
              disabled={isSending}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!draft.trim() || isSending}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition hover:opacity-90"
            style={{ backgroundColor: "hsl(var(--primary))" }}
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-2">Scout can make mistakes — verify important findings.</p>
      </div>
      </div>
    </div>
  );
}
