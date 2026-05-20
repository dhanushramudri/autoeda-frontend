"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { feedbackApi, UPLOADS_BASE } from "@/lib/api";
import { FeedbackModal } from "@/components/shared/FeedbackModal";
import {
  MessageSquarePlus, Star, Video, X,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attachment { path: string; name: string }

interface FeedbackRow {
  id: number;
  user_email: string | null;
  feedback_type: string;
  rating: number | null;
  subject: string | null;
  message: string;
  page: string | null;
  attachments: Attachment[];
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, string> = {
  bug:     "bg-red-50 text-red-600 border-red-200",
  feature: "bg-blue-50 text-blue-600 border-blue-200",
  general: "bg-gray-100 text-gray-600 border-gray-200",
  other:   "bg-purple-50 text-purple-600 border-purple-200",
};
const TYPE_LABEL: Record<string, string> = {
  bug: "Bug", feature: "Feature", general: "General", other: "Other",
};

function isVideoPath(p: string) { return /\.(mp4|webm|mov|avi)$/i.test(p); }
function attachUrl(path: string) { return `${UPLOADS_BASE}/uploads/${path}`; }

// ─── Small helpers ────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number | null }) {
  if (!value) return <span className="text-gray-300">—</span>;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn("w-3 h-3", s <= value ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200")} />
      ))}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 ml-1 text-gray-400" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1 text-brand" />
    : <ChevronDown className="w-3 h-3 ml-1 text-brand" />;
}

// ─── Media viewer ─────────────────────────────────────────────────────────────

function MediaViewer({ url, name, isVideo, onClose }: {
  url: string; name: string; isVideo: boolean; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative z-10 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-9 right-0 p-1.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
        {isVideo ? (
          <video controls autoPlay src={url} className="max-h-[82vh] max-w-[90vw] rounded-lg shadow-2xl" />
        ) : (
          <img src={url} alt={name} className="max-h-[82vh] max-w-[90vw] rounded-lg shadow-2xl object-contain" />
        )}
        <p className="mt-3 text-white/50 text-xs">{name}</p>
      </div>
    </div>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ row, onClose, onViewMedia }: {
  row: FeedbackRow;
  onClose: () => void;
  onViewMedia: (url: string, name: string, isVideo: boolean) => void;
}) {
  const attachments = row.attachments ?? [];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", TYPE_STYLE[row.feedback_type] ?? TYPE_STYLE.general)}>
              {TYPE_LABEL[row.feedback_type] ?? row.feedback_type}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(row.created_at).toLocaleString(undefined, {
                month: "short", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Subject */}
          {row.subject && (
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{row.subject}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="font-medium text-gray-700 dark:text-gray-300">{row.user_email ?? "Unknown"}</span>
            {row.rating && <StarRating value={row.rating} />}
          </div>

          {/* Message */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Message</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{row.message}</p>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Attachments ({attachments.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {attachments.map((a, i) => {
                  const url = attachUrl(a.path);
                  const video = isVideoPath(a.path);
                  return (
                    <button key={i} onClick={() => onViewMedia(url, a.name, video)}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-brand transition-colors bg-gray-50 dark:bg-gray-800">
                      {video ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                          <Video className="w-6 h-6 text-gray-400 group-hover:text-brand transition-colors" />
                          <span className="text-[9px] text-gray-400 truncate w-full text-center">{a.name}</span>
                        </div>
                      ) : (
                        <img src={url} alt={a.name} className="w-full h-full object-cover group-hover:opacity-85 transition-opacity" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SortKey = "date" | "rating";
type SortDir = "asc" | "desc";

export default function FeedbackPage() {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<FeedbackRow | null>(null);
  const [viewMedia, setViewMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, refetch } = useQuery<FeedbackRow[]>({
    queryKey: ["feedback-list"],
    queryFn: () => feedbackApi.list().then((r) => r.data),
  });

  const rows = data ?? [];

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === "date") {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortDir === "desc" ? -diff : diff;
      }
      const ra = a.rating ?? 0, rb = b.rating ?? 0;
      return sortDir === "desc" ? rb - ra : ra - rb;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortTh = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="px-4 py-3 text-left font-semibold text-gray-500 cursor-pointer select-none whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center hover:text-gray-700 transition-colors">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Feedback</h1>
          <p className="text-xs text-gray-400 mt-0.5">{rows.length} submission{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setSubmitOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          New Feedback
        </button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-400 py-12 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No feedback submitted yet.</div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <SortTh label="Date" k="date" />
                <th className="px-4 py-3 text-left font-semibold text-gray-500">User</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Type</th>
                <SortTh label="Rating" k="rating" />
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Subject</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                  onClick={() => setSelectedRow(row)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {new Date(row.created_at).toLocaleString(undefined, {
                      month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[140px] truncate">
                    {row.user_email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium",
                      TYPE_STYLE[row.feedback_type] ?? TYPE_STYLE.general)}>
                      {TYPE_LABEL[row.feedback_type] ?? row.feedback_type}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StarRating value={row.rating} /></td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">
                    {row.subject ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs">
                    <span className="line-clamp-1">{row.message}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submit modal */}
      <FeedbackModal
        open={submitOpen}
        onClose={() => { setSubmitOpen(false); refetch(); }}
      />

      {/* Detail modal */}
      {selectedRow && (
        <DetailModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onViewMedia={(url, name, isVideo) => setViewMedia({ url, name, isVideo })}
        />
      )}

      {/* Media viewer */}
      {viewMedia && (
        <MediaViewer
          url={viewMedia.url}
          name={viewMedia.name}
          isVideo={viewMedia.isVideo}
          onClose={() => setViewMedia(null)}
        />
      )}
    </div>
  );
}
