"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { docsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { iconForCategory, colorForCategory } from "@/lib/docCategoryStyle";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { FileText, Plus, Database, Paperclip, ArrowRight } from "lucide-react";

interface LinkedDataset { id: number; name: string; row_count?: number | null }
interface Article {
  id: number;
  title: string;
  summary?: string | null;
  content_preview?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  updated_at: string;
  datasets: LinkedDataset[];
  attachment_count: number;
}
interface Category { id: number; name: string; description?: string | null; article_count: number }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function CategoryArticlesPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catId = Number(categoryId);

  const { data: categories } = useQuery<Category[]>({
    queryKey: queryKeys.docs.categories(),
    queryFn: () => docsApi.listCategories().then((r) => r.data),
  });
  const catIndex = categories?.findIndex((c) => c.id === catId) ?? 0;
  const category = categories?.find((c) => c.id === catId);
  const color = colorForCategory(catIndex < 0 ? 0 : catIndex);
  const Icon = iconForCategory(category?.name ?? "");

  const { data: articles, isLoading } = useQuery<Article[]>({
    queryKey: queryKeys.docs.articles(catId),
    queryFn: () => docsApi.listArticles(catId).then((r) => r.data),
  });

  const createArticle = async () => {
    const res = await docsApi.createArticle({ category_id: catId, title: "Untitled article" });
    await queryClient.invalidateQueries({ queryKey: queryKeys.docs.articles(catId) });
    router.push(`/library/articles/${res.data.id}?edit=1`);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="px-8 pt-6">
        <Breadcrumb
          items={[
            { label: "Dataset Library", href: "/library" },
            { label: category?.name ?? "Category" },
          ]}
        />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mt-4 mb-8 px-8">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: color.soft }}
          >
            <Icon className="w-7 h-7" style={{ color: color.solid }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{category?.name ?? "Category"}</h1>
            {category?.description && <p className="text-sm text-gray-500 mt-1 max-w-lg">{category.description}</p>}
            <p className="text-xs text-gray-400 mt-1.5">{articles?.length ?? 0} article{articles?.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <button
          onClick={createArticle}
          className="flex items-center gap-1.5 px-3.5 py-2.5 text-white text-sm font-semibold rounded-xl transition flex-shrink-0 shadow-sm"
          style={{ backgroundColor: color.solid }}
        >
          <Plus className="w-4 h-4" /> New Article
        </button>
      </div>

      <div className="px-8 pb-10">
        {isLoading ? (
          <PageSpinner />
        ) : !articles || articles.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="No articles yet"
            description="Write the first one — describe what the dataset is for, the business use case, and link the relevant dataset(s)."
            action={
              <button
                onClick={createArticle}
                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-[#2a0d8a] transition"
              >
                Write an article
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {articles.map((a) => {
              const preview = a.summary || a.content_preview || "";
              return (
                <button
                  key={a.id}
                  onClick={() => router.push(`/library/articles/${a.id}`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-gray-300 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-brand transition">{a.title}</h3>
                      {preview && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{preview}</p>}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand flex-shrink-0 transition mt-0.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5" />
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.datasets.map((d) => (
                        <span key={d.id} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-brand rounded-full text-[10px] font-medium">
                          <Database className="w-2.5 h-2.5" /> {d.name}
                        </span>
                      ))}
                      {a.attachment_count > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full text-[10px] font-medium">
                          <Paperclip className="w-2.5 h-2.5" /> {a.attachment_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: color.solid }}
                        title={a.updated_by_name ?? undefined}
                      >
                        {initials(a.updated_by_name)}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{relativeTime(a.updated_at)}</span>
                    </div>
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
