"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Star, Upload, Video, Trash2 } from "lucide-react";
import { feedbackApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "feature" | "general" | "other";

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "bug",     label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "other",   label: "Other" },
];

const ACCEPTED = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime";

interface SelectedFile {
  file: File;
  preview: string | null; // object URL for images, null for video
}

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const pathname  = usePathname();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [type, setType]                   = useState<FeedbackType>("general");
  const [rating, setRating]               = useState<number | null>(null);
  const [hover, setHover]                 = useState<number | null>(null);
  const [subject, setSubject]             = useState("");
  const [message, setMessage]             = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragOver, setDragOver]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [done, setDone]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  if (!open) return null;

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    let err: string | null = null;
    const valid: SelectedFile[] = [];
    for (const f of list) {
      if (f.size > 100 * 1024 * 1024) { err = `"${f.name}" exceeds 100 MB.`; continue; }
      valid.push({ file: f, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
    }
    if (err) setError(err);
    setSelectedFiles((p) => [...p, ...valid]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (i: number) => {
    setSelectedFiles((p) => {
      const { preview } = p[i];
      if (preview) URL.revokeObjectURL(preview);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const clearAll = () => {
    selectedFiles.forEach(({ preview }) => { if (preview) URL.revokeObjectURL(preview); });
    setSelectedFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "other" && !subject.trim()) { setError("Please specify what kind of feedback this is."); return; }
    if (message.trim().length < 5) { setError("Message must be at least 5 characters."); return; }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("feedback_type", type);
      if (rating) fd.append("rating", String(rating));
      if (subject.trim()) fd.append("subject", subject.trim());
      fd.append("message", message.trim());
      if (pathname) fd.append("page", pathname);
      selectedFiles.forEach(({ file }) => fd.append("attachments", file));
      await feedbackApi.submit(fd);
      setDone(true);
    } catch {
      setError("Could not submit feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setType("general"); setRating(null); setHover(null);
    setSubject(""); setMessage(""); clearAll(); setDone(false); setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Send Feedback</h2>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Thank you for your feedback!</p>
            <p className="mt-1 text-xs text-gray-400">It helps us make AutoEDA better.</p>
            <button onClick={handleClose} className="mt-5 px-4 py-2 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Type</label>
              <div className="flex gap-1.5 flex-wrap">
                {TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      type === t.value ? "bg-amber-500 border-amber-500 text-white"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-amber-400 hover:text-amber-600")}>
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
                    <Star className={cn("w-5 h-5 transition-colors",
                      (hover ?? rating ?? 0) >= star ? "text-amber-400 fill-amber-400" : "text-gray-300 dark:text-gray-600")} />
                  </button>
                ))}
              </div>
            </div>

            {/* Subject / Other specify */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {type === "other" ? (
                  <>Please specify <span className="text-amber-500">*</span></>
                ) : (
                  <>Subject <span className="text-gray-400 font-normal">(optional)</span></>
                )}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={255}
                placeholder={type === "other" ? "Describe what kind of feedback this is…" : "Brief summary of your feedback…"}
                className={cn(
                  "w-full px-3 py-2 text-xs rounded-lg border bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 transition",
                  type === "other" && !subject.trim()
                    ? "border-amber-300 focus:ring-amber-400 focus:border-amber-400"
                    : "border-gray-200 dark:border-gray-700 focus:ring-amber-400 focus:border-amber-400"
                )}
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                rows={3} maxLength={2000} placeholder="Tell us what's on your mind…"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition" />
              <p className="text-[10px] text-gray-400 text-right mt-0.5">{message.length}/2000</p>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Attachments <span className="text-gray-400 font-normal">(images or videos, max 100 MB each)</span>
              </label>

              {/* Drop zone — always visible, appends files */}
              <div
                className={cn("flex flex-col items-center justify-center gap-1.5 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  dragOver ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-amber-300 hover:bg-gray-50 dark:hover:bg-gray-800")}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className="w-4 h-4 text-gray-400" />
                <p className="text-[11px] text-gray-500">Drop files here or <span className="text-amber-600 font-medium">click to browse</span></p>
              </div>

              <input ref={fileRef} type="file" accept={ACCEPTED} multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }} />

              {/* Selected file list */}
              {selectedFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {selectedFiles.map(({ file, preview }, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      {preview ? (
                        <img src={preview} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0 border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <Video className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-400">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                      </div>
                      <button type="button" onClick={() => removeFile(i)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1 pb-1">
              <button type="button" onClick={handleClose}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50">
                {loading ? "Sending…" : "Send Feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
