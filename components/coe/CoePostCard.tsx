"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2 } from "lucide-react";
import { coeApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { COE_CATEGORY_MAP, relativeTime, eventLabel, stripMarkdownPreview } from "./categoryConfig";
import type { CoePost } from "@/types";

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function CoePostCard({ post, showCategory }: { post: CoePost; showCategory?: boolean }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const cfg = COE_CATEGORY_MAP[post.category];
  const Icon = cfg.icon;
  const ev = post.event_date ? eventLabel(post.event_date) : null;
  const canDelete = !!user && (user.id === String(post.created_by) || user.is_admin);

  const deleteMutation = useMutation({
    mutationFn: () => coeApi.delete(post.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coe", "posts"] }),
  });

  return (
    <Link
      href={`/coe-pulse/${post.category}/${post.id}`}
      className="flex flex-col bg-card border border-border rounded-xl p-4 group relative transition hover:shadow-md hover:border-border/80 hover:-translate-y-0.5 duration-150"
    >
      <div className="flex items-center gap-1.5 mb-2 text-[10px] text-muted-foreground/80">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: cfg.solid }}
        >
          {initials(post.created_by_name)}
        </span>
        <span className="font-medium text-foreground/80">{post.created_by_name ?? "Someone"}</span>
        <span>· {relativeTime(post.created_at)}</span>

        {canDelete && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMutation.mutate(); }}
            className="ml-auto p-1 -m-1 text-muted-foreground/40 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <h3 className="text-sm font-bold text-foreground leading-snug mb-1.5 line-clamp-2">{post.title}</h3>

      {post.content && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
          {stripMarkdownPreview(post.content)}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        {showCategory && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: cfg.soft, color: cfg.solid }}
          >
            <Icon className="w-2.5 h-2.5" /> {cfg.label.replace(/s$/, "")}
          </span>
        )}
        {ev && (
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium",
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
        {post.tags.slice(0, 3).map((t) => (
          <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
            #{t}
          </span>
        ))}
        {post.tags.length > 3 && (
          <span className="text-[10px] text-muted-foreground/60">+{post.tags.length - 3}</span>
        )}
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto p-1 -m-1 text-muted-foreground/50 hover:text-brand transition"
            title="Open link"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </Link>
  );
}
