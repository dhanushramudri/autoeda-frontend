"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2 } from "lucide-react";
import { coeApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { EmptyState } from "@/components/shared/EmptyState";
import { CoePostCard } from "@/components/coe/CoePostCard";
import { ShareForm } from "@/components/coe/ShareForm";
import { COE_CATEGORY_MAP, isCoeCategoryKey } from "@/components/coe/categoryConfig";
import type { CoePost } from "@/types";

export default function CoeCategoryPage() {
  const params = useParams<{ category: string }>();
  const rawKey = params.category;
  const key = isCoeCategoryKey(rawKey) ? rawKey : "all";
  const cfg = COE_CATEGORY_MAP[key];
  const Icon = cfg.icon;

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: allPosts, isLoading } = useQuery({
    queryKey: queryKeys.coe.posts(),
    queryFn: () => coeApi.list().then((r) => r.data as CoePost[]),
  });

  const posts = useMemo(() => {
    let list = allPosts ?? [];
    if (key !== "all") list = list.filter((p) => p.category === key);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allPosts, key, search]);

  return (
    <div className="px-8 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: cfg.soft }}
          >
            <Icon className="w-5 h-5" style={{ color: cfg.solid }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{cfg.plural}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{cfg.description}</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:opacity-90 transition flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Share
        </button>
      </div>

      {showForm && (
        <div className="max-w-2xl">
          <ShareForm defaultCategory={key} onClose={() => setShowForm(false)} />
        </div>
      )}

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${cfg.plural.toLowerCase()}…`}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand transition bg-card"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Icon className="w-12 h-12" />}
          title={search ? "No matches" : `No ${cfg.plural.toLowerCase()} yet`}
          description={
            search
              ? "Try a different search term, or clear it to see everything in this category."
              : "Be the first to share something worth knowing — it takes 30 seconds."
          }
          action={
            !search ? (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:opacity-90 transition"
              >
                Share something
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map((p) => (
            <CoePostCard key={p.id} post={p} showCategory={key === "all"} />
          ))}
        </div>
      )}
    </div>
  );
}
