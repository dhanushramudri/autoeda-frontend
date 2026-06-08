"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { datasetsApi } from "@/lib/api";
import { useAiContextStore, serializeAnalysisForAI } from "@/store/aiContextStore";
import { X, Send, Bot, User, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  datasetId: string;
  datasetName?: string;
}

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inOl = false;
  let inUl = false;

  const closeList = () => {
    if (inOl) { out.push("</ol>"); inOl = false; }
    if (inUl) { out.push("</ul>"); inUl = false; }
  };

  const inlineFormat = (s: string) =>
    s
      // **bold**
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // *italic* (not preceded/followed by *)
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
      // `code`
      .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      closeList();
      out.push("<br/>");
      continue;
    }

    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      const tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      out.push(`<${tag} class="ai-heading ai-h${level}">${inlineFormat(hMatch[2])}</${tag}>`);
      continue;
    }

    const olMatch = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (olMatch) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push('<ol class="ai-ol">'); inOl = true; }
      out.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    const ulMatch = line.match(/^\s*[-*•]\s+(.*)/);
    if (ulMatch) {
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push('<ul class="ai-ul">'); inUl = true; }
      out.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p class="ai-p">${inlineFormat(line)}</p>`);
  }

  closeList();
  return out.join("");
}

function MessageContent({ role, content }: { role: Message["role"]; content: string }) {
  if (role === "user") {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }
  return (
    <span
      className="ai-markdown"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

export function AskAiPanel({ datasetId, datasetName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextVisible, setContextVisible] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pageContext = useAiContextStore((s) => s.pageContext);
  const analysisData = useAiContextStore((s) => s.analysisData);
  const pendingQuestion = useAiContextStore((s) => s.pendingQuestion);
  const setPendingQuestion = useAiContextStore((s) => s.setPendingQuestion);

  const activeColumn = pageContext?.details?.activeColumn as string | undefined;
  const activeChartType = pageContext?.details?.activeChartType as string | undefined;

  // Open and auto-send when a chart button fires a pending question
  useEffect(() => {
    if (pendingQuestion) {
      setOpen(true);
      const t = setTimeout(() => {
        sendMessage(pendingQuestion);
        setPendingQuestion(null);
      }, 120);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const hasAnalysis = !!analysisData;
      setMessages([{
        role: "assistant",
        content: `Hi! I'm your AI analyst for **${datasetName || "this dataset"}**. ${
          hasAnalysis
            ? "I can see all the chart values and statistics on the analysis page — ask me about any specific numbers, distributions, correlations, or what to do next."
            : "Ask me anything about this dataset."
        }`,
      }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, datasetName, messages.length, analysisData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const analysisContext = serializeAnalysisForAI(analysisData);

      const res = await datasetsApi.aiChat(
        datasetId,
        text,
        [...messages, userMsg].slice(-12),
        {
          ...(pageContext
            ? { page: pageContext.page, ...pageContext.details }
            : {}),
          analysis_context: analysisContext || undefined,
          active_column: activeColumn,
          active_chart_type: activeChartType,
        },
      );

      const reply: string = res.data?.reply ?? "No response.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't reach the AI service. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [datasetId, loading, messages, pageContext, analysisData]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const suggestions = pageContext?.suggestedQuestions ?? [
    "What should I explore first?",
    "What are the biggest data quality issues?",
    "Which columns need cleaning?",
  ];

  const contextSummary = analysisData
    ? `${analysisData.total_rows.toLocaleString()} rows · ${analysisData.numeric_cols.length} numeric · ${analysisData.categorical_cols.length} categorical${analysisData.datetime_cols.length ? ` · ${analysisData.datetime_cols.length} datetime` : ""}`
    : null;

  return (
    <>
      <style>{`
        .ai-markdown { display: block; }
        .ai-markdown .ai-p { margin: 0 0 0.35em; line-height: 1.55; }
        .ai-markdown .ai-p:last-child { margin-bottom: 0; }
        .ai-markdown br { display: block; content: ""; margin: 0.2em 0; }
        .ai-markdown strong { font-weight: 600; }
        .ai-markdown em { font-style: italic; }
        .ai-markdown .ai-inline-code {
          font-family: ui-monospace, monospace;
          font-size: 0.8em;
          background: rgba(0,0,0,0.08);
          border-radius: 3px;
          padding: 0.1em 0.35em;
        }
        .ai-markdown .ai-ol,
        .ai-markdown .ai-ul {
          margin: 0.3em 0 0.4em 1.15em;
          padding: 0;
        }
        .ai-markdown .ai-ol { list-style: decimal; }
        .ai-markdown .ai-ul { list-style: disc; }
        .ai-markdown li { margin: 0.15em 0; line-height: 1.5; }
        .ai-markdown .ai-heading { font-weight: 700; margin: 0.5em 0 0.2em; }
        .ai-markdown .ai-h1 { font-size: 1.05em; }
        .ai-markdown .ai-h2 { font-size: 0.98em; }
        .ai-markdown .ai-h3 { font-size: 0.93em; }
      `}</style>

      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg",
          "bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all",
          open && "hidden"
        )}
      >
        <Sparkles className="w-4 h-4" />
        Ask AI
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[100] w-[390px] max-h-[620px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-violet-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-semibold truncate">AI Analyst</span>
              {pageContext && (
                <span className="text-xs bg-violet-500 px-2 py-0.5 rounded-full truncate max-w-[140px]">
                  {pageContext.label}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="hover:bg-violet-700 rounded p-0.5 transition flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {contextSummary && (
            <div className="flex-shrink-0 border-b border-gray-100">
              <button
                onClick={() => setContextVisible((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition"
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  AI sees: {contextSummary}
                </span>
                {contextVisible
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />
                }
              </button>
              {contextVisible && (
                <div className="px-3 pb-2 text-xs text-gray-400 space-y-0.5">
                  <p>Numeric: {analysisData?.numeric_cols.join(", ") || "none"}</p>
                  <p>Categorical: {analysisData?.categorical_cols.join(", ") || "none"}</p>
                  {analysisData?.datetime_cols.length ? (
                    <p>Datetime: {analysisData.datetime_cols.join(", ")}</p>
                  ) : null}
                  {analysisData?.sampled && analysisData.sample_size != null && (
                    <p className="text-amber-500">
                      ⚠ Large dataset — stats from {analysisData.sample_size.toLocaleString()} row sample
                    </p>
                  )}
                  {activeColumn && (
                    <p className="text-violet-600">
                      Active: {activeColumn} ({activeChartType})
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm min-h-0">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-2 max-w-full",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                  msg.role === "user" ? "bg-blue-100" : "bg-violet-100"
                )}>
                  {msg.role === "user"
                    ? <User className="w-3.5 h-3.5 text-blue-600" />
                    : <Bot className="w-3.5 h-3.5 text-violet-600" />
                  }
                </div>
                <div className={cn(
                  "rounded-xl px-3 py-2 text-sm leading-relaxed max-w-[85%]",
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                )}>
                  <MessageContent role={msg.role} content={msg.content} />
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="bg-gray-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                  <span className="text-xs text-gray-400">Thinking…</span>
                </div>
              </div>
            )}

            {/* Suggested questions — only before real conversation starts */}
            {messages.length <= 1 && !loading && (
              <div className="pt-1 space-y-1.5">
                <p className="text-xs text-gray-400 px-1">Suggested:</p>
                {suggestions.slice(0, 3).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="block w-full text-left text-xs text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100 rounded-lg px-3 py-2 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2.5 flex gap-2 items-center flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about charts, values, statistics…"
              className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 min-w-0"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
