"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import DOMPurify from "isomorphic-dompurify";
import { docsApi, datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageSpinner } from "@/components/shared/LoadingBar";
import {
  Pencil, Trash2, Save, X, Database, Paperclip, Download,
  Upload, ExternalLink, Search,
  Bold, Italic, List, ListOrdered, Quote, Link2,
} from "lucide-react";

function ToolbarBtn({
  active, title, onClick, children,
}: { active?: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "p-1.5 rounded-md transition text-sm",
        active ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      )}
    >
      {children}
    </button>
  );
}

interface LinkedDataset { id: number; name: string; row_count?: number | null; column_count?: number | null; workspace_id: number }
interface Attachment { id: number; filename: string; file_size_bytes: number; uploaded_by_name?: string | null }
interface Category { id: number; name: string }
interface Article {
  id: number;
  category_id: number;
  title: string;
  summary?: string | null;
  content: string;
  created_by: number;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  updated_at: string;
  datasets: LinkedDataset[];
  attachments: Attachment[];
}
interface DatasetSearchResult { id: number; name: string; workspace_id: number; row_count?: number | null }

const MAX_ATTACHMENT_MB = 25;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function isContentEmpty(html: string): boolean {
  return !html || !html.replace(/<[^>]*>/g, "").trim();
}

