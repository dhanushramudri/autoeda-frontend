"use client";

import { useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sourcesApi } from "@/lib/api";
import {
  ArrowLeft, Database, Table2, ChevronRight, ChevronDown,
  Download, Eye, Search, Loader2, CheckCircle2,
  BookOpen, Layers, HardDrive, Hash, ToggleLeft,
  Code2, Play, LayoutList, Copy, RotateCcw, Zap,
  Workflow, XCircle, Clock3, ExternalLink, RefreshCw, X,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SqlResultsTable } from "@/components/shared/SqlResultsTable";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchemaColumn { name: string; type: string }
interface PreviewResult { columns: string[]; rows: unknown[][]; row_count: number }
interface DeltaColumn { name: string; type: string; nullable: boolean }
interface DeltaStats {
  catalog: string; schema: string; table: string;
  columns: DeltaColumn[];
  format: string | null;
  num_files: number | null;
  size_bytes: number | null;
  row_count: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

// ── Databricks Unity Catalog Browser ─────────────────────────────────────────

function DatabricksBrowser({
  workspaceId, sourceId, sourceName,
}: { workspaceId: string; sourceId: string; sourceName: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema]   = useState<string | null>(null);
  const [selectedTable, setSelectedTable]     = useState<string | null>(null);
  const [preview, setPreview]                 = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [importName, setImportName]           = useState("");
  const [importSuccess, setImportSuccess]     = useState(false);
  const [searchCatalog, setSearchCatalog]     = useState("");
  const [searchTable, setSearchTable]         = useState("");

  // Level 1 — catalogs
  const { data: catalogsData, isLoading: catalogsLoading } = useQuery({
    queryKey: ["db-catalogs", workspaceId, sourceId],
    queryFn: () => sourcesApi.databricksCatalogs(workspaceId, Number(sourceId)).then((r) => r.data),
  });

  // Level 2 — schemas (fetched when a catalog is selected)
  const { data: schemasData, isLoading: schemasLoading } = useQuery({
    queryKey: ["db-schemas", workspaceId, sourceId, selectedCatalog],
    queryFn: () => sourcesApi.databricksSchemas(workspaceId, Number(sourceId), selectedCatalog!).then((r) => r.data),
    enabled: !!selectedCatalog,
  });

  // Level 3 — tables
  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ["db-tables", workspaceId, sourceId, selectedCatalog, selectedSchema],
    queryFn: () =>
      sourcesApi.databricksTables(workspaceId, Number(sourceId), selectedCatalog!, selectedSchema!).then((r) => r.data),
    enabled: !!(selectedCatalog && selectedSchema),
  });

  // Delta stats for selected table
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["db-stats", workspaceId, sourceId, selectedCatalog, selectedSchema, selectedTable],
    queryFn: () =>
      sourcesApi.databricksStats(
        workspaceId, Number(sourceId),
        selectedCatalog!, selectedSchema!, selectedTable!
      ).then((r) => r.data as DeltaStats),
    enabled: !!(selectedCatalog && selectedSchema && selectedTable),
  });

  const fqtn = selectedCatalog && selectedSchema && selectedTable
    ? `${selectedCatalog}.${selectedSchema}.${selectedTable}`
    : null;

  const importMut = useMutation({
    mutationFn: () =>
      sourcesApi.importAsDataset(workspaceId, Number(sourceId), {
        dataset_name: importName.trim(),
        workspace_id: Number(workspaceId),
        table: fqtn,
        limit: 100000,
      }),
    onSuccess: () => {
      setImportSuccess(true);
      qc.invalidateQueries({ queryKey: ["datasets", workspaceId] });
      setTimeout(() => router.push(`/workspaces/${workspaceId}/datasets`), 1500);
    },
  });

  const catalogs: string[] = catalogsData?.catalogs ?? [];
  const schemas: string[]  = schemasData?.schemas ?? [];
  const tables: { name: string }[] = tablesData?.tables ?? [];

  const filteredCatalogs = catalogs.filter((c) => c.toLowerCase().includes(searchCatalog.toLowerCase()));
  const filteredTables   = tables.filter((t) => t.name.toLowerCase().includes(searchTable.toLowerCase()));

  function selectCatalog(c: string) {
    setSelectedCatalog(c);
    setSelectedSchema(null);
    setSelectedTable(null);
    setPreview(null);
    setImportName("");
  }
  function selectSchema(s: string) {
    setSelectedSchema(s);
    setSelectedTable(null);
    setPreview(null);
    setImportName("");
  }
  function selectTable(t: string) {
    setSelectedTable(t);
    setPreview(null);
    setImportName(`${sourceName} - ${t}`);
  }

  async function handlePreview() {
    if (!fqtn) return;
    setPreviewLoading(true);
    try {
      const res = await sourcesApi.preview(workspaceId, Number(sourceId), fqtn, 100);
      setPreview(res.data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="flex flex-1 min-h-0">

      {/* ── Left: 3-level tree ─────────────────────────────────────────── */}
      <div className="w-72 border-r border-border bg-muted flex flex-col flex-shrink-0">

        {/* Catalog list */}
        <div className="flex flex-col border-b border-border">
          <div className="px-3 py-2 flex items-center gap-1.5 border-b border-border">
            <BookOpen className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Catalog</span>
          </div>
          <div className="px-2 py-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter catalogs..."
                value={searchCatalog}
                onChange={(e) => setSearchCatalog(e.target.value)}
                className="w-full pl-7 pr-2 py-1 border border-border rounded text-xs focus:outline-none focus:border-brand bg-card"
              />
            </div>
          </div>
          <div className="max-h-36 overflow-y-auto">
            {catalogsLoading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-xs gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
            ) : filteredCatalogs.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No catalogs</p>
            ) : filteredCatalogs.map((c) => (
              <button
                key={c}
                onClick={() => selectCatalog(c)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition",
                  selectedCatalog === c
                    ? "bg-brand/10 text-brand font-semibold"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <BookOpen className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left font-mono truncate">{c}</span>
                {selectedCatalog === c && <ChevronDown className="w-3 h-3 text-brand" />}
              </button>
            ))}
          </div>
        </div>

        {/* Schema list */}
        <div className="flex flex-col border-b border-border">
          <div className="px-3 py-2 flex items-center gap-1.5 border-b border-border">
            <Layers className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Schema</span>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {!selectedCatalog ? (
              <p className="px-3 py-2 text-xs text-muted-foreground/60">Select a catalog first</p>
            ) : schemasLoading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-xs gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
            ) : schemas.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No schemas</p>
            ) : schemas.map((s) => (
              <button
                key={s}
                onClick={() => selectSchema(s)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition",
                  selectedSchema === s
                    ? "bg-brand/10 text-brand font-semibold"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Layers className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left font-mono truncate">{s}</span>
                {selectedSchema === s && <ChevronDown className="w-3 h-3 text-brand" />}
              </button>
            ))}
          </div>
        </div>

        {/* Table list */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 flex items-center gap-1.5 border-b border-border flex-shrink-0">
            <Table2 className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Table</span>
          </div>
          <div className="px-2 py-1.5 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter tables..."
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                className="w-full pl-7 pr-2 py-1 border border-border rounded text-xs focus:outline-none focus:border-brand bg-card"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedSchema ? (
              <p className="px-3 py-2 text-xs text-muted-foreground/60">Select a schema first</p>
            ) : tablesLoading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-xs gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
            ) : filteredTables.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No tables</p>
            ) : filteredTables.map((t) => (
              <button
                key={t.name}
                onClick={() => selectTable(t.name)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition",
                  selectedTable === t.name
                    ? "bg-blue-50 dark:bg-blue-950/40 text-brand font-semibold"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Table2 className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left font-mono truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Stats + Preview + Import ───────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!fqtn ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Database className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a catalog → schema → table</p>
          </div>
        ) : (
          <>
            {/* Action bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{selectedCatalog}.{selectedSchema}.</span>
                <span className="font-mono text-sm font-semibold text-foreground truncate">{selectedTable}</span>
              </div>
              <div className="flex-1" />
              <button
                onClick={handlePreview}
                disabled={previewLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition disabled:opacity-50"
              >
                {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                Preview 100 rows
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Dataset name..."
                  className="border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand w-52"
                />
                <button
                  onClick={() => importMut.mutate()}
                  disabled={importMut.isPending || !importName.trim() || importSuccess}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-[#2a0d8a] disabled:opacity-50 transition"
                >
                  {importMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : importSuccess ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {importSuccess ? "Imported!" : "Import as Dataset"}
                </button>
              </div>
            </div>

            {/* Stats + Preview */}
            <div className="flex-1 min-h-0 overflow-y-auto">

              {/* Delta stats panel */}
              {(statsLoading || statsData) && (
                <div className="border-b border-border bg-muted/60 px-4 py-3">
                  {statsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading table stats from Delta log...
                    </div>
                  ) : statsData && (
                    <>
                      {/* Summary tiles */}
                      <div className="flex flex-wrap gap-3 mb-3">
                        <StatTile
                          icon={<Hash className="w-3.5 h-3.5" />}
                          label="Rows"
                          value={fmtNum(statsData.row_count)}
                          color="text-brand"
                        />
                        <StatTile
                          icon={<Layers className="w-3.5 h-3.5" />}
                          label="Columns"
                          value={statsData.columns.length > 0 ? String(statsData.columns.length) : "—"}
                          color="text-violet-600 dark:text-violet-400"
                        />
                        <StatTile
                          icon={<HardDrive className="w-3.5 h-3.5" />}
                          label="Size"
                          value={fmtBytes(statsData.size_bytes)}
                          color="text-emerald-600 dark:text-emerald-400"
                        />
                        <StatTile
                          icon={<Table2 className="w-3.5 h-3.5" />}
                          label="Files"
                          value={fmtNum(statsData.num_files)}
                          color="text-amber-600 dark:text-amber-400"
                        />
                        {statsData.format && (
                          <StatTile
                            icon={<ToggleLeft className="w-3.5 h-3.5" />}
                            label="Format"
                            value={statsData.format.toUpperCase()}
                            color="text-muted-foreground"
                          />
                        )}
                      </div>

                      {/* Column schema */}
                      {statsData.columns.length > 0 && (
                        <div className="rounded-lg border border-border bg-card overflow-hidden">
                          <div className="grid grid-cols-3 px-3 py-1.5 bg-muted border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <span>Column</span>
                            <span>Type</span>
                            <span>Nullable</span>
                          </div>
                          <div className="max-h-48 overflow-y-auto divide-y divide-border">
                            {statsData.columns.map((col) => (
                              <div key={col.name} className="grid grid-cols-3 px-3 py-1.5 text-xs hover:bg-muted">
                                <span className="font-mono text-foreground truncate">{col.name}</span>
                                <span className="text-muted-foreground font-mono truncate">{col.type}</span>
                                <span className={cn("font-medium", col.nullable ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                                  {col.nullable ? "yes" : "no"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Preview table */}
              {previewLoading && (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 text-brand animate-spin" />
                </div>
              )}
              {!previewLoading && !preview && !statsLoading && !statsData && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <Eye className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Click "Preview 100 rows" to sample this table</p>
                </div>
              )}
              {!previewLoading && !preview && (statsData || statsLoading) && !statsLoading && (
                <div className="flex flex-col items-center justify-center h-24 text-muted-foreground gap-1">
                  <p className="text-xs">Click "Preview 100 rows" to sample data</p>
                </div>
              )}
              {preview && (
                <SqlResultsTable columns={preview.columns} rows={preview.rows} rowCount={preview.row_count} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Databricks SQL Editor ─────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  { label: "Row count by pickup zip", sql: "SELECT pickup_zip, COUNT(*) AS trips, ROUND(AVG(fare_amount),2) AS avg_fare\nFROM samples.nyctaxi.trips\nGROUP BY pickup_zip\nORDER BY trips DESC\nLIMIT 20" },
  { label: "Fare distribution", sql: "SELECT\n  CASE WHEN fare_amount < 10 THEN '<$10'\n       WHEN fare_amount < 20 THEN '$10-20'\n       WHEN fare_amount < 50 THEN '$20-50'\n       ELSE '>$50' END AS bucket,\n  COUNT(*) AS trips\nFROM samples.nyctaxi.trips\nGROUP BY 1 ORDER BY MIN(fare_amount)" },
  { label: "Hourly trip trends", sql: "SELECT HOUR(tpep_pickup_datetime) AS hour, COUNT(*) AS trips\nFROM samples.nyctaxi.trips\nGROUP BY 1 ORDER BY 1" },
];

function DatabricksSqlEditor({
  workspaceId, sourceId,
}: { workspaceId: string; sourceId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [sql, setSql]               = useState("SELECT * FROM samples.nyctaxi.trips LIMIT 100");
  const [result, setResult]         = useState<{ columns: string[]; rows: unknown[][]; row_count: number } | null>(null);
  const [elapsedMs, setElapsedMs]   = useState<number | null>(null);
  const [running, setRunning]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [importName, setImportName] = useState("");
  const [importing, setImporting]   = useState(false);
  const [imported, setImported]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const editorRef = useRef<{ addCommand: (kb: number, fn: () => void) => void } | null>(null);

  const handleEditorMount = useCallback((editor: { addCommand: (kb: number, fn: () => void) => void }, monaco: { KeyMod: { CtrlCmd: number }; KeyCode: { Enter: number } }) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runQuery());
  }, []);

  async function runQuery() {
    if (!sql.trim()) return;
    setRunning(true); setError(null); setResult(null); setImported(false); setElapsedMs(null);
    const t0 = performance.now();
    try {
      const res = await sourcesApi.databricksQuery(workspaceId, Number(sourceId), sql);
      setResult(res.data);
      setElapsedMs(Math.round(performance.now() - t0));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? String(e);
      setError(msg);
    } finally {
      setRunning(false);
    }
  }

  async function importQuery() {
    if (!importName.trim() || !result) return;
    setImporting(true);
    try {
      const res = await sourcesApi.databricksQueryImport(workspaceId, Number(sourceId), sql, importName.trim());
      setImported(true);
      qc.invalidateQueries({ queryKey: ["datasets", workspaceId] });
      setTimeout(() => router.push(`/datasets/${res.data.dataset_id}`), 1200);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? String(e);
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  function copySql() {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-card">
      {/* Warehouse-style toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b border-border flex-shrink-0">
        <button
          onClick={runQuery}
          disabled={running || !sql.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" fill="currentColor" />}
          {running ? "Running" : "Run"}
        </button>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">⌘/Ctrl + Enter</span>

        <div className="w-px h-5 bg-muted mx-1" />

        <button onClick={copySql} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground text-xs transition">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button onClick={() => setSql("")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground text-xs transition">
          <RotateCcw className="w-3.5 h-3.5" /> Clear
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-orange-500 dark:text-orange-400" />
          <span className="text-[11px] text-muted-foreground">Serverless Warehouse</span>
        </div>
      </div>

      {/* Example queries strip */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-card border-b border-border flex-shrink-0 overflow-x-auto">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">Examples</span>
        {EXAMPLE_QUERIES.map((q) => (
          <button key={q.label} onClick={() => setSql(q.sql)}
            className="px-2 py-0.5 rounded border border-border bg-muted text-[11px] text-muted-foreground hover:border-brand hover:text-brand transition flex-shrink-0">
            {q.label}
          </button>
        ))}
      </div>

      {/* Monaco Editor */}
      <div className="flex-shrink-0 mx-4 my-3 border border-border rounded-lg overflow-hidden shadow-sm" style={{ height: 220 }}>
        <MonacoEditor
          height="220px"
          language="sql"
          theme="light"
          value={sql}
          onChange={(v) => setSql(v ?? "")}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            padding: { top: 12 },
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 flex flex-col bg-card">
        {/* Result bar */}
        {result && (
          <div className="flex items-center gap-3 px-4 py-2 bg-card border-b border-border flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{result.row_count.toLocaleString()}</span> rows
            </span>
            {elapsedMs != null && (
              <span className="text-xs text-muted-foreground">· {elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(2)}s`}</span>
            )}
            <div className="flex-1" />
            <input
              type="text"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="Dataset name to import..."
              className="border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand w-52"
            />
            <button
              onClick={importQuery}
              disabled={importing || !importName.trim() || imported}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-[#2a0d8a] disabled:opacity-50 transition"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : imported ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              {imported ? "Imported!" : "Import as Dataset"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap flex-shrink-0">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!result && !error && !running && (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-3">
            <Code2 className="w-12 h-12 opacity-20" />
            <p className="text-sm">Write a query above and press Run</p>
            <p className="text-xs text-muted-foreground/60">Use full FQN: catalog.schema.table</p>
          </div>
        )}

        {running && (
          <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Running on Databricks…
          </div>
        )}

        {result && (
          <div className="flex-1 min-h-0 overflow-auto">
            <SqlResultsTable columns={result.columns} rows={result.rows} rowCount={result.row_count} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatTile({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
      <span className={cn("flex-shrink-0", color)}>{icon}</span>
      <div>
        <div className={cn("text-sm font-bold font-mono tabular-nums leading-none", color)}>{value}</div>
        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ── Standard (flat) Browser — for all non-Databricks sources ──────────────────

function StandardBrowser({
  workspaceId, sourceId, sourceName,
}: { workspaceId: string; sourceId: string; sourceName: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns]   = useState<SchemaColumn[]>([]);
  const [preview, setPreview]             = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importName, setImportName]       = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [searchTable, setSearchTable]     = useState("");

  const { data: schemaData, isLoading: schemaLoading } = useQuery({
    queryKey: ["source-schema", workspaceId, sourceId],
    queryFn: () => sourcesApi.schema(workspaceId, Number(sourceId)).then((r) => r.data),
  });

  const importMut = useMutation({
    mutationFn: () =>
      sourcesApi.importAsDataset(workspaceId, Number(sourceId), {
        dataset_name: importName.trim(),
        workspace_id: Number(workspaceId),
        table: selectedTable,
        limit: 100000,
      }),
    onSuccess: () => {
      setImportSuccess(true);
      qc.invalidateQueries({ queryKey: ["datasets", workspaceId] });
      setTimeout(() => router.push(`/workspaces/${workspaceId}/datasets`), 1500);
    },
  });

  const tables: string[] = schemaData?.tables ?? schemaData?.objects ?? [];
  const filteredTables = tables.filter((t) => t.toLowerCase().includes(searchTable.toLowerCase()));

  const handleSelectTable = async (table: string) => {
    setSelectedTable(table);
    setPreview(null);
    setExpandedTable(table);
    setImportName(`${sourceName} - ${table}`);
    try {
      const res = await sourcesApi.tableColumns(workspaceId, Number(sourceId), table);
      setTableColumns(res.data.columns ?? []);
    } catch {
      setTableColumns([]);
    }
  };

  const handlePreview = async (table: string) => {
    setPreviewLoading(true);
    try {
      const res = await sourcesApi.preview(workspaceId, Number(sourceId), table, 100);
      setPreview(res.data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: Schema Tree */}
      <div className="w-64 border-r border-border bg-muted flex flex-col flex-shrink-0">
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter tables..."
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:border-brand bg-card"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {schemaLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading schema...
            </div>
          ) : filteredTables.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No tables found</p>
          ) : filteredTables.map((table) => (
            <div key={table}>
              <button
                onClick={() => handleSelectTable(table)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition ${
                  selectedTable === table
                    ? "bg-blue-50 dark:bg-blue-950/40 text-brand font-medium"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Table2 className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left truncate font-mono">{table}</span>
                {expandedTable === table ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                )}
              </button>
              {expandedTable === table && tableColumns.length > 0 && (
                <div className="ml-4 border-l border-border pl-2 pb-1">
                  {tableColumns.map((col) => (
                    <div key={col.name} className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground">
                      <span className="font-mono truncate flex-1">{col.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{col.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Preview + Import */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedTable ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Table2 className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a table to preview and import</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
              <span className="font-mono text-sm font-semibold text-foreground">{selectedTable}</span>
              <div className="flex-1" />
              <button
                onClick={() => handlePreview(selectedTable)}
                disabled={previewLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition disabled:opacity-50"
              >
                {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                Preview 100 rows
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Dataset name..."
                  className="border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand w-48"
                />
                <button
                  onClick={() => importMut.mutate()}
                  disabled={importMut.isPending || !importName.trim() || importSuccess}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-[#2a0d8a] disabled:opacity-50 transition"
                >
                  {importMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : importSuccess ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {importSuccess ? "Imported!" : "Import as Dataset"}
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {previewLoading && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-brand animate-spin" />
                </div>
              )}
              {!previewLoading && !preview && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Eye className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Click "Preview 100 rows" to sample this table</p>
                </div>
              )}
              {preview && (
                <SqlResultsTable columns={preview.columns} rows={preview.rows} rowCount={preview.row_count} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Databricks Jobs (MLOps / Workflows) ────────────────────────────────────────

interface DbJobSchedule { cron: string | null; timezone: string | null; paused: boolean }
interface DbJob {
  job_id: number; name: string; created_time: number | null; creator: string;
  tags: Record<string, string>; task_count: number; schedule: DbJobSchedule | null; max_concurrent_runs: number;
}
interface DbRun {
  run_id: number; life_cycle_state: string | null; result_state: string | null;
  state_message: string | null; start_time: number | null; end_time: number | null;
  duration_ms: number | null; run_page_url: string | null; trigger: string | null;
}
interface DbActiveRun { run_id: number; job_id: number; life_cycle_state: string | null }

function runStatusMeta(run: { life_cycle_state: string | null; result_state: string | null }) {
  const lcs = run.life_cycle_state;
  const rs = run.result_state;
  if (lcs === "TERMINATED") {
    if (rs === "SUCCESS") return { label: "Success", color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 };
    return { label: rs ? rs.replace(/_/g, " ").toLowerCase() : "Failed", color: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800", icon: XCircle };
  }
  if (lcs === "RUNNING" || lcs === "TERMINATING") return { label: "Running", color: "text-brand bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800", icon: Loader2 };
  if (lcs === "PENDING" || lcs === "QUEUED" || lcs === "WAITING_FOR_RETRY" || lcs === "BLOCKED") return { label: "Pending", color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", icon: Clock3 };
  if (lcs === "INTERNAL_ERROR" || lcs === "SKIPPED") return { label: "Error", color: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800", icon: XCircle };
  return { label: lcs ?? "Unknown", color: "text-muted-foreground bg-muted border-border", icon: Clock3 };
}

function isActiveState(lcs: string | null): boolean {
  return lcs === "RUNNING" || lcs === "TERMINATING" || lcs === "PENDING" || lcs === "QUEUED" || lcs === "WAITING_FOR_RETRY" || lcs === "BLOCKED";
}

function fmtEpochMs(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

// Cron → human-readable, common patterns only; falls back to raw expression
function humanizeCron(cron: string | null): string {
  if (!cron) return "Manual trigger only";
  const parts = cron.trim().split(/\s+/);
  if (parts.length >= 6) {
    const [, min, hour, dom, , dow] = parts;
    if (dom === "?" || dom === "*") {
      if (dow === "*" || dow === "?") return `Daily at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
    }
  }
  return cron;
}

function JobRunsList({ workspaceId, sourceId, jobId }: { workspaceId: string; sourceId: string; jobId: number }) {
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["db-job-runs", workspaceId, sourceId, jobId],
    queryFn: () => sourcesApi.databricksJobRuns(workspaceId, Number(sourceId), jobId).then((r) => r.data),
    refetchInterval: (query) => {
      const runs: DbRun[] = query.state.data?.runs ?? [];
      const hasActive = runs.some((r) => isActiveState(r.life_cycle_state));
      return hasActive ? 4000 : false;
    },
  });

  const runs: DbRun[] = data?.runs ?? [];

  async function cancelRun(runId: number) {
    setCancelling(runId);
    try {
      await sourcesApi.databricksCancelRun(workspaceId, Number(sourceId), runId);
      qc.invalidateQueries({ queryKey: ["db-job-runs", workspaceId, sourceId, jobId] });
    } finally {
      setCancelling(null);
    }
  }

  if (isLoading) return <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading runs…</div>;
  if (runs.length === 0) return <div className="px-4 py-3 text-xs text-muted-foreground">No runs yet</div>;

  return (
    <div className="divide-y divide-border">
      {runs.map((run) => {
        const meta = runStatusMeta(run);
        const Icon = meta.icon;
        const active = isActiveState(run.life_cycle_state);
        return (
          <div key={run.run_id} className="flex items-center gap-3 px-4 py-2">
            <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold flex-shrink-0", meta.color)}>
              <Icon className={cn("w-3 h-3", meta.label === "Running" && "animate-spin")} />
              {meta.label}
            </span>
            <span className="text-[11px] text-muted-foreground flex-shrink-0 w-36 truncate">{fmtEpochMs(run.start_time)}</span>
            <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0 w-16">{fmtDuration(run.duration_ms)}</span>
            {run.trigger && <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 uppercase">{run.trigger}</span>}
            {run.state_message && <span className="text-[10px] text-muted-foreground truncate flex-1">{run.state_message}</span>}
            <div className="flex-1" />
            {active && (
              <button
                onClick={() => cancelRun(run.run_id)}
                disabled={cancelling === run.run_id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-950/40 text-[10px] font-medium transition disabled:opacity-50 flex-shrink-0"
              >
                {cancelling === run.run_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Cancel
              </button>
            )}
            {run.run_page_url && (
              <a href={run.run_page_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-brand flex-shrink-0">
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RunWithParamsForm({
  workspaceId, sourceId, jobId, onTriggered, onCancel,
}: { workspaceId: string; sourceId: string; jobId: number; onTriggered: () => void; onCancel: () => void }) {
  const [params, setParams] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  const [running, setRunning] = useState(false);

  async function submit() {
    setRunning(true);
    const notebookParams: Record<string, string> = {};
    params.forEach((p) => { if (p.key.trim()) notebookParams[p.key.trim()] = p.value; });
    try {
      await sourcesApi.databricksRunJob(workspaceId, Number(sourceId), jobId, Object.keys(notebookParams).length ? notebookParams : undefined);
      onTriggered();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="px-4 py-3 bg-blue-50/40 dark:bg-blue-950/40 border-b border-border space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notebook Parameters (optional)</p>
      {params.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={p.key}
            onChange={(e) => setParams((prev) => prev.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
            placeholder="param_name"
            className="w-36 border border-border rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:border-brand"
          />
          <span className="text-muted-foreground/60 text-xs">=</span>
          <input
            value={p.value}
            onChange={(e) => setParams((prev) => prev.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
            placeholder="value"
            className="flex-1 border border-border rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:border-brand"
          />
          <button onClick={() => setParams((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground/60 hover:text-red-500 dark:text-red-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button onClick={() => setParams((prev) => [...prev, { key: "", value: "" }])} className="text-[11px] text-brand hover:underline">
        + Add parameter
      </button>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition">Cancel</button>
        <button
          onClick={submit}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" fill="currentColor" />}
          Run with Parameters
        </button>
      </div>
    </div>
  );
}

function DatabricksJobsPanel({ workspaceId, sourceId }: { workspaceId: string; sourceId: string }) {
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [paramsJob, setParamsJob] = useState<number | null>(null);
  const [triggering, setTriggering] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["db-jobs", workspaceId, sourceId],
    queryFn: () => sourcesApi.databricksJobs(workspaceId, Number(sourceId)).then((r) => r.data),
  });

  const { data: activeData } = useQuery({
    queryKey: ["db-jobs-active", workspaceId, sourceId],
    queryFn: () => sourcesApi.databricksActiveRuns(workspaceId, Number(sourceId)).then((r) => r.data),
    refetchInterval: 6000,
  });

  const jobs: DbJob[] = data?.jobs ?? [];
  const activeRuns: DbActiveRun[] = activeData?.active_runs ?? [];
  const activeByJob = new Map<number, number>();
  activeRuns.forEach((r) => activeByJob.set(r.job_id, (activeByJob.get(r.job_id) ?? 0) + 1));

  const filteredJobs = jobs.filter((j) => j.name.toLowerCase().includes(search.toLowerCase()));

  async function runNow(jobId: number) {
    setTriggering(jobId);
    try {
      await sourcesApi.databricksRunJob(workspaceId, Number(sourceId), jobId);
      setExpandedJob(jobId);
      qc.invalidateQueries({ queryKey: ["db-job-runs", workspaceId, sourceId, jobId] });
      qc.invalidateQueries({ queryKey: ["db-jobs-active", workspaceId, sourceId] });
    } catch { /* surfaced via runs list */ }
    finally {
      setTriggering(null);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-muted">
      <div className="flex items-center gap-3 px-6 py-3 bg-card border-b border-border sticky top-0 z-10">
        <Workflow className="w-4 h-4 text-brand" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Jobs & Workflows</h2>
          <p className="text-[11px] text-muted-foreground">Trigger and monitor Databricks Jobs — ETL, ML training, pipelines</p>
        </div>
        <div className="flex-1" />
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter jobs..."
            className="w-full pl-8 pr-2 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:border-brand"
          />
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading jobs…
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
            {(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to load jobs"}
          </div>
        )}

        {!isLoading && !error && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Workflow className="w-10 h-10 opacity-20" />
            <p className="text-sm">No Databricks Jobs found in this workspace</p>
            <p className="text-xs text-muted-foreground/60">Create one in Databricks → Jobs & Pipelines</p>
          </div>
        )}

        {!isLoading && !error && jobs.length > 0 && filteredJobs.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No jobs match "{search}"</p>
        )}

        <div className="space-y-2">
          {filteredJobs.map((job) => {
            const activeCount = activeByJob.get(job.job_id) ?? 0;
            return (
              <div key={job.job_id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpandedJob(expandedJob === job.job_id ? null : job.job_id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {expandedJob === job.job_id ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <Workflow className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{job.name}</p>
                        {activeCount > 0 && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-brand text-[9px] font-bold flex-shrink-0">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> {activeCount} running
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground">ID {job.job_id}{job.creator ? ` · ${job.creator}` : ""}</p>
                        <span className={cn(
                          "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md",
                          job.schedule && !job.schedule.paused ? "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" : "bg-muted text-muted-foreground"
                        )}>
                          <Clock3 className="w-2.5 h-2.5" />
                          {job.schedule ? (job.schedule.paused ? "Schedule paused" : humanizeCron(job.schedule.cron)) : "Manual trigger only"}
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setParamsJob(paramsJob === job.job_id ? null : job.job_id)}
                    className="text-[11px] text-muted-foreground hover:text-brand px-2 py-1.5 transition flex-shrink-0"
                  >
                    Parameters…
                  </button>
                  <button
                    onClick={() => runNow(job.job_id)}
                    disabled={triggering === job.job_id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition flex-shrink-0"
                  >
                    {triggering === job.job_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" fill="currentColor" />}
                    Run Now
                  </button>
                </div>
                {paramsJob === job.job_id && (
                  <RunWithParamsForm
                    workspaceId={workspaceId} sourceId={sourceId} jobId={job.job_id}
                    onTriggered={() => { setParamsJob(null); setExpandedJob(job.job_id); qc.invalidateQueries({ queryKey: ["db-job-runs", workspaceId, sourceId, job.job_id] }); }}
                    onCancel={() => setParamsJob(null)}
                  />
                )}
                {expandedJob === job.job_id && (
                  <div className="border-t border-border bg-muted/50">
                    <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recent Runs</p>
                    <JobRunsList workspaceId={workspaceId} sourceId={sourceId} jobId={job.job_id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Delta Time Travel ────────────────────────────────────────────────────────

interface HistoryEntry { version: number; timestamp: string | null; operation: string | null; user_name: string | null }
interface ColumnDiff {
  column: string; dtype_a: string; dtype_b: string; dtype_changed: boolean;
  null_pct_a: number; null_pct_b: number; distinct_a: number; distinct_b: number;
  mean_a: number | null; mean_b: number | null; min_a: number | null; min_b: number | null; max_a: number | null; max_b: number | null;
}
interface CompareResult {
  version_a: number; version_b: number; row_count_a: number; row_count_b: number;
  sampled_rows_a: number; sampled_rows_b: number;
  columns_added: string[]; columns_removed: string[]; column_diffs: ColumnDiff[];
}

function DeltaCell({ a, b, fmt = (v: number) => String(v) }: { a: number | null; b: number | null; fmt?: (v: number) => string }) {
  if (a == null || b == null) return <span className="text-muted-foreground/60">—</span>;
  const diff = b - a;
  const changed = Math.abs(diff) > 1e-9;
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted-foreground">{fmt(a)}</span>
      <span className="text-muted-foreground/60">→</span>
      <span className={cn("font-medium", changed ? (diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-foreground")}>{fmt(b)}</span>
    </span>
  );
}

function DatabricksTimeTravel({ workspaceId, sourceId }: { workspaceId: string; sourceId: string }) {
  const [fqn, setFqn] = useState("samples.nyctaxi.trips");
  const [loadedFqn, setLoadedFqn] = useState<string | null>(null);
  const [versionA, setVersionA] = useState<number | null>(null);
  const [versionB, setVersionB] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parts = loadedFqn?.split(".") ?? [];
  const [catalog, schema, table] = parts.length === 3 ? parts : [null, null, null];

  const { data: historyData, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ["db-history", workspaceId, sourceId, loadedFqn],
    queryFn: () => sourcesApi.databricksHistory(workspaceId, Number(sourceId), catalog!, schema!, table!).then((r) => r.data),
    enabled: !!(catalog && schema && table),
  });

  const history: HistoryEntry[] = historyData?.history ?? [];

  function loadHistory() {
    const trimmed = fqn.trim();
    if (trimmed.split(".").length !== 3) {
      setError("Enter a fully-qualified table name: catalog.schema.table");
      return;
    }
    setError(null);
    setCompareResult(null);
    setVersionA(null);
    setVersionB(null);
    setLoadedFqn(trimmed);
  }

  async function runCompare() {
    if (versionA == null || versionB == null || !catalog || !schema || !table) return;
    setComparing(true);
    setError(null);
    try {
      const res = await sourcesApi.databricksCompareVersions(workspaceId, Number(sourceId), catalog, schema, table, versionA, versionB);
      setCompareResult(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? String(e);
      setError(msg);
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-muted">
      <div className="flex items-center gap-3 px-6 py-3 bg-card border-b border-border sticky top-0 z-10">
        <RotateCcw className="w-4 h-4 text-brand" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Delta Time Travel</h2>
          <p className="text-[11px] text-muted-foreground">Compare any two versions of a Delta table — schema, nulls, distributions</p>
        </div>
        <div className="flex-1" />
        <input
          value={fqn}
          onChange={(e) => setFqn(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadHistory()}
          placeholder="catalog.schema.table"
          className="w-64 border border-border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-brand"
        />
        <button onClick={loadHistory} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-[#2a0d8a] transition">
          Load History
        </button>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">{error}</div>
        )}
        {historyError && (
          <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
            {(historyError as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to load history"}
          </div>
        )}

        {!loadedFqn && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <RotateCcw className="w-10 h-10 opacity-20" />
            <p className="text-sm">Enter a table's fully-qualified name and load its version history</p>
          </div>
        )}

        {historyLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Reading Delta transaction log…
          </div>
        )}

        {history.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-[60px_60px_1fr_180px_140px] gap-2 px-4 py-2 bg-muted border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>A</span><span>B</span><span>Operation</span><span>Timestamp</span><span>User</span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {history.map((h) => (
                <div key={h.version} className="grid grid-cols-[60px_60px_1fr_180px_140px] gap-2 px-4 py-2 items-center text-xs hover:bg-muted">
                  <input type="radio" name="versionA" checked={versionA === h.version} onChange={() => setVersionA(h.version)} className="accent-brand" />
                  <input type="radio" name="versionB" checked={versionB === h.version} onChange={() => setVersionB(h.version)} className="accent-emerald-600" />
                  <span className="font-mono text-foreground">v{h.version} · {h.operation}</span>
                  <span className="text-muted-foreground text-[11px]">{h.timestamp ? new Date(h.timestamp).toLocaleString() : "—"}</span>
                  <span className="text-muted-foreground text-[11px] truncate">{h.user_name ?? "—"}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">
                {versionA != null && versionB != null ? `Comparing v${versionA} → v${versionB}` : "Pick a version for A and B above"}
              </span>
              <div className="flex-1" />
              <button
                onClick={runCompare}
                disabled={versionA == null || versionB == null || comparing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-[#2a0d8a] disabled:opacity-50 transition"
              >
                {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Compare Versions
              </button>
            </div>
          </div>
        )}

        {compareResult && (
          <div className="space-y-4">
            {/* Summary tiles */}
            <div className="flex flex-wrap gap-3">
              <div className="bg-card border border-border rounded-lg px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Row Count</p>
                <DeltaCell a={compareResult.row_count_a} b={compareResult.row_count_b} fmt={(v) => v.toLocaleString()} />
              </div>
              {compareResult.columns_added.length > 0 && (
                <div className="bg-card border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Columns Added</p>
                  <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">{compareResult.columns_added.join(", ")}</p>
                </div>
              )}
              {compareResult.columns_removed.length > 0 && (
                <div className="bg-card border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                  <p className="text-[10px] text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Columns Removed</p>
                  <p className="text-xs font-mono text-red-700 dark:text-red-400">{compareResult.columns_removed.join(", ")}</p>
                </div>
              )}
            </div>

            {/* Column diff table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Column</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Null %</th>
                    <th className="text-left px-3 py-2">Distinct</th>
                    <th className="text-left px-3 py-2">Mean</th>
                    <th className="text-left px-3 py-2">Min</th>
                    <th className="text-left px-3 py-2">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {compareResult.column_diffs.map((d) => (
                    <tr key={d.column} className={cn(d.dtype_changed && "bg-amber-50/40 dark:bg-amber-950/40")}>
                      <td className="px-4 py-2 font-mono text-foreground">{d.column}</td>
                      <td className="px-3 py-2">
                        {d.dtype_changed ? (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">{d.dtype_a} → {d.dtype_b}</span>
                        ) : (
                          <span className="text-muted-foreground">{d.dtype_a}</span>
                        )}
                      </td>
                      <td className="px-3 py-2"><DeltaCell a={d.null_pct_a} b={d.null_pct_b} fmt={(v) => `${v}%`} /></td>
                      <td className="px-3 py-2"><DeltaCell a={d.distinct_a} b={d.distinct_b} fmt={(v) => v.toLocaleString()} /></td>
                      <td className="px-3 py-2">{d.mean_a != null ? <DeltaCell a={d.mean_a} b={d.mean_b} fmt={(v) => v.toFixed(2)} /> : <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-3 py-2">{d.min_a != null ? <DeltaCell a={d.min_a} b={d.min_b} fmt={(v) => v.toFixed(2)} /> : <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-3 py-2">{d.max_a != null ? <DeltaCell a={d.max_a} b={d.max_b} fmt={(v) => v.toFixed(2)} /> : <span className="text-muted-foreground/60">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Sampled {compareResult.sampled_rows_a.toLocaleString()} rows @ v{compareResult.version_a} and {compareResult.sampled_rows_b.toLocaleString()} rows @ v{compareResult.version_b} for column stats. Row counts are exact (full table).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type DatabricksTab = "browse" | "sql" | "jobs" | "timetravel";

export default function BrowseSourcePage() {
  const { id: workspaceId, sourceId } = useParams<{ id: string; sourceId: string }>();
  const [dbTab, setDbTab] = useState<DatabricksTab>("browse");

  const { data: sourceData } = useQuery({
    queryKey: ["source", workspaceId, sourceId],
    queryFn: () => sourcesApi.get(workspaceId, Number(sourceId)).then((r) => r.data),
  });

  const source = sourceData;
  const isDatabricks = source?.source_type === "databricks";

  const { data: activeRunsData } = useQuery({
    queryKey: ["db-jobs-active-badge", workspaceId, sourceId],
    queryFn: () => sourcesApi.databricksActiveRuns(workspaceId, Number(sourceId)).then((r) => r.data),
    enabled: isDatabricks,
    refetchInterval: 6000,
  });
  const activeRunCount = (activeRunsData?.active_runs ?? []).length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 bg-card border-b border-border flex-shrink-0">
        <Link
          href={`/workspaces/${workspaceId}/sources`}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Database className="w-5 h-5 text-brand" />
        <div>
          <h1 className="text-base font-bold text-foreground">{source?.name ?? "Data Source"}</h1>
          <p className="text-xs text-muted-foreground">{source?.source_type}</p>
        </div>

        {isDatabricks && (
          <>
            <div className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-[11px] font-semibold text-orange-700 dark:text-orange-400">
              <Layers className="w-3 h-3" />
              Unity Catalog
            </div>
            <div className="flex-1" />
            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setDbTab("browse")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition",
                  dbTab === "browse" ? "bg-card text-brand shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutList className="w-3.5 h-3.5" /> Browse
              </button>
              <button
                onClick={() => setDbTab("sql")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition",
                  dbTab === "sql" ? "bg-card text-brand shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code2 className="w-3.5 h-3.5" /> SQL Editor
              </button>
              <button
                onClick={() => setDbTab("jobs")}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition",
                  dbTab === "jobs" ? "bg-card text-brand shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Workflow className="w-3.5 h-3.5" /> Jobs
                {activeRunCount > 0 && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-brand text-white text-[9px] font-bold">
                    {activeRunCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setDbTab("timetravel")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition",
                  dbTab === "timetravel" ? "bg-card text-brand shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Time Travel
              </button>
            </div>
          </>
        )}
      </div>

      {isDatabricks ? (
        dbTab === "browse" ? (
          <DatabricksBrowser
            workspaceId={workspaceId}
            sourceId={sourceId}
            sourceName={source?.name ?? "Databricks"}
          />
        ) : dbTab === "sql" ? (
          <DatabricksSqlEditor
            workspaceId={workspaceId}
            sourceId={sourceId}
          />
        ) : dbTab === "jobs" ? (
          <DatabricksJobsPanel
            workspaceId={workspaceId}
            sourceId={sourceId}
          />
        ) : (
          <DatabricksTimeTravel
            workspaceId={workspaceId}
            sourceId={sourceId}
          />
        )
      ) : (
        <StandardBrowser
          workspaceId={workspaceId}
          sourceId={sourceId}
          sourceName={source?.name ?? "source"}
        />
      )}
    </div>
  );
}
