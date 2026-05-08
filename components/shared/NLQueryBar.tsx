"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { Sparkles, X, Loader2, ChevronRight } from "lucide-react";
import type { NLQueryResult } from "@/types";

const SUGGESTIONS = [
  "Show distribution of revenue",
  "Summarize this dataset",
  "What columns have outliers?",
  "Show correlation between columns",
  "Filter rows where age > 30",
  "Drop columns with more than 50% missing",
];

interface NLQueryBarProps {
  datasetId?: string;
}

export function NLQueryBar({ datasetId }: NLQueryBarProps) {
  const router = useRouter();
  const params = useParams<{ datasetId?: string }>();
  const resolvedId = datasetId ?? params?.datasetId ?? "";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<NLQueryResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (q: string) => datasetsApi.nlQuery(resolvedId, q).then((r) => r.data as NLQueryResult),
    onSuccess: (data) => {
      setResult(data);
      if (data.action === "navigate" && data.params.page) {
        const page = data.params.page as string;
        const base = `/datasets/${resolvedId}`;
        const target = page === "overview" ? base : `${base}/${page}`;
        setTimeout(() => {
          router.push(target);
          setOpen(false);
          setQuery("");
          setResult(null);
        }, 800);
      }
    },
  });

  const handleSubmit = useCallback(() => {
    if (!query.trim() || !resolvedId) return;
    mutation.mutate(query.trim());
  }, [query, resolvedId, mutation]);

  // Cmd+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResult(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const severityColor: Record<string, string> = {
    navigate: "text-brand",
    transform: "text-amber-600",
    filter: "text-purple-600",
    unknown: "text-gray-500",
  };

  return (
    <>
      {/* Trigger button in topbar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg text-sm transition w-56 text-left"
      >
        <Sparkles className="w-3.5 h-3.5 text-brand flex-shrink-0" />
        <span className="flex-1 text-gray-400">Ask anything...</span>
        <kbd className="text-xs bg-white border border-gray-200 rounded px-1 py-0.5 text-gray-400 font-mono">Cmd+K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center z-50 pt-24 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); setQuery(""); setResult(null); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Sparkles className="w-5 h-5 text-brand flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setResult(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                placeholder={resolvedId ? "Ask anything about your data..." : "Navigate to a dataset first"}
                className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400"
                disabled={!resolvedId}
              />
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 text-brand animate-spin" />
              ) : query ? (
                <button onClick={() => { setQuery(""); setResult(null); }}>
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              ) : null}
            </div>

            {/* Result */}
            {result && (
              <div className="px-4 py-3 border-b border-gray-100 bg-blue-50/50">
                <p className={`text-sm font-medium ${severityColor[result.action] ?? "text-gray-700"}`}>
                  {result.message}
                </p>
                {result.action === "navigate" && (
                  <p className="text-xs text-gray-400 mt-0.5">Redirecting...</p>
                )}
                {(result.action === "transform" || result.action === "filter") && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        router.push(`/datasets/${resolvedId}/transform`);
                        setOpen(false);
                        setQuery("");
                        setResult(null);
                      }}
                      className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-[#2a0d8a] flex items-center gap-1"
                    >
                      Open Transform <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Suggestions */}
            {!result && (
              <div className="py-2">
                <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Try asking...
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">Press Enter to submit . Esc to close</span>
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || mutation.isPending || !resolvedId}
                className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[#2a0d8a] transition"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
