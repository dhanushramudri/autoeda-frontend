"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { datasetsApi } from "@/lib/api";
import {
  Sparkles,
  X,
  Loader2,
  ChevronRight,
  Command,
  Clock3,
  ArrowRight,
  Wand2,
  Search,
  BarChart3,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NLQueryResult } from "@/types";

const SUGGESTION_GROUPS = [
  {
    title: "Insights",
    icon: BarChart3,
    items: [
      "Show distribution of revenue",
      "What columns have outliers?",
      "Show correlation between columns",
      "Summarize this dataset",
    ],
  },
  {
    title: "Transformations",
    icon: Wand2,
    items: [
      "Filter rows where age > 30",
      "Drop columns with more than 50% missing",
      "Remove duplicate rows",
      "Create a new calculated column",
    ],
  },
  {
    title: "Navigation",
    icon: Search,
    items: [
      "Open correlations page",
      "Go to profile analysis",
      "Open SQL editor",
      "Show missing values",
    ],
  },
];

const RECENT_KEY = "autoeda_recent_queries";

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_KEY);
    if (saved) {
      try {
        setRecentQueries(JSON.parse(saved));
      } catch {
        setRecentQueries([]);
      }
    }
  }, []);

  const addRecentQuery = useCallback((q: string) => {
    const updated = [q, ...recentQueries.filter((x) => x !== q)].slice(0, 5);
    setRecentQueries(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  }, [recentQueries]);

  const allSuggestions = useMemo(
    () => SUGGESTION_GROUPS.flatMap((g) => g.items),
    []
  );

  const mutation = useMutation({
    mutationFn: (q: string) =>
      datasetsApi
        .nlQuery(resolvedId, q)
        .then((r) => r.data as NLQueryResult),

    onSuccess: (data) => {
      setResult(data);
      addRecentQuery(query.trim());

      if (data.action === "navigate" && data.params.page) {
        const page = data.params.page as string;
        const base = `/datasets/${resolvedId}`;
        const target = page === "overview" ? base : `${base}/${page}`;

        setTimeout(() => {
          router.push(target);
          setOpen(false);
          setQuery("");
          setResult(null);
        }, 900);
      }
    },
  });

  const handleSubmit = useCallback(() => {
    if (!query.trim() || !resolvedId || mutation.isPending) return;

    mutation.mutate(query.trim());
  }, [query, resolvedId, mutation]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResult(null);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }

      if (e.key === "Escape") {
        closePalette();
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [closePalette]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const severityStyles: Record<string, string> = {
    navigate:
      "border-blue-200 bg-blue-50 text-blue-700",
    transform:
      "border-amber-200 bg-amber-50 text-amber-700",
    filter:
      "border-purple-200 bg-purple-50 text-purple-700",
    unknown:
      "border-gray-200 bg-gray-50 text-gray-700",
  };

  const handleSuggestionClick = (value: string) => {
    setQuery(value);
    setResult(null);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((p) =>
        p >= allSuggestions.length - 1 ? 0 : p + 1
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((p) =>
        p <= 0 ? allSuggestions.length - 1 : p - 1
      );
    }

    if (e.key === "Tab") {
      e.preventDefault();
      setQuery(allSuggestions[selectedIndex]);
    }
  };

  return (
    <>
      {/* Trigger */}
<button
  onClick={() => setOpen(true)}
  className="group w-full max-w-md h-11 flex items-center gap-3 px-4 bg-white border border-gray-200 rounded-xl hover:border-brand/30 hover:shadow-sm transition-all text-left"
>
  <Sparkles className="w-4 h-4 text-brand flex-shrink-0" />

  <span className="flex-1 text-sm text-gray-400 truncate">
    Ask AI about this dataset...
  </span>

  <kbd className="hidden md:flex items-center gap-1 text-[10px] bg-gray-50 border border-gray-200 rounded-md px-1.5 py-1 text-gray-400 font-mono flex-shrink-0">
    <Command className="w-2.5 h-2.5" />
    K
  </kbd>
</button>

      {/* Palette */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closePalette();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-white/90 backdrop-blur-xl shadow-2xl"
            >
              {/* Header */}
              <div className="border-b border-gray-100 px-5 py-4 bg-white/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-brand" />
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      AutoEDA AI Assistant
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Analyze, explore and transform your data using natural language
                    </p>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />

                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setResult(null);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder={
                    resolvedId
                      ? "Ask anything about your dataset..."
                      : "Open a dataset to start querying"
                  }
                  className="flex-1 bg-transparent text-[15px] font-medium outline-none text-gray-900 placeholder:text-gray-300"
                  disabled={!resolvedId}
                />

                {mutation.isPending ? (
                  <div className="flex items-center gap-2 text-xs text-brand">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking...
                  </div>
                ) : query ? (
                  <button
                    onClick={() => {
                      setQuery("");
                      setResult(null);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                ) : null}
              </div>

              {/* Empty state */}
              {!resolvedId && (
                <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <Database className="w-7 h-7 text-gray-400" />
                  </div>

                  <h3 className="text-sm font-semibold text-gray-700">
                    Select a dataset first
                  </h3>

                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    Open a dataset to start using the AI assistant for analysis,
                    transformation and navigation.
                  </p>
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="p-4 border-b border-gray-100">
                  <div
                    className={cn(
                      "rounded-2xl border px-4 py-3",
                      severityStyles[result.action] ?? severityStyles.unknown
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold capitalize">
                          {result.action}
                        </p>

                        <p className="text-sm mt-1 opacity-90">
                          {result.message}
                        </p>

                        {result.action === "navigate" && (
                          <p className="text-xs mt-2 opacity-70">
                            Redirecting to requested page...
                          </p>
                        )}
                      </div>

                      <div className="px-2 py-1 rounded-full bg-white/60 text-[10px] font-semibold uppercase tracking-wide">
                        AI
                      </div>
                    </div>

                    {(result.action === "transform" ||
                      result.action === "filter") && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => {
                            router.push(`/datasets/${resolvedId}/transform`);
                            closePalette();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-medium text-white hover:opacity-90 transition"
                        >
                          Open Transform Studio
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Content */}
              {!result && resolvedId && (
                <div className="max-h-[420px] overflow-y-auto py-2">
                  {/* Recent */}
                  {recentQueries.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 px-5 py-2">
                        <Clock3 className="w-3 h-3 text-gray-400" />
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          Recent
                        </p>
                      </div>

                      <div className="px-2">
                        {recentQueries.map((item) => (
                          <button
                            key={item}
                            onClick={() => handleSuggestionClick(item)}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition flex items-center gap-3"
                          >
                            <Clock3 className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />

                            <span className="text-sm text-gray-700 truncate">
                              {item}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {SUGGESTION_GROUPS.map((group) => {
                    const GroupIcon = group.icon;

                    return (
                      <div key={group.title} className="mb-4 last:mb-2">
                        <div className="flex items-center gap-2 px-5 py-2">
                          <GroupIcon className="w-3 h-3 text-gray-400" />

                          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            {group.title}
                          </p>
                        </div>

                        <div className="px-2">
                          {group.items.map((s) => {
                            const isSelected =
                              allSuggestions[selectedIndex] === s;

                            return (
                              <button
                                key={s}
                                onClick={() => handleSuggestionClick(s)}
                                className={cn(
                                  "w-full text-left px-3 py-3 rounded-xl transition flex items-center gap-3",
                                  isSelected
                                    ? "bg-brand/5 border border-brand/10"
                                    : "hover:bg-gray-50"
                                )}
                              >
                                <div className="w-7 h-7 rounded-lg bg-brand/5 flex items-center justify-center flex-shrink-0">
                                  <Sparkles className="w-3 h-3 text-brand" />
                                </div>

                                <span className="text-sm text-gray-700 truncate">
                                  {s}
                                </span>

                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-5 py-3">
                <div className="flex items-center gap-4 text-[11px] text-gray-400">
                  <span>↵ Ask</span>
                  <span>↑↓ Navigate</span>
                  <span>TAB Complete</span>
                  <span>ESC Close</span>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={
                    !query.trim() || mutation.isPending || !resolvedId
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Ask AI
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}