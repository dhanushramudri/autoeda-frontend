import {
  LayoutGrid, Newspaper, CalendarDays, Lightbulb, GraduationCap, Link2,
} from "lucide-react";
import type { CoePostCategory } from "@/types";

export type CoeCategoryKey = CoePostCategory | "all";

export interface CoeCategoryDef {
  key: CoeCategoryKey;
  label: string;
  plural: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  solid: string;
  soft: string;
}

export const COE_CATEGORIES: CoeCategoryDef[] = [
  {
    key: "all",
    label: "All",
    plural: "All Posts",
    description: "Everything shared across the DS practice, in one feed.",
    icon: LayoutGrid,
    solid: "#3b1fa3",
    soft: "rgba(59, 31, 163, 0.10)",
  },
  {
    key: "newsletter",
    label: "Newsletters",
    plural: "Newsletters",
    description: "Recaps, takeaways, and roundups worth passing on.",
    icon: Newspaper,
    solid: "#2563eb",
    soft: "rgba(37, 99, 235, 0.10)",
  },
  {
    key: "event",
    label: "Events",
    plural: "Events",
    description: "Workshops, conferences, and meetups — with dates that matter.",
    icon: CalendarDays,
    solid: "#d97706",
    soft: "rgba(217, 119, 6, 0.10)",
  },
  {
    key: "finding",
    label: "Findings",
    plural: "Findings",
    description: "Technical tips, gotchas, and things worth knowing before you hit them.",
    icon: Lightbulb,
    solid: "#059669",
    soft: "rgba(5, 150, 105, 0.10)",
  },
  {
    key: "certification",
    label: "Certifications",
    plural: "Certifications",
    description: "Vouchers, courses, and credentials worth chasing.",
    icon: GraduationCap,
    solid: "#7c3aed",
    soft: "rgba(124, 58, 237, 0.10)",
  },
  {
    key: "resource",
    label: "Resources",
    plural: "Resources",
    description: "Tools, articles, and links worth bookmarking.",
    icon: Link2,
    solid: "#64748b",
    soft: "rgba(100, 116, 139, 0.10)",
  },
];

export const COE_CATEGORY_MAP: Record<CoeCategoryKey, CoeCategoryDef> = Object.fromEntries(
  COE_CATEGORIES.map((c) => [c.key, c])
) as Record<CoeCategoryKey, CoeCategoryDef>;

export function isCoeCategoryKey(v: string): v is CoeCategoryKey {
  return COE_CATEGORIES.some((c) => c.key === v);
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function eventLabel(iso: string): { text: string; soon: boolean; past: boolean } {
  const diffDays = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  const date = new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (diffDays < 0) return { text: `${date} (past)`, soon: false, past: true };
  if (diffDays === 0) return { text: "Today", soon: true, past: false };
  if (diffDays <= 7) return { text: `${date} — in ${diffDays}d`, soon: true, past: false };
  return { text: date, soon: false, past: false };
}

/** Plain-text preview of markdown content for compact card views — strips
 * formatting rather than rendering + CSS-clamping, since line-clamp across
 * mixed block elements (headings/lists/paragraphs) doesn't reliably clamp. */
export function stripMarkdownPreview(md: string, maxLen = 180): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}
