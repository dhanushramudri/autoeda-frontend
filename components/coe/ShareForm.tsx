"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import { coeApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { COE_CATEGORIES } from "./categoryConfig";
import type { CoePostCategory } from "@/types";

export function ShareForm({
  defaultCategory, onClose,
}: { defaultCategory: CoePostCategory | "all"; onClose: () => void }) {
  const qc = useQueryClient();
  const postCategories = COE_CATEGORIES.filter((c) => c.key !== "all") as { key: CoePostCategory; label: string; icon: React.ComponentType<{ className?: string }>; solid: string; soft: string }[];

  const [category, setCategory] = useState<CoePostCategory>(
    defaultCategory === "all" ? "finding" : defaultCategory
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const createMutation = useMutation({
    mutationFn: () => coeApi.create({
      category, title: title.trim(), content: content.trim(),
      link_url: linkUrl.trim() || undefined,
      event_date: eventDate ? new Date(eventDate).toISOString() : undefined,
      tags,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coe", "posts"] });
      onClose();
    },
    onError: () => setError("Couldn't post that — please try again."),
  });

  const needsDate = category === "event" || category === "certification";

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Share with the CoE</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {postCategories.map((c) => {
            const Icon = c.icon;
            const active = category === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition",
                  active ? "border-transparent" : "border-border text-muted-foreground hover:border-brand/40"
                )}
                style={active ? { backgroundColor: c.soft, color: c.solid } : {}}
              >
                <Icon className="w-3 h-3" /> {c.label.replace(/s$/, "")}
              </button>
            );
          })}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. Snowflake Postgres Mirroring key takeaways"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand transition"
          autoFocus
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the details — bullet points, key takeaways, whatever you'd share in the team chat. Markdown supported."
          rows={5}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand transition resize-none"
        />
        <div className="flex gap-3">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Link (optional) — registration page, article, docs…"
            className="flex-1 px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand transition"
          />
          {needsDate && (
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              title={category === "event" ? "Event / registration deadline" : "Application deadline"}
              className="px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand transition"
            />
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
              #{t}
              <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="hover:text-red-500">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
            onBlur={addTag}
            placeholder="Add tags — press Enter"
            className="px-2.5 py-1 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand transition w-44"
          />
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={() => title.trim() && createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
