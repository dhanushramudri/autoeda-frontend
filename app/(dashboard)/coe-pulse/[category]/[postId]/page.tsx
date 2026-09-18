"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { coeApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Markdown } from "@/components/shared/Markdown";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { COE_CATEGORY_MAP, isCoeCategoryKey, relativeTime, eventLabel } from "@/components/coe/categoryConfig";
import type { CoePost } from "@/types";

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function CoePostDetailPage() {
  const params = useParams<{ category: string; postId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const rawKey = params.category;
  const backKey = isCoeCategoryKey(rawKey) ? rawKey : "all";
  const postId = Number(params.postId);

  const { data: posts, isLoading } = useQuery({
    queryKey: queryKeys.coe.posts(),
    queryFn: () => coeApi.list().then((r) => r.data as CoePost[]),
  });

  const post = posts?.find((p) => p.id === postId);

  const deleteMutation = useMutation({
    mutationFn: () => coeApi.delete(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coe", "posts"] });
      router.push(`/coe-pulse/${backKey}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-8">
        <EmptyState title="Post not found" description="It may have been removed." />
      </div>
    );
  }

  const cfg = COE_CATEGORY_MAP[post.category];
  const Icon = cfg.icon;
  const ev = post.event_date ? eventLabel(post.event_date) : null;
  const canDelete = !!user && (user.id === String(post.created_by) || user.is_admin);

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <button
        onClick={() => router.push(`/coe-pulse/${backKey}`)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to {COE_CATEGORY_MAP[backKey].plural}
      </button>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: cfg.soft, color: cfg.solid }}
        >
          <Icon className="w-3 h-3" /> {cfg.label.replace(/s$/, "")}
        </span>
        {ev && (
          <span
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium",
              ev.past
                ? "bg-muted text-muted-foreground/60"
                : ev.soon
                ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            {ev.text}
          </span>
        )}
        {canDelete && (
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>

      <h1 className="text-2xl font-bold text-foreground leading-tight mb-3">{post.title}</h1>

      <div className="flex items-center gap-2 mb-6 pb-6 border-b border-border">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: cfg.solid }}
        >
          {initials(post.created_by_name)}
        </span>
        <div className="text-xs">
          <span className="font-medium text-foreground">{post.created_by_name ?? "Someone"}</span>
          <span className="text-muted-foreground"> · {relativeTime(post.created_at)} · {new Date(post.created_at).toLocaleString()}</span>
        </div>
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
          >
            Open link <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {post.content && (
        <div className="prose prose-sm max-w-none text-foreground [&_a]:text-brand mb-6">
          <Markdown content={post.content} />
        </div>
      )}

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