export default function ArticleDetailPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const id = Number(articleId);

  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [linkedDatasets, setLinkedDatasets] = useState<LinkedDataset[]>([]);
  const [datasetQuery, setDatasetQuery] = useState("");
  const [datasetResults, setDatasetResults] = useState<DatasetSearchResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [downloadingDatasetId, setDownloadingDatasetId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: article, isLoading } = useQuery<Article>({
    queryKey: queryKeys.docs.article(id),
    queryFn: () => docsApi.getArticle(id).then((r) => r.data),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: queryKeys.docs.categories(),
    queryFn: () => docsApi.listCategories().then((r) => r.data),
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Business use case, project use case, anything worth knowing…" }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[320px] max-h-[520px] overflow-y-auto px-4 pt-3 pb-2 text-gray-800",
      },
    },
  });

  useEffect(() => {
    if (!article || editing) return; // never clobber in-progress edits — e.g. an
    // attachment upload refetches the article in the background while editing
    setTitle(article.title);
    setSummary(article.summary ?? "");
    setCategoryId(article.category_id);
    setLinkedDatasets(article.datasets);
    editor?.commands.setContent(article.content || "");
  }, [article, editing, editor]);

  useEffect(() => {
    if (!editing || !datasetQuery.trim()) {
      setDatasetResults([]);
      return;
    }
    const t = setTimeout(() => {
      docsApi.searchDatasets(datasetQuery.trim()).then((r) => setDatasetResults(r.data));
    }, 250);
    return () => clearTimeout(t);
  }, [datasetQuery, editing]);

  const canModify = !!user && (user.is_admin || String(article?.created_by) === user.id);

  const setLink = () => {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

  const save = async () => {
    if (!article) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await docsApi.updateArticle(article.id, {
        category_id: categoryId ?? article.category_id,
        title: title.trim() || "Untitled article",
        summary: summary.trim(),
        content: editor?.getHTML() ?? "",
        dataset_ids: linkedDatasets.map((d) => d.id),
      });
      queryClient.setQueryData(queryKeys.docs.article(id), res.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.articles(categoryId ?? article.category_id) });
      setEditing(false);
      router.replace(`/library/articles/${id}`);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setSaveError(detail ?? "Failed to save — your edits are still here, try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!article) return;
    if (!confirm(`Delete "${article.title}"? This can't be undone.`)) return;
    try {
      await docsApi.deleteArticle(article.id);
      router.push(`/library/${article.category_id}`);
    } catch {
      setSaveError("Failed to delete this article. Please try again.");
    }
  };

  const uploadFile = async (file: File) => {
    setAttachmentError(""); setSaveError("");
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setAttachmentError(`"${file.name}" is over the ${MAX_ATTACHMENT_MB}MB limit.`);
      return;
    }
    setUploading(true);
    try {
      const res = await docsApi.uploadAttachment(id, file);
      // Patch the cache directly instead of refetching the whole article —
      // instant, and never touches the title/content/etc the user is editing.
      queryClient.setQueryData<Article>(queryKeys.docs.article(id), (prev) =>
        prev ? { ...prev, attachments: [...prev.attachments, res.data] } : prev
      );
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setAttachmentError(detail ?? `Failed to upload "${file.name}". Please try again.`);
    } finally {
      setUploading(false);
    }
  };

  const downloadAttachment = async (att: Attachment) => {
    setAttachmentError(""); setSaveError("");
    setDownloadingId(att.id);
    try {
      const res = await docsApi.downloadAttachment(att.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = att.filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setAttachmentError(`Failed to download "${att.filename}".`);
    } finally {
      setDownloadingId(null);
    }
  };

  const removeAttachment = async (att: Attachment) => {
    setAttachmentError(""); setSaveError("");
    setDeletingId(att.id);
    try {
      await docsApi.deleteAttachment(att.id);
      queryClient.setQueryData<Article>(queryKeys.docs.article(id), (prev) =>
        prev ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== att.id) } : prev
      );
    } catch {
      setAttachmentError(`Failed to remove "${att.filename}".`);
    } finally {
      setDeletingId(null);
    }
  };

  const downloadDataset = async (ds: LinkedDataset) => {
    setAttachmentError(""); setSaveError("");
    setDownloadingDatasetId(ds.id);
    try {
      const res = await datasetsApi.export(String(ds.id));
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = `${ds.name}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setAttachmentError(`Failed to download "${ds.name}". You may not have access to it.`);
    } finally {
      setDownloadingDatasetId(null);
    }
  };

  if (isLoading || !article) return <div className="p-8 max-w-4xl mx-auto"><PageSpinner /></div>;

  const category = categories?.find((c) => c.id === article.category_id);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Tiptap prose styles — same canvas styling as the feedback editor */}
      <style>{`
        .tiptap-canvas .ProseMirror p { margin: 0 0 0.5em; }
        .tiptap-canvas .ProseMirror p:last-child { margin-bottom: 0; }
        .tiptap-canvas .ProseMirror ul { list-style: disc; padding-left: 1.25em; margin: 0.25em 0; }
        .tiptap-canvas .ProseMirror ol { list-style: decimal; padding-left: 1.25em; margin: 0.25em 0; }
        .tiptap-canvas .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 0.75em; color: #6b7280; margin: 0.25em 0; }
        .tiptap-canvas .ProseMirror strong { font-weight: 600; }
        .tiptap-canvas .ProseMirror em { font-style: italic; }
        .tiptap-canvas .ProseMirror a { color: #3b1fa3; text-decoration: underline; }
        .tiptap-canvas .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>

      <Breadcrumb
        items={[
          { label: "Dataset Library", href: "/library" },
          { label: category?.name ?? "Category", href: `/library/${article.category_id}` },
          { label: article.title },
        ]}
      />

      <div className="flex items-start justify-between gap-4 mt-4 mb-6">
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold text-gray-900 flex-1 border-b border-gray-200 focus:outline-none focus:border-brand pb-1"
            placeholder="Article title"
          />
        ) : (
          <div>
            <h1 className="text-xl font-bold text-gray-900">{article.title}</h1>
            <p className="text-xs text-gray-400 mt-1">
              {article.created_by_name && `Created by ${article.created_by_name} · `}
              Last updated {new Date(article.updated_at).toLocaleString()}
              {article.updated_by_name && ` by ${article.updated_by_name}`}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); router.replace(`/library/articles/${id}`); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-[#2a0d8a] transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition"
                title="Anyone can edit this article"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              {canModify && (
                <button
                  onClick={remove}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {(saveError || attachmentError) && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {saveError || attachmentError}
        </div>
      )}

      {editing && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-xs text-gray-500 flex-shrink-0">Category</label>
          <select
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {editing ? (
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One-line summary (shown in article lists)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />
      ) : (
        article.summary && <p className="text-sm text-gray-500 mb-4">{article.summary}</p>
      )}

      {/* Linked datasets */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datasets</h3>

        {editing && (
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={datasetQuery}
              onChange={(e) => setDatasetQuery(e.target.value)}
              placeholder="Search datasets to link..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {datasetResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {datasetResults
                  .filter((r) => !linkedDatasets.some((d) => d.id === r.id))
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setLinkedDatasets((prev) => [...prev, { id: r.id, name: r.name, row_count: r.row_count, workspace_id: r.workspace_id }]);
                        setDatasetQuery("");
                        setDatasetResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Database className="w-3 h-3 text-gray-400" /> {r.name}
                      {r.row_count != null && <span className="text-gray-400">({r.row_count.toLocaleString()} rows)</span>}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {linkedDatasets.length === 0 ? (
          <p className="text-xs text-gray-400">No datasets linked yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {linkedDatasets.map((d) => (
              <div key={d.id} className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-1.5">
                <Database className="w-3.5 h-3.5 text-brand" />
                <span className="text-xs font-medium text-gray-700">{d.name}</span>
                {d.row_count != null && <span className="text-[10px] text-gray-400">{d.row_count.toLocaleString()} rows</span>}
                {!editing && (
                  <>
                    <button
                      onClick={() => downloadDataset(d)}
                      disabled={downloadingDatasetId === d.id}
                      title="Download dataset"
                      className="text-brand hover:text-[#2a0d8a] disabled:cursor-wait"
                    >
                      {downloadingDatasetId === d.id ? (
                        <span className="w-3.5 h-3.5 inline-block border-[1.5px] border-blue-200 border-t-brand rounded-full animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a href={`/datasets/${d.id}`} title="Open dataset" className="text-gray-400 hover:text-gray-600">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
                {editing && (
                  <button onClick={() => setLinkedDatasets((prev) => prev.filter((x) => x.id !== d.id))} className="text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        {editing ? (
          <div className="tiptap-canvas rounded-xl border-2 border-gray-300 shadow-sm overflow-hidden transition focus-within:ring-2 focus-within:ring-brand focus-within:border-brand">
            <EditorContent editor={editor} />
            <div className="flex items-center gap-0.5 px-3 py-2 border-t border-gray-100 bg-gray-50/50">
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
            </div>
          </div>
        ) : isContentEmpty(article.content) ? (
          <p className="text-sm text-gray-400">No content yet — click Edit to write the business use case, project use case, and anything else worth knowing.</p>
        ) : (
          <div
            className="prose prose-sm max-w-none doc-article-content"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
          />
        )}
      </div>

      {/* Attachments */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Attachments {article.attachments.length > 0 && `(${article.attachments.length})`}
          </h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            {uploading ? (
              <span className="w-3.5 h-3.5 border-[1.5px] border-gray-300 border-t-brand rounded-full animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? "Uploading..." : "Attach file"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
          />
        </div>

        {article.attachments.length === 0 ? (
          <p className="text-xs text-gray-400">No attachments yet. Up to {MAX_ATTACHMENT_MB}MB per file.</p>
        ) : (
          <div className="space-y-1.5">
            {article.attachments.map((att) => {
              const isDownloading = downloadingId === att.id;
              const isDeleting = deletingId === att.id;
              return (
                <div
                  key={att.id}
                  className={cn(
                    "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-gray-100 bg-gray-50/50 transition",
                    isDeleting && "opacity-40"
                  )}
                >
                  <button
                    onClick={() => downloadAttachment(att)}
                    disabled={isDownloading || isDeleting}
                    className="flex items-center gap-2 text-xs text-gray-700 hover:text-brand min-w-0 flex-1 disabled:cursor-wait"
                  >
                    {isDownloading ? (
                      <span className="w-3.5 h-3.5 flex-shrink-0 border-[1.5px] border-gray-300 border-t-brand rounded-full animate-spin" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="truncate font-medium">{att.filename}</span>
                    <span className="text-gray-400 flex-shrink-0">{fmtBytes(att.file_size_bytes)}</span>
                    {att.uploaded_by_name && (
                      <span className="text-gray-400 flex-shrink-0 hidden sm:inline">· {att.uploaded_by_name}</span>
                    )}
                  </button>
                  <button
                    onClick={() => removeAttachment(att)}
                    disabled={isDeleting || isDownloading}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0 disabled:cursor-wait"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
