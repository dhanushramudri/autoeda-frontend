"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { docsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { iconForCategory, colorForCategory } from "@/lib/docCategoryStyle";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { BookOpen, Plus, FileText, X, ArrowRight } from "lucide-react";

interface Category {
  id: number;
  name: string;
  description?: string | null;
  article_count: number;
}

export default function LibraryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: queryKeys.docs.categories(),
    queryFn: () => docsApi.listCategories().then((r) => r.data),
  });

  const totalArticles = categories?.reduce((s, c) => s + c.article_count, 0) ?? 0;

  const createCategory = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await docsApi.createCategory(name.trim(), description.trim() || undefined);
      await queryClient.invalidateQueries({ queryKey: queryKeys.docs.categories() });
      setShowNew(false);
      setName("");
      setDescription("");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail ?? "Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-b-3xl mb-8 px-8 pt-10 pb-12 bg-gradient-to-br from-[#3b1fa3] via-[#4d2bc9] to-[#6d3ff0]">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
        <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none" viewBox="0 0 600 200">
          <polyline points="0,150 80,100 160,130 240,60 320,90 400,40 480,70 560,20 600,40"
            fill="none" stroke="white" strokeWidth="2" />
        </svg>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">Dataset Library</h1>
          <p className="text-sm text-white/70 mt-1.5 max-w-lg">
            Find datasets by use case, see the business context behind them, and edit or download as needed.
          </p>

          <div className="flex items-center gap-3 mt-6">
            <div className="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 min-w-[100px]">
              <p className="text-2xl font-bold text-white tabular-nums">{categories?.length ?? 0}</p>
              <p className="text-[11px] text-white/60 uppercase tracking-wide">Categories</p>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 min-w-[100px]">
              <p className="text-2xl font-bold text-white tabular-nums">{totalArticles}</p>
              <p className="text-[11px] text-white/60 uppercase tracking-wide">Articles</p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-white text-[#3b1fa3] text-sm font-semibold rounded-xl hover:bg-white/90 transition shadow-lg shadow-black/10"
            >
              <Plus className="w-4 h-4" /> New Category
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 pb-10">
        {showNew && (
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">New Category</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Churn, Forecasting, Revenue Prediction"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition"
                autoFocus
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What kind of datasets/use cases belong here? (optional)"
                rows={2}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition resize-none"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
                <button
                  onClick={createCategory}
                  disabled={saving || !name.trim()}
                  className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-[#2a0d8a] transition disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <PageSpinner />
        ) : !categories || categories.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-12 h-12" />}
            title="No categories yet"
            description="Create the first one — e.g. Churn, Forecasting, or Revenue Prediction — to start organizing dataset documentation."
            action={
              <button
                onClick={() => setShowNew(true)}
                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-[#2a0d8a] transition"
              >
                Create a category
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat, i) => {
              const Icon = iconForCategory(cat.name);
              const color = colorForCategory(i);
              return (
                <button
                  key={cat.id}
                  onClick={() => router.push(`/library/${cat.id}`)}
                  className="text-left bg-white border border-gray-200 rounded-2xl p-5 transition-all duration-200 group hover:-translate-y-1 hover:shadow-xl"
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = color.ring)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{ backgroundColor: color.soft }}
                    >
                      <Icon className="w-5 h-5" style={{ color: color.solid }} />
                    </div>
                    <span
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: color.soft, color: color.solid }}
                    >
                      <FileText className="w-3 h-3" /> {cat.article_count}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-brand transition">{cat.name}</h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[2.5em]">
                    {cat.description || "No description yet."}
                  </p>
                  <div className="flex items-center gap-1 mt-3 text-xs font-semibold opacity-0 group-hover:opacity-100 transition" style={{ color: color.solid }}>
                    Browse articles <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
