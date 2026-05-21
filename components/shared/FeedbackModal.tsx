"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  X, Star, Video, Trash2,
  Bold, Italic, List, Link2,
  Image as ImageIcon, Smile,
  ListOrdered, Quote,
} from "lucide-react";
import { feedbackApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "feature" | "general" | "other";

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "bug",     label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "other",   label: "Other" },
];

const ACCEPTED_IMAGE = "image/jpeg,image/png,image/gif,image/webp";
const ACCEPTED_VIDEO = "video/mp4,video/webm,video/quicktime";

interface SelectedFile { file: File; preview: string | null }
interface FeedbackModalProps { open: boolean; onClose: () => void }

function ToolbarBtn({
  active, title, onClick, children,
}: {
  active?: boolean; title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "p-1.5 rounded-md transition text-sm",
        active
          ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800",
      )}
    >
      {children}
    </button>
  );
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const pathname     = usePathname();
  const imageRef     = useRef<HTMLInputElement>(null);
  const videoRef     = useRef<HTMLInputElement>(null);

  const [type, setType]                   = useState<FeedbackType>("general");
  const [rating, setRating]               = useState<number | null>(null);
  const [hover, setHover]                 = useState<number | null>(null);
  const [subject, setSubject]             = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragOver, setDragOver]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [done, setDone]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Post description…" }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] max-h-[380px] overflow-y-auto px-4 pt-3 pb-2 text-gray-800 dark:text-gray-100",
      },
    },
  });

  if (!open) return null;

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    let err: string | null = null;
    const valid: SelectedFile[] = [];
    for (const f of list) {
      if (f.size > 100 * 1024 * 1024) { err = `"${f.name}" exceeds 100 MB.`; continue; }
      if (f.type.startsWith("image/")) {
        // Embed image inline in editor
        const url = URL.createObjectURL(f);
        editor?.chain().focus().setImage({ src: url }).run();
        valid.push({ file: f, preview: url });
      } else {
        valid.push({ file: f, preview: null });
      }
    }
    if (err) setError(err);
    setSelectedFiles((p) => [...p, ...valid]);
  };

  const removeFile = (i: number) => {
    setSelectedFiles((p) => {
      const { preview } = p[i];
      if (preview) URL.revokeObjectURL(preview);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const html    = editor?.getHTML() ?? "";
    const text    = editor?.getText() ?? "";
    if (text.trim().length < 5) { setError("Description must be at least 5 characters."); return; }
    if (type === "other" && !subject.trim()) { setError("Please specify what kind of feedback this is."); return; }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("feedback_type", type);
      if (rating) fd.append("rating", String(rating));
      if (subject.trim()) fd.append("subject", subject.trim());
      fd.append("message", html);
      if (pathname) fd.append("page", pathname);
      selectedFiles.forEach(({ file }) => fd.append("attachments", file));
      await feedbackApi.submit(fd);
      setDone(true);
    } catch {
      setError("Could not submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setType("general"); setRating(null); setHover(null);
    setSubject(""); editor?.commands.clearContent();
    selectedFiles.forEach(({ preview }) => { if (preview) URL.revokeObjectURL(preview); });
    setSelectedFiles([]); setDone(false); setError(null);
    onClose();
  };

  const setLink = () => {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

  return (
    <>
      {/* Tiptap prose styles scoped here */}
      <style>{`
        .tiptap-canvas .ProseMirror p { margin: 0 0 0.5em; }
        .tiptap-canvas .ProseMirror p:last-child { margin-bottom: 0; }
        .tiptap-canvas .ProseMirror ul { list-style: disc; padding-left: 1.25em; margin: 0.25em 0; }
        .tiptap-canvas .ProseMirror ol { list-style: decimal; padding-left: 1.25em; margin: 0.25em 0; }
        .tiptap-canvas .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 0.75em; color: #6b7280; margin: 0.25em 0; }
        .tiptap-canvas .ProseMirror strong { font-weight: 600; }
        .tiptap-canvas .ProseMirror em { font-style: italic; }
        .tiptap-canvas .ProseMirror a { color: #3b1fa3; text-decoration: underline; }
        .tiptap-canvas .ProseMirror img { max-width: 100%; border-radius: 6px; margin: 4px 0; }
        .tiptap-canvas .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

        <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Create a New Request</h2>
            <button onClick={handleClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {done ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Thank you!</p>
              <p className="mt-1 text-xs text-gray-400">Your request has been submitted.</p>
              <button onClick={handleClose} className="mt-5 px-5 py-2 text-xs font-medium rounded-lg bg-brand text-white hover:bg-[#2a0d8a] transition">Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4 flex-1">

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Type</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TYPES.map((t) => (
                    <button key={t.value} type="button" onClick={() => setType(t.value)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition",
                        type === t.value
                          ? "bg-brand border-brand text-white"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-brand hover:text-brand",
                      )}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Rating <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button"
                      onClick={() => setRating(rating === star ? null : star)}
                      onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(null)}>
                      <Star className={cn("w-5 h-5 transition",
                        (hover ?? rating ?? 0) >= star ? "text-amber-400 fill-amber-400" : "text-gray-300")} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Title {type === "other" ? <span className="text-brand">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
                </label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                  maxLength={255} placeholder="Brief title of your request…"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition" />
              </div>

              {/* Description — Tiptap canvas */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Description</label>
                <div
                  className={cn(
                    "tiptap-canvas rounded-xl border overflow-hidden transition focus-within:ring-2 focus-within:ring-brand focus-within:border-brand",
                    dragOver ? "border-brand bg-brand/5" : "border-gray-200 dark:border-gray-700",
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  {/* Editor area */}
                  <EditorContent editor={editor} />

                  {/* Video file thumbnails (images are embedded in editor) */}
                  {selectedFiles.some((f) => !f.preview) && (
                    <div className="flex flex-wrap gap-2 px-4 pb-2">
                      {selectedFiles.filter((f) => !f.preview).map(({ file }, i) => (
                        <div key={i} className="relative group flex items-center gap-2 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-600">
                          <Video className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="max-w-[120px] truncate">{file.name}</span>
                          <button type="button" onClick={() => removeFile(
                            selectedFiles.findIndex((sf) => sf.file === file)
                          )} className="text-gray-300 hover:text-red-500 transition">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Toolbar */}
                  <div className="flex items-center gap-0.5 px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <ToolbarBtn title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
                      <Bold className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                      <Italic className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn title="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                      <List className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn title="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                      <ListOrdered className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn title="Blockquote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                      <Quote className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn title="Link" active={editor?.isActive("link")} onClick={setLink}>
                      <Link2 className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

                    <ToolbarBtn title="Attach image" onClick={() => imageRef.current?.click()}>
                      <ImageIcon className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn title="Attach video" onClick={() => videoRef.current?.click()}>
                      <Video className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn title="Emoji" onClick={() => editor?.chain().focus().insertContent("😊").run()}>
                      <Smile className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    <span className="ml-auto text-[10px] text-gray-300 tabular-nums">
                      {editor?.getText().length ?? 0}/2000
                    </span>
                  </div>
                </div>
              </div>

              {/* Hidden file inputs */}
              <input ref={imageRef} type="file" accept={ACCEPTED_IMAGE} multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }} />
              <input ref={videoRef} type="file" accept={ACCEPTED_VIDEO} multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }} />

              {error && <p className="text-xs text-red-500">{error}</p>}

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-1 pb-1">
                <button type="button" onClick={handleClose}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-[#2a0d8a] transition disabled:opacity-50">
                  {loading ? "Submitting…" : "Submit Post"}
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </>
  );
}
