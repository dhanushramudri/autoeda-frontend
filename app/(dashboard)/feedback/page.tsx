"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import { feedbackApi, UPLOADS_BASE } from "@/lib/api";
import { FeedbackModal } from "@/components/shared/FeedbackModal";
import { useAuthStore } from "@/store/authStore";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronUp, MessageSquare, X, Video, Trash2, Plus,
  Flame, Clock, Bold, Italic, List, Link2, Smile,
  ThumbsUp, ThumbsDown, Reply, MoreHorizontal, ArrowUp, ArrowDown,
  LayoutList, Kanban, BookOpen, Zap, CheckCircle2, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  status: string;
  upvote_count: number;
  user_has_voted: boolean;
  comment_count: number;
  created_at: string;
}

interface FeedbackComment {
  id: number;
  feedback_id: number;
  user_id: number;
  parent_id: number | null;
  user_email: string;
  user_name: string;
  content: string;
  is_system: boolean;
  created_at: string;
  like_count: number;
  dislike_count: number;
  user_vote: "like" | "dislike" | null;
}

interface ThreadData {
  root: FeedbackComment;
  replies: FeedbackComment[];
}

function buildThreads(comments: FeedbackComment[]): ThreadData[] {
  const byId = new Map(comments.map((c) => [c.id, c]));

  const getRootId = (c: FeedbackComment): number => {
    if (!c.parent_id) return c.id;
    const parent = byId.get(c.parent_id);
    return parent ? getRootId(parent) : c.id;
  };

  const roots = comments.filter((c) => !c.parent_id && !c.is_system);
  return roots.map((root) => ({
    root,
    replies: comments
      .filter((c) => !c.is_system && c.parent_id !== null && getRootId(c) === root.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  }));
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, string> = {
  bug:     "bg-red-50 text-red-600 border-red-200",
  feature: "bg-blue-50 text-blue-600 border-blue-200",
  general: "bg-muted text-muted-foreground border-border",
  other:   "bg-purple-50 text-purple-600 border-purple-200",
};
const TYPE_LABEL: Record<string, string> = {
  bug: "Bug", feature: "Feature Request", general: "General", other: "Other",
};

const STATUS_STYLE: Record<string, string> = {
  open:        "bg-muted text-muted-foreground",
  in_review:   "bg-blue-100 text-blue-700",
  in_progress: "bg-violet-100 text-violet-700",
  planned:     "bg-amber-100 text-amber-700",
  completed:   "bg-emerald-100 text-emerald-700",
  closed:      "bg-red-50 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open", in_review: "In Review", in_progress: "In Progress",
  planned: "Planned", completed: "Completed", closed: "Closed",
};
const ALL_STATUSES = Object.keys(STATUS_LABEL);

function isVideoPath(p: string) { return /\.(mp4|webm|mov|avi)$/i.test(p); }
function attachUrl(p: string) { return `${UPLOADS_BASE}/uploads/${p}`; }

function initials(email: string) {
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

// ── Vote button ───────────────────────────────────────────────────────────────

function VoteButton({
  feedbackId, count, voted, onVote,
}: {
  feedbackId: number; count: number; voted: boolean; onVote: (id: number) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onVote(feedbackId); }}
      className={cn(
        "flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg border transition-all text-xs font-semibold min-w-[44px]",
        voted
          ? "bg-brand text-white border-brand"
          : "bg-card text-muted-foreground border-border hover:border-brand hover:text-brand",
      )}
    >
      <ChevronUp className="w-4 h-4" />
      {count}
    </button>
  );
}

// ── Media viewer ──────────────────────────────────────────────────────────────

function MediaViewer({ url, name, isVideo, onClose }: {
  url: string; name: string; isVideo: boolean; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative z-10 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-9 right-0 p-1.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
        {isVideo
          ? <video controls autoPlay src={url} className="max-h-[82vh] max-w-[90vw] rounded-lg shadow-2xl" />
          : <img src={url} alt={name} className="max-h-[82vh] max-w-[90vw] rounded-lg shadow-2xl object-contain" />
        }
        <p className="mt-3 text-white/50 text-xs">{name}</p>
      </div>
    </div>
  );
}

// ── Comment item ──────────────────────────────────────────────────────────────

function CommentItem({
  comment, currentUserId, isAdmin, onDelete, onVote, onReply,
}: {
  comment: FeedbackComment;
  currentUserId: number | undefined;
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onVote: (id: number, type: "like" | "dislike") => void;
  onReply: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const canDelete = isAdmin || comment.user_id === currentUserId;

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand/20 to-brand/50 text-brand text-[11px] font-bold flex items-center justify-center shadow-sm">
          {initials(comment.user_email)}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-bold text-foreground">{comment.user_name}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>

        {/<[^>]*>/.test(comment.content) ? (
          <div
            className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: comment.content }}
          />
        ) : (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-0.5 mt-2">
          <button
            onClick={() => onVote(comment.id, "like")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition",
              comment.user_vote === "like"
                ? "bg-emerald-50 text-emerald-600"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            {comment.like_count > 0 && <span>{comment.like_count}</span>}
          </button>

          <button
            onClick={() => onVote(comment.id, "dislike")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition",
              comment.user_vote === "dislike"
                ? "bg-red-50 text-red-500"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            {comment.dislike_count > 0 && <span>{comment.dislike_count}</span>}
          </button>

          <button
            onClick={onReply}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <Reply className="w-3.5 h-3.5" />
            Reply
          </button>

          {canDelete && (
            <div className="relative ml-auto">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => { onDelete(comment.id); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Thread (root + replies) ───────────────────────────────────────────────────

function CommentThread({
  thread, currentUserId, isAdmin, replyingToRootId,
  onDelete, onVote, onSetReply, onSubmitReply, isSubmitting,
}: {
  thread: ThreadData;
  currentUserId: number | undefined;
  isAdmin: boolean;
  replyingToRootId: number | null;
  onDelete: (id: number) => void;
  onVote: (id: number, type: "like" | "dislike") => void;
  onSetReply: (rootId: number | null) => void;
  onSubmitReply: (html: string, parentId: number) => void;
  isSubmitting: boolean;
}) {
  const isOpen = replyingToRootId === thread.root.id;

  return (
    <div className="py-4 border-b border-border last:border-0">
      {/* Root comment */}
      <CommentItem
        comment={thread.root}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onDelete={onDelete}
        onVote={onVote}
        onReply={() => onSetReply(isOpen ? null : thread.root.id)}
      />

      {/* Replies — indented with a vertical connector line */}
      {(thread.replies.length > 0 || isOpen) && (
        <div className="mt-3 ml-11 pl-4 border-l-2 border-border space-y-4">
          {thread.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={onDelete}
              onVote={onVote}
              onReply={() => onSetReply(isOpen && replyingToRootId === thread.root.id ? null : thread.root.id)}
            />
          ))}

          {/* Inline reply editor */}
          {isOpen && (
            <InlineReplyEditor
              replyToName={thread.root.user_name}
              onSubmit={(html) => onSubmitReply(html, thread.root.id)}
              onCancel={() => onSetReply(null)}
              isPending={isSubmitting}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline reply editor ───────────────────────────────────────────────────────

function InlineReplyEditor({ replyToName, onSubmit, onCancel, isPending }: {
  replyToName: string;
  onSubmit: (html: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapPlaceholder.configure({ placeholder: `Reply to ${replyToName}…` }),
    ],
    editorProps: {
      attributes: {
        class: "inline-reply-editor prose prose-sm max-w-none focus:outline-none min-h-[56px] px-3 pt-2.5 pb-1 text-sm text-foreground",
      },
    },
    autofocus: true,
  });

  const handleSubmit = () => {
    const text = editor?.getText() ?? "";
    if (!text.trim()) return;
    onSubmit(editor?.getHTML() ?? "");
    editor?.commands.clearContent();
  };

  return (
    <>
      <style>{`
        .inline-reply-editor.ProseMirror p { margin: 0 0 0.2em; }
        .inline-reply-editor.ProseMirror p:last-child { margin-bottom: 0; }
        .inline-reply-editor.ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); color: #9ca3af; pointer-events: none; float: left; height: 0;
        }
      `}</style>
      <div className="flex gap-2.5 items-start">
        <div className="flex-1 border border-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-brand focus-within:border-brand transition bg-card">
          <EditorContent editor={editor} />
          <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border bg-muted/60">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSubmit(); }}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-[#2a0d8a] disabled:opacity-40 transition"
            >
              <MessageSquare className="w-3 h-3" />
              Reply
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Comment editor ────────────────────────────────────────────────────────────

function Btn({ title, active, onClick, children }: {
  title: string; active?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "p-1.5 rounded transition",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function CommentEditor({ onSubmit, isPending }: {
  onSubmit: (html: string) => void;
  isPending: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapPlaceholder.configure({ placeholder: "Add a comment…" }),
    ],
    editorProps: {
      attributes: {
        class: "comment-editor prose prose-sm max-w-none focus:outline-none min-h-[72px] px-4 pt-3 pb-1 text-sm text-foreground",
      },
    },
  });

  const handleSubmit = () => {
    const text = editor?.getText() ?? "";
    if (!text.trim()) return;
    onSubmit(editor?.getHTML() ?? "");
    editor?.commands.clearContent();
  };

  return (
    <>
      <style>{`
        .comment-editor.ProseMirror p { margin: 0 0 0.25em; }
        .comment-editor.ProseMirror p:last-child { margin-bottom: 0; }
        .comment-editor.ProseMirror ul { list-style: disc; padding-left: 1.2em; }
        .comment-editor.ProseMirror ol { list-style: decimal; padding-left: 1.2em; }
        .comment-editor.ProseMirror a { color: #3b1fa3; text-decoration: underline; }
        .comment-editor.ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); color: #9ca3af; pointer-events: none; float: left; height: 0;
        }
      `}</style>
      <div className="border border-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-brand focus-within:border-brand transition">
        <EditorContent editor={editor} />
        <div className="flex items-center gap-0.5 px-3 py-2 border-t border-border bg-muted/50">
          <Btn title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="w-3.5 h-3.5" />
          </Btn>
          <Btn title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic className="w-3.5 h-3.5" />
          </Btn>
          <Btn title="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List className="w-3.5 h-3.5" />
          </Btn>
          <Btn title="Link" active={editor?.isActive("link")} onClick={() => {
            const url = window.prompt("URL:");
            if (url) editor?.chain().focus().setLink({ href: url }).run();
          }}>
            <Link2 className="w-3.5 h-3.5" />
          </Btn>
          <Btn title="Emoji" onClick={() => editor?.chain().focus().insertContent("😊").run()}>
            <Smile className="w-3.5 h-3.5" />
          </Btn>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleSubmit(); }}
            disabled={isPending}
            className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-[#2a0d8a] disabled:opacity-40 transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comment
          </button>
        </div>
      </div>
    </>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({ row, onClose, onVote, isAdmin, currentUserId, currentUserEmail, onStatusChange, onEdit }: {
  row: FeedbackRow;
  onClose: () => void;
  onVote: (id: number) => void;
  isAdmin: boolean;
  currentUserId: number | undefined;
  currentUserEmail: string | undefined;
  onStatusChange: (id: number, status: string) => void;
  onEdit: (id: number, data: { message?: string; subject?: string | null }) => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [commentSort, setCommentSort] = useState<"oldest" | "newest">("oldest");
  const [replyingToRootId, setReplyingToRootId] = useState<number | null>(null);
  const [viewMedia, setViewMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(row.subject ?? "");
  const isOwner = !!currentUserEmail && row.user_email === currentUserEmail;
  const canEdit = isOwner || isAdmin;

  const editEditor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, TiptapLink.configure({ openOnClick: false })],
    content: row.message,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[120px] px-4 pt-3 pb-1 text-sm text-foreground",
      },
    },
  });

  const startEditing = () => {
    setEditSubject(row.subject ?? "");
    editEditor?.commands.setContent(row.message);
    setIsEditing(true);
  };

  const saveEdit = () => {
    const html = editEditor?.getHTML() ?? "";
    if (editEditor?.getText().trim().length === 0) return;
    onEdit(row.id, { message: html, subject: editSubject.trim() || null });
    setIsEditing(false);
  };

  const { data: allComments = [] } = useQuery<FeedbackComment[]>({
    queryKey: ["feedback-comments", row.id],
    queryFn: () => feedbackApi.getComments(row.id).then((r) => r.data),
  });

  const userComments = allComments.filter((c) => !c.is_system);
  const activityItems = allComments.filter((c) => c.is_system);

  const threads = buildThreads(
    commentSort === "newest" ? [...userComments].reverse() : userComments,
  );

  const addCommentMutation = useMutation({
    mutationFn: ({ html, parentId }: { html: string; parentId?: number | null }) =>
      feedbackApi.addComment(row.id, html, parentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback-comments", row.id] });
      qc.invalidateQueries({ queryKey: ["feedback-list"] });
      setReplyingToRootId(null);
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (cid: number) => feedbackApi.deleteComment(row.id, cid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback-comments", row.id] });
      qc.invalidateQueries({ queryKey: ["feedback-list"] });
    },
  });

  const voteCommentMutation = useMutation({
    mutationFn: ({ cid, voteType }: { cid: number; voteType: "like" | "dislike" }) =>
      feedbackApi.voteComment(row.id, cid, voteType),
    onSuccess: (res, { cid }) => {
      const { user_vote, like_count, dislike_count } = res.data as {
        user_vote: "like" | "dislike" | null;
        like_count: number;
        dislike_count: number;
      };
      qc.setQueryData<FeedbackComment[]>(["feedback-comments", row.id], (old) =>
        old?.map((c) => c.id === cid ? { ...c, user_vote, like_count, dislike_count } : c) ?? []
      );
    },
  });

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <div
          className="relative z-10 w-full max-w-4xl bg-card rounded-2xl shadow-2xl border border-border max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-4 px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
            <VoteButton
              feedbackId={row.id}
              count={row.upvote_count}
              voted={row.user_has_voted}
              onVote={onVote}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", TYPE_STYLE[row.feedback_type] ?? TYPE_STYLE.general)}>
                  {TYPE_LABEL[row.feedback_type] ?? row.feedback_type}
                </span>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS_STYLE[row.status] ?? STATUS_STYLE.open)}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
              </div>
              {isEditing ? (
                <input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Subject (optional)"
                  className="w-full text-base font-bold text-foreground leading-snug border-b border-border focus:border-brand outline-none pb-0.5"
                />
              ) : (
                <h2 className="text-base font-bold text-foreground leading-snug">
                  {row.subject || row.message.replace(/<[^>]*>/g, "").slice(0, 80)}
                </h2>
              )}
            </div>
            {canEdit && !isEditing && (
              <button
                onClick={startEditing}
                className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-brand hover:bg-brand/5 rounded-lg transition"
              >
                Edit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-muted-foreground transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {/* Left: main content */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-border">
              {/* Message */}
              <div className="p-5 overflow-y-auto flex-shrink-0 max-h-80">
                {isEditing ? (
                  <div>
                    <div className="border border-border rounded-xl focus-within:border-brand transition">
                      <EditorContent editor={editEditor} />
                      <div className="flex items-center gap-1 px-3 py-2 border-t border-border">
                        <Btn title="Bold" active={editEditor?.isActive("bold")} onClick={() => editEditor?.chain().focus().toggleBold().run()}>
                          <Bold className="w-3.5 h-3.5" />
                        </Btn>
                        <Btn title="Italic" active={editEditor?.isActive("italic")} onClick={() => editEditor?.chain().focus().toggleItalic().run()}>
                          <Italic className="w-3.5 h-3.5" />
                        </Btn>
                        <Btn title="Bullet list" active={editEditor?.isActive("bulletList")} onClick={() => editEditor?.chain().focus().toggleBulletList().run()}>
                          <List className="w-3.5 h-3.5" />
                        </Btn>
                        <Btn title="Link" active={editEditor?.isActive("link")} onClick={() => {
                          const url = window.prompt("URL:");
                          if (url) editEditor?.chain().focus().setLink({ href: url }).run();
                        }}>
                          <Link2 className="w-3.5 h-3.5" />
                        </Btn>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-3.5 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-[#2a0d8a] transition"
                      >
                        Save changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: row.message }}
                  />
                )}

                {/* Attachments */}
                {row.attachments.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {row.attachments.map((a, i) => {
                      const url = attachUrl(a.path);
                      const video = isVideoPath(a.path);
                      return (
                        <button key={i} onClick={() => setViewMedia({ url, name: a.name, isVideo: video })}
                          className="group aspect-square rounded-lg overflow-hidden border border-border hover:border-brand bg-muted transition">
                          {video
                            ? <div className="w-full h-full flex items-center justify-center"><Video className="w-5 h-5 text-muted-foreground group-hover:text-brand" /></div>
                            : <img src={url} alt={a.name} className="w-full h-full object-cover" />
                          }
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex items-center border-t border-border px-5 flex-shrink-0">
                <div className="flex gap-4">
                  {(["comments", "activity"] as const).map((t) => {
                    const count = t === "comments" ? userComments.length : activityItems.length;
                    return (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                          "flex items-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition capitalize",
                          tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-muted-foreground",
                        )}
                      >
                        {t === "comments" ? <MessageSquare className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {t === "comments" ? "Comments" : "Activity"}
                        {count > 0 && (
                          <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]", tab === t ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground")}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {tab === "comments" && userComments.length > 1 && (
                  <button
                    onClick={() => setCommentSort((s) => s === "oldest" ? "newest" : "oldest")}
                    className="ml-auto flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-muted-foreground transition"
                  >
                    {commentSort === "newest"
                      ? <><ArrowDown className="w-3 h-3" />Newest</>
                      : <><ArrowUp className="w-3 h-3" />Oldest</>
                    }
                  </button>
                )}
              </div>

              {/* Comment list */}
              <div className="flex-1 overflow-y-auto px-5 min-h-0">
                {tab === "comments" ? (
                  threads.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No comments yet — be the first!</p>
                  ) : (
                    threads.map((thread) => (
                      <CommentThread
                        key={thread.root.id}
                        thread={thread}
                        currentUserId={currentUserId}
                        isAdmin={isAdmin}
                        replyingToRootId={replyingToRootId}
                        onDelete={(cid) => deleteCommentMutation.mutate(cid)}
                        onVote={(cid, voteType) => voteCommentMutation.mutate({ cid, voteType })}
                        onSetReply={setReplyingToRootId}
                        onSubmitReply={(html, parentId) => addCommentMutation.mutate({ html, parentId })}
                        isSubmitting={addCommentMutation.isPending}
                      />
                    ))
                  )
                ) : (
                  activityItems.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No activity yet</p>
                  ) : (
                    activityItems.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 py-2.5 text-[11px] text-muted-foreground border-b border-border last:border-0">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <ArrowUp className="w-2.5 h-2.5 text-muted-foreground" />
                        </div>
                        <span dangerouslySetInnerHTML={{
                          __html: c.content.replace(/\*\*(.*?)\*\*/g, "<strong class='text-muted-foreground'>$1</strong>"),
                        }} />
                        <span className="ml-auto text-muted-foreground/60 whitespace-nowrap">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    ))
                  )
                )}
              </div>

              {/* New top-level comment editor */}
              {tab === "comments" && (
                <div className="px-4 pb-4 pt-2 border-t border-border flex-shrink-0">
                  <CommentEditor
                    onSubmit={(html) => addCommentMutation.mutate({ html, parentId: null })}
                    isPending={addCommentMutation.isPending && replyingToRootId === null}
                  />
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="w-60 flex-shrink-0 p-5 space-y-5 text-xs overflow-y-auto border-l border-border">
              {/* Status */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Status</p>
                {isAdmin ? (
                  <div className="relative">
                    <button
                      onClick={() => setStatusOpen((v) => !v)}
                      className={cn("w-full text-left px-2.5 py-1.5 rounded-lg font-semibold text-[11px] flex items-center justify-between", STATUS_STYLE[row.status] ?? STATUS_STYLE.open)}
                    >
                      {STATUS_LABEL[row.status] ?? row.status}
                      <ChevronUp className={cn("w-3 h-3 transition-transform", statusOpen ? "" : "rotate-180")} />
                    </button>
                    {statusOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-lg shadow-lg z-10 py-1 overflow-hidden">
                        {ALL_STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() => { onStatusChange(row.id, s); setStatusOpen(false); }}
                            className={cn(
                              "w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted transition font-medium",
                              s === row.status ? "text-brand font-semibold" : "text-foreground",
                            )}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={cn("px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-block", STATUS_STYLE[row.status] ?? STATUS_STYLE.open)}>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                )}
              </div>

              {/* Board */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Board</p>
                <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", TYPE_STYLE[row.feedback_type] ?? TYPE_STYLE.general)}>
                  {TYPE_LABEL[row.feedback_type] ?? row.feedback_type}
                </span>
              </div>

              {/* Date */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Date</p>
                <p className="text-muted-foreground">
                  {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                </p>
              </div>

              {/* Author */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Author</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-brand/10 text-brand text-[9px] font-bold flex items-center justify-center">
                    {initials(row.user_email ?? "?")}
                  </div>
                  <span className="text-muted-foreground truncate">{row.user_email?.split("@")[0]}</span>
                </div>
              </div>

              {/* Upvotes */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Upvoters</p>
                <div className="flex items-center gap-1.5">
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground font-semibold">{row.upvote_count}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMedia && (
        <MediaViewer
          url={viewMedia.url}
          name={viewMedia.name}
          isVideo={viewMedia.isVideo}
          onClose={() => setViewMedia(null)}
        />
      )}
    </>
  );
}

// ── Feedback card ─────────────────────────────────────────────────────────────

function FeedbackCard({ row, onOpen, onVote }: {
  row: FeedbackRow;
  onOpen: (row: FeedbackRow) => void;
  onVote: (id: number) => void;
}) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-4 flex gap-3 hover:border-border hover:shadow-sm transition cursor-pointer"
      onClick={() => onOpen(row)}
    >
      <VoteButton feedbackId={row.id} count={row.upvote_count} voted={row.user_has_voted} onVote={onVote} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", TYPE_STYLE[row.feedback_type] ?? TYPE_STYLE.general)}>
            {TYPE_LABEL[row.feedback_type] ?? row.feedback_type}
          </span>
          {row.status !== "open" && (
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS_STYLE[row.status])}>
              {STATUS_LABEL[row.status]}
            </span>
          )}
        </div>

        <p className="text-sm font-semibold text-foreground truncate">
          {row.subject || row.message.replace(/<[^>]*>/g, "").slice(0, 80)}
        </p>
        {row.subject && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {row.message.replace(/<[^>]*>/g, "")}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          <span>{row.user_email?.split("@")[0]}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span>
          <span className="ml-auto flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {row.comment_count}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Roadmap ───────────────────────────────────────────────────────────────────

const ROADMAP_COLS = [
  {
    id: "backlog",
    label: "Backlog",
    statuses: ["open"],
    Icon: Inbox,
    iconClass: "text-muted-foreground",
    labelClass: "text-foreground",
    countClass: "bg-muted text-muted-foreground",
    accentClass: "border-t-gray-300",
  },
  {
    id: "next_up",
    label: "Next Up",
    statuses: ["planned"],
    Icon: ArrowUp,
    iconClass: "text-brand",
    labelClass: "text-brand",
    countClass: "bg-brand/10 text-brand",
    accentClass: "border-t-brand",
  },
  {
    id: "in_progress",
    label: "In Progress",
    statuses: ["in_review", "in_progress"],
    Icon: Zap,
    iconClass: "text-blue-500",
    labelClass: "text-blue-700",
    countClass: "bg-blue-100 text-blue-700",
    accentClass: "border-t-blue-500",
  },
  {
    id: "done",
    label: "Done",
    statuses: ["completed", "closed"],
    Icon: CheckCircle2,
    iconClass: "text-emerald-500",
    labelClass: "text-emerald-700",
    countClass: "bg-emerald-100 text-emerald-700",
    accentClass: "border-t-emerald-500",
  },
];

function RoadmapCard({
  row, onOpen, isAdmin, onDragStart, isDragging,
}: {
  row: FeedbackRow;
  onOpen: (r: FeedbackRow) => void;
  isAdmin: boolean;
  onDragStart: (id: number) => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(row.id);
      }}
      onClick={() => onOpen(row)}
      className={cn(
        "bg-card border border-border rounded-xl p-3.5 transition group select-none",
        isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging ? "opacity-40 scale-95 shadow-lg border-brand" : "hover:border-border hover:shadow-sm",
      )}
    >
      <p className="text-sm font-semibold text-foreground leading-snug mb-2.5 group-hover:text-brand transition-colors line-clamp-3">
        {row.subject || row.message.replace(/<[^>]*>/g, "").slice(0, 100)}
      </p>
      <div className="flex items-center gap-2">
        <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", TYPE_STYLE[row.feedback_type] ?? TYPE_STYLE.general)}>
          {TYPE_LABEL[row.feedback_type] ?? row.feedback_type}
        </span>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{row.comment_count}</span>
          <span className="flex items-center gap-1"><ChevronUp className="w-3 h-3" />{row.upvote_count}</span>
        </div>
      </div>
    </div>
  );
}

function RoadmapView({
  rows, onOpen, isAdmin, onStatusChange,
}: {
  rows: FeedbackRow[];
  onOpen: (r: FeedbackRow) => void;
  isAdmin: boolean;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const handleDrop = (targetStatus: string) => {
    if (draggedId !== null) {
      const row = rows.find((r) => r.id === draggedId);
      if (row && !ROADMAP_COLS.find((c) => c.statuses.includes(targetStatus) && c.statuses.includes(row.status))) {
        onStatusChange(draggedId, targetStatus);
      }
    }
    setDraggedId(null);
    setOverCol(null);
  };

  return (
    <div
      className="flex gap-5 overflow-x-auto pb-6 -mx-1 px-1"
      onDragEnd={() => { setDraggedId(null); setOverCol(null); }}
    >
      {ROADMAP_COLS.map((col) => {
        const targetStatus = col.statuses[0];
        const colRows = rows.filter((r) => col.statuses.includes(r.status));
        const isOver = overCol === col.id && isAdmin;
        const isDragSource = draggedId !== null && colRows.some((r) => r.id === draggedId);

        return (
          <div
            key={col.id}
            className={cn(
              "flex-shrink-0 w-72 flex flex-col border-t-4 pt-4 rounded-t-sm transition-colors",
              col.accentClass,
            )}
            onDragOver={(e) => {
              if (!isAdmin) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverCol(col.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            onDrop={() => handleDrop(targetStatus)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 mb-4 px-0.5">
              <col.Icon className={cn("w-4 h-4", col.iconClass)} />
              <span className={cn("text-sm font-bold", col.labelClass)}>{col.label}</span>
              <span className={cn("ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums", col.countClass)}>
                {colRows.length}
              </span>
            </div>

            {/* Drop zone */}
            <div className={cn(
              "flex flex-col gap-3 flex-1 rounded-xl p-2 -m-2 transition-colors min-h-[120px]",
              isOver && !isDragSource ? "bg-brand/5 border-2 border-dashed border-brand/30" : "border-2 border-transparent",
            )}>
              {colRows.length === 0 && !isOver ? (
                <div className={cn(
                  "border-2 border-dashed rounded-xl py-10 text-center text-xs transition-colors",
                  isAdmin ? "border-border text-muted-foreground/60" : "border-border text-muted-foreground/60",
                )}>
                  {isAdmin ? "Drop here" : "No items"}
                </div>
              ) : (
                colRows.map((row) => (
                  <RoadmapCard
                    key={row.id}
                    row={row}
                    onOpen={onOpen}
                    isAdmin={isAdmin}
                    onDragStart={setDraggedId}
                    isDragging={draggedId === row.id}
                  />
                ))
              )}
              {/* Empty drop target when column has cards */}
              {isOver && !isDragSource && colRows.length > 0 && (
                <div className="border-2 border-dashed border-brand/40 rounded-xl py-4 text-center text-xs text-brand/50">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Changelog ─────────────────────────────────────────────────────────────────

function ChangelogView({ rows, onOpen }: { rows: FeedbackRow[]; onOpen: (r: FeedbackRow) => void }) {
  const shipped = rows
    .filter((r) => r.status === "completed" || r.status === "closed")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (shipped.length === 0) {
    return (
      <div className="max-w-2xl text-center py-20 text-muted-foreground">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-medium">No shipped features yet.</p>
        <p className="text-xs mt-1 text-muted-foreground/60">Completed feature requests will appear here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-3">
      {shipped.map((row) => (
        <div
          key={row.id}
          className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-border hover:shadow-sm transition group"
          onClick={() => onOpen(row)}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS_STYLE[row.status])}>
              {STATUS_LABEL[row.status]}
            </span>
            <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", TYPE_STYLE[row.feedback_type] ?? TYPE_STYLE.general)}>
              {TYPE_LABEL[row.feedback_type] ?? row.feedback_type}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
            {row.subject || row.message.replace(/<[^>]*>/g, "").slice(0, 80)}
          </h3>
          {row.subject && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {row.message.replace(/<[^>]*>/g, "")}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><ChevronUp className="w-3 h-3" />{row.upvote_count} upvotes</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{row.comment_count} comments</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PageTab = "requests" | "roadmap" | "changelog";
type Tab = "new" | "top" | "trending";
type TypeFilter = "all" | "bug" | "feature" | "general" | "other";

export default function FeedbackPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selected, setSelected] = useState<FeedbackRow | null>(null);
  const [pageTab, setPageTab] = useState<PageTab>("requests");
  const [tab, setTab] = useState<Tab>("new");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const { data, isLoading } = useQuery<FeedbackRow[]>({
    queryKey: ["feedback-list"],
    queryFn: () => feedbackApi.list().then((r) => r.data),
  });

  const voteMutation = useMutation({
    mutationFn: (id: number) => feedbackApi.vote(id),
    onSuccess: (res, id) => {
      const { voted, upvote_count } = res.data as { voted: boolean; upvote_count: number };
      qc.setQueryData<FeedbackRow[]>(["feedback-list"], (old) =>
        old?.map((r) => r.id === id ? { ...r, user_has_voted: voted, upvote_count } : r) ?? []
      );
      if (selected?.id === id) {
        setSelected((prev) => prev ? { ...prev, user_has_voted: voted, upvote_count } : prev);
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      feedbackApi.updateStatus(id, status),
    onSuccess: (res) => {
      const updated = res.data as FeedbackRow;
      qc.setQueryData<FeedbackRow[]>(["feedback-list"], (old) =>
        old?.map((r) => r.id === updated.id ? { ...r, status: updated.status } : r) ?? []
      );
      if (selected?.id === updated.id) {
        setSelected((prev) => prev ? { ...prev, status: updated.status } : prev);
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, message, subject }: { id: number; message?: string; subject?: string | null }) =>
      feedbackApi.update(id, { message, subject }),
    onSuccess: (res) => {
      const updated = res.data as FeedbackRow;
      qc.setQueryData<FeedbackRow[]>(["feedback-list"], (old) =>
        old?.map((r) => r.id === updated.id ? { ...r, message: updated.message, subject: updated.subject } : r) ?? []
      );
      if (selected?.id === updated.id) {
        setSelected((prev) => prev ? { ...prev, message: updated.message, subject: updated.subject } : prev);
      }
    },
  });

  const rows = data ?? [];

  const filtered = rows
    .filter((r) => typeFilter === "all" || r.feedback_type === typeFilter)
    .sort((a, b) => {
      if (tab === "top") return b.upvote_count - a.upvote_count;
      if (tab === "trending") {
        const score = (r: FeedbackRow) =>
          r.upvote_count * 2 + r.comment_count - (Date.now() - new Date(r.created_at).getTime()) / 1e9;
        return score(b) - score(a);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const TAB_ICONS = { new: Clock, top: ChevronUp, trending: Flame } as const;

  const PAGE_TABS = [
    { key: "requests" as const, label: "Feature Requests", Icon: LayoutList },
    { key: "roadmap"  as const, label: "Roadmap",          Icon: Kanban },
    { key: "changelog" as const, label: "Changelog",       Icon: BookOpen },
  ];

  return (
    <div className={cn("p-8 mx-auto transition-all", pageTab === "roadmap" ? "max-w-[1300px]" : "max-w-3xl")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Feature Requests</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{rows.length} submission{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setSubmitOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand text-white hover:bg-[#2a0d8a] transition"
        >
          <Plus className="w-4 h-4" />
          Create a New Request
        </button>
      </div>

      {/* Page-level tabs */}
      <div className="flex items-center border-b border-border mb-6 gap-1">
        {PAGE_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setPageTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition",
              pageTab === key
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Feature Requests tab ── */}
      {pageTab === "requests" && (
        <>
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
              {(["new", "top", "trending"] as Tab[]).map((t) => {
                const Icon = TAB_ICONS[t];
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition capitalize",
                      tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t === "new" ? "New" : t === "top" ? "Top" : "Trending"}
                  </button>
                );
              })}
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="ml-auto px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground bg-card focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">All Types</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {rows.length === 0 ? "No feedback submitted yet." : "No results for this filter."}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((row) => (
                <FeedbackCard
                  key={row.id}
                  row={row}
                  onOpen={setSelected}
                  onVote={(id) => voteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Roadmap tab ── */}
      {pageTab === "roadmap" && (
        isLoading
          ? <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
          : <RoadmapView
              rows={rows}
              onOpen={setSelected}
              isAdmin={user?.is_admin ?? false}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            />
      )}

      {/* ── Changelog tab ── */}
      {pageTab === "changelog" && (
        isLoading
          ? <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
          : <ChangelogView rows={rows} onOpen={setSelected} />
      )}

      {/* Submit modal */}
      <FeedbackModal
        open={submitOpen}
        onClose={() => { setSubmitOpen(false); qc.invalidateQueries({ queryKey: ["feedback-list"] }); }}
      />

      {/* Detail modal */}
      {selected && (
        <DetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onVote={(id) => voteMutation.mutate(id)}
          isAdmin={user?.is_admin ?? false}
          currentUserId={user?.id ? Number(user.id) : undefined}
          currentUserEmail={user?.email}
          onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
          onEdit={(id, data) => editMutation.mutate({ id, ...data })}
        />
      )}
    </div>
  );
}
