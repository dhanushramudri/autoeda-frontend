"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { warehouseApi } from "@/lib/api";
import { SqlResultsTable } from "@/components/shared/SqlResultsTable";
import { PageSpinner } from "@/components/shared/LoadingBar";
import {
  ChevronDown, ChevronRight, Play, Zap, Copy, RotateCcw,
  Search, Database, Cloud, Globe, FileText, Upload,
  Table2, Code2, Loader2, CheckCircle2, XCircle, Clock,
  Columns,
} from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// —— Types ————————————————————————————————————————————————————————————————————————

interface CatalogColumn { name: string; type: string }

interface CatalogItem {
  slug: string;
  name?: string;
  table?: string;
  id?: number;
  source_id?: number;
  source_slug?: string;
  row_count?: number | null;
  column_count?: number | null;
  source_type?: string;
  columns: CatalogColumn[];
}

interface CatalogSection {
  type: "datasets" | "source";
  id?: number;
  label: string;
  source_type?: string;
  status?: string;
  icon?: string;
  error?: string;
  items: CatalogItem[];
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  elapsed_ms: number;
  truncated: boolean;
  error?: string;
  registered_tables?: string[];
}

// —— Constants —————————————————————————————————————————————————————————————————————

const STARTER_SQL = `-- Query any table in the warehouse
-- Datasets use their name as the table (e.g. SELECT * FROM titanic)
-- Source tables are prefixed: source_name__table_name
-- Example cross-source join:
SELECT *
FROM titanic
LIMIT 100`;

const SOURCE_TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  postgresql: Database, mysql: Database, mssql: Database, sqlite: Database,
  redshift: Database, snowflake: Database, bigquery: Database, mongodb: Database,
  s3: Cloud, azure_blob: Cloud, gcs: Cloud, google_drive: Cloud,
  rest_api: Globe, graphql: Globe,
  csv: FileText, excel: FileText, json: FileText, parquet: FileText,
};

const SOURCE_TYPE_GROUP_LABEL: Record<string, string> = {
  rest_api: "API", graphql: "API",
  postgresql: "PostgreSQL", mysql: "MySQL", mssql: "SQL Server", sqlite: "SQLite",
  redshift: "Redshift", snowflake: "Snowflake", bigquery: "BigQuery", mongodb: "MongoDB",
  s3: "Amazon S3", azure_blob: "Azure Blob Storage", gcs: "Google Cloud Storage", google_drive: "Google Drive",
};

function sourceGroupLabel(sourceType?: string): string {
  if (!sourceType) return "Other";
  return SOURCE_TYPE_GROUP_LABEL[sourceType] ?? sourceType;
}

const TYPE_BADGE_COLOR: Record<string, string> = {
  INTEGER: "text-blue-400", BIGINT: "text-blue-400",
  DOUBLE: "text-purple-400", FLOAT: "text-purple-400",
  VARCHAR: "text-emerald-400", TEXT: "text-emerald-400",
  BOOLEAN: "text-amber-400",
  DATE: "text-pink-400", TIMESTAMP: "text-pink-400",
};

function typeColor(t: string) {
  for (const [k, v] of Object.entries(TYPE_BADGE_COLOR)) {
    if (t.toUpperCase().includes(k)) return v;
  }
  return "text-gray-400";
}

function StatusDot({ status }: { status?: string }) {
  if (status === "connected") return <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />;
  if (status === "failed") return <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />;
}

// —— Catalog tree components ———————————————————————————————————————————————————————

function ColumnRow({ col, onClick }: { col: CatalogColumn; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-[3px] hover:bg-gray-100 transition text-left group"
      title="Click to insert reference"
    >
      <Columns className="w-3 h-3 text-gray-300 flex-shrink-0" />
      <span className="font-mono text-[11px] text-gray-600 flex-1 truncate">{col.name}</span>
      <span className={`text-[9px] font-mono shrink-0 ${typeColor(col.type)}`}>
        {col.type.split("(")[0]}
      </span>
    </button>
  );
}

interface TableNodeProps {
  slug: string;
  label: string;
  columns: CatalogColumn[];
  rowCount?: number | null;
  isLoadingCols?: boolean;
  onExpand: () => void;
  onInsertSelect: () => void;
  onInsertCol: (col: string) => void;
}

function TableNode({ slug, label, columns, rowCount, isLoadingCols, onExpand, onInsertSelect, onInsertCol }: TableNodeProps) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    if (!open) onExpand();
    setOpen((p) => !p);
  };

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1.5 px-2 py-[5px] hover:bg-gray-100 transition group"
      >
        <Table2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <span className="font-mono text-[11px] text-gray-700 truncate block">{label || slug}</span>
          {slug !== label && slug && (
            <span className="font-mono text-[9px] text-gray-400 truncate block">{slug}</span>
          )}
        </div>
        {open ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="ml-3 border-l border-gray-200 pl-1">
          {isLoadingCols ? (
            <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading columns...
            </div>
          ) : columns.length === 0 ? (
            <p className="px-3 py-1 text-[10px] text-gray-400">No column info</p>
          ) : (
            columns.map((col) => (
              <ColumnRow key={col.name} col={col} onClick={() => onInsertCol(col.name)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  section: CatalogSection;
  search: string;
  workspaceId: string;
  onInsertSelect: (slug: string) => void;
  onInsertCol: (slug: string, col: string) => void;
}

function CatalogSectionBlock({ section, search, workspaceId, onInsertSelect, onInsertCol }: SectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [colsCache, setColsCache] = useState<Record<string, CatalogColumn[]>>({});
  const [loadingCols, setLoadingCols] = useState<Set<string>>(new Set());

  const Icon = section.source_type ? (SOURCE_TYPE_ICON[section.source_type] ?? Database) : Upload;

  const filteredItems = section.items.filter(
    (item) =>
      !search ||
      (item.slug ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (item.table ?? item.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleExpand = async (item: CatalogItem) => {
    if (item.columns.length > 0 || colsCache[item.slug]) return;
    if (section.type === "source" && item.source_id != null) {
      setLoadingCols((prev) => new Set(prev).add(item.slug));
      try {
        const res = await warehouseApi.sourceTableColumns(workspaceId, item.source_id, item.table!);
        setColsCache((prev) => ({ ...prev, [item.slug]: res.data.columns ?? [] }));
      } catch {
        setColsCache((prev) => ({ ...prev, [item.slug]: [] }));
      } finally {
        setLoadingCols((prev) => { const s = new Set(prev); s.delete(item.slug); return s; });
      }
    }
  };

  const getColumns = (item: CatalogItem): CatalogColumn[] =>
    colsCache[item.slug] ?? item.columns;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Section header */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-100 transition sticky top-0 bg-white z-10"
      >
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${section.type === "datasets" ? "text-indigo-500" : "text-brand"}`} />
        <span className="text-xs font-semibold text-gray-700 flex-1 text-left truncate">{section.label}</span>
        {section.status && section.type === "source" && <StatusDot status={section.status} />}
        <span className="text-[9px] text-gray-400 flex-shrink-0">{filteredItems.length}</span>
        {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </button>

      {/* Error banner */}
      {!collapsed && section.error && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded text-[10px] text-red-600 flex items-center gap-1">
          <XCircle className="w-3 h-3 flex-shrink-0" />
          {section.error.slice(0, 120)}
        </div>
      )}

      {/* Tables list */}
      {!collapsed && !section.error && filteredItems.length === 0 && (
        <p className="px-6 py-2 text-[10px] text-gray-400">
          {search ? "No matches" : "No tables found"}
        </p>
      )}

      {!collapsed && filteredItems.map((item) => (
        <TableNode
          key={item.slug}
          slug={item.slug}
          label={item.table ?? item.name ?? item.slug}
          columns={getColumns(item)}
          rowCount={item.row_count}
          isLoadingCols={loadingCols.has(item.slug)}
          onExpand={() => handleExpand(item)}
          onInsertSelect={() => onInsertSelect(item.slug)}
          onInsertCol={(col) => onInsertCol(item.slug, col)}
        />
      ))}
    </div>
  );
}

interface SourceTypeGroupProps {
  groupLabel: string;
  sourceType?: string;
  sections: CatalogSection[];
  search: string;
  workspaceId: string;
  onInsertSelect: (slug: string) => void;
  onInsertCol: (slug: string, col: string) => void;
}

function SourceTypeGroupBlock({
  groupLabel, sourceType, sections, search, workspaceId, onInsertSelect, onInsertCol,
}: SourceTypeGroupProps) {
  const [collapsed, setCollapsed] = useState(true);
  const Icon = sourceType ? (SOURCE_TYPE_ICON[sourceType] ?? Database) : Database;
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0);

  if (sections.length === 1) {
    return (
      <CatalogSectionBlock
        section={sections[0]}
        search={search}
        workspaceId={workspaceId}
        onInsertSelect={onInsertSelect}
        onInsertCol={onInsertCol}
      />
    );
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-100 transition sticky top-0 bg-white z-10"
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0 text-brand" />
        <span className="text-xs font-semibold text-gray-700 flex-1 text-left truncate">{groupLabel}</span>
        <span className="text-[9px] text-gray-400 flex-shrink-0">{sections.length} sources · {totalItems}</span>
        {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </button>

      {!collapsed && (
        <div className="ml-2 border-l border-gray-200">
          {sections.map((section, i) => (
            <CatalogSectionBlock
              key={section.id ?? section.type + i}
              section={section}
              search={search}
              workspaceId={workspaceId}
              onInsertSelect={onInsertSelect}
              onInsertCol={onInsertCol}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// —— Main page ——————————————————————————————————————————————————————————————————————

export default function WarehousePage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const [sql, setSql] = useState(STARTER_SQL);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"results" | "explain">("results");
  const [limit, setLimit] = useState(5000);
  const [showCatalog, setShowCatalog] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState("");
  const editorRef = useRef<unknown>(null);
  const runQueryRef = useRef<() => Promise<void>>(async () => {});

  const { data: catalogData, isLoading: catalogLoading, refetch: refetchCatalog } = useQuery({
    queryKey: ["warehouse-catalog", workspaceId],
    queryFn: () => warehouseApi.catalog(workspaceId).then((r) => r.data),
    refetchOnWindowFocus: false,
  });

  const sections: CatalogSection[] = catalogData?.sections ?? [];
  const totalTables = sections.reduce((s, sec) => s + sec.items.length, 0);

  const datasetSections = sections.filter((s) => s.type === "datasets");
  const sourceGroups: { key: string; label: string; sourceType?: string; sections: CatalogSection[] }[] = [];
  for (const section of sections) {
    if (section.type !== "source") continue;
    const key = section.source_type ?? "other";
    let group = sourceGroups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: sourceGroupLabel(section.source_type), sourceType: section.source_type, sections: [] };
      sourceGroups.push(group);
    }
    group.sections.push(section);
  }
  const totalCols = sections.reduce(
    (s, sec) => s + sec.items.reduce((ss, item) => ss + (item.columns?.length ?? 0), 0),
    0
  );

  const insertSelect = useCallback((slug: string) => {
    setSql(`SELECT *\nFROM ${slug}\nLIMIT 100`);
  }, []);

  const insertCol = useCallback((slug: string, col: string) => {
    setSql((prev) => prev + `\n-- ${slug}.${col}`);
  }, []);

  const runQuery = useCallback(async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setResult(null);
    setPlan(null);
    setActiveTab("results");
    try {
      const res = await warehouseApi.execute(workspaceId, sql, limit);
      setResult(res.data);
    } catch {
      setResult({ columns: [], rows: [], row_count: 0, elapsed_ms: 0, truncated: false, error: "Query failed" });
    } finally {
      setLoading(false);
    }
  }, [sql, workspaceId, limit]);

  useEffect(() => {
    runQueryRef.current = runQuery;
  }, [runQuery]);

  const runExplain = useCallback(async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setPlan(null);
    setActiveTab("explain");
    try {
      const res = await warehouseApi.explain(workspaceId, sql);
      setPlan(res.data.plan ?? res.data.error ?? "No plan returned");
    } catch {
      setPlan("Could not generate query plan");
    } finally {
      setLoading(false);
    }
  }, [sql, workspaceId]);

  const copyResult = () => {
    if (!result) return;
    const header = result.columns.join("\t");
    const rows = result.rows.map((r) => (r as unknown[]).join("\t")).join("\n");
    navigator.clipboard.writeText(`${header}\n${rows}`);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">

      {/* —— Catalog panel ——————————————————————————————————————————————————————————————— */}
      <div
        className="border-r border-gray-200 bg-white flex flex-col flex-shrink-0 transition-all duration-200"
        style={{ width: showCatalog ? 280 : 0, minWidth: showCatalog ? 280 : 0 }}
      >
        {showCatalog && (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <Database className="w-4 h-4 text-brand" />
              <span className="text-xs font-bold text-gray-700 flex-1">Warehouse Catalog</span>
              <button
                onClick={() => setShowCatalog(false)}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tables and columns..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Catalog tree */}
            <div className="flex-1 overflow-y-auto">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog...
                </div>
              ) : sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 px-4 text-center">
                  <Database className="w-8 h-8 opacity-20" />
                  <p className="text-xs">No data in warehouse</p>
                  <p className="text-[10px]">Upload datasets or connect data sources to start querying</p>
                </div>
              ) : (
                <>
                  {datasetSections.map((section, i) => (
                    <CatalogSectionBlock
                      key={section.id ?? section.type + i}
                      section={section}
                      search={catalogSearch}
                      workspaceId={workspaceId}
                      onInsertSelect={insertSelect}
                      onInsertCol={insertCol}
                    />
                  ))}
                  {sourceGroups.map((group) => (
                    <SourceTypeGroupBlock
                      key={group.key}
                      groupLabel={group.label}
                      sourceType={group.sourceType}
                      sections={group.sections}
                      search={catalogSearch}
                      workspaceId={workspaceId}
                      onInsertSelect={insertSelect}
                      onInsertCol={insertCol}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Refresh button */}
            <div className="border-t border-gray-200 p-2 flex-shrink-0">
              <button
                onClick={() => refetchCatalog()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition"
              >
                <RotateCcw className="w-3 h-3" /> Refresh catalog
              </button>
            </div>
          </>
        )}
      </div>

      {/* —— Editor + Results ———————————————————————————————————————————————————————————— */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          {!showCatalog && (
            <button
              onClick={() => setShowCatalog(true)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 mr-1"
              title="Show catalog"
            >
              <Code2 className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm font-bold text-gray-800">Warehouse</span>
          <span className="text-gray-200 text-xs">|</span>



          <div className="flex-1" />

          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Limit
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(100000, Number(e.target.value))))}
              className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand"
            />
          </label>

          <button
            onClick={runExplain}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <Zap className="w-3.5 h-3.5" /> Explain
          </button>

          <button
            onClick={runQuery}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-[#2a0d8a] disabled:opacity-50 transition"
          >
            <Play className="w-3.5 h-3.5" />
            {loading ? "Running..." : "Run (CmdEnter)"}
          </button>
        </div>

        {/* Monaco */}
        <div className="border-b border-gray-200 flex-shrink-0" style={{ height: 220 }}>
          <MonacoEditor
            height="220px"
            language="sql"
            value={sql}
            onChange={(v) => setSql(v ?? "")}
            onMount={(editor) => {
              editorRef.current = editor;
              const monaco = (window as any).monaco;
              if (monaco) {
                const keybinding = monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter;
                editor.addCommand(keybinding, () => runQueryRef.current());
              }
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
              padding: { top: 8 },
              renderLineHighlight: "line",
              theme: "vs",
            }}
          />
        </div>


        {/* Results */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-gray-200 bg-white px-3 flex-shrink-0">
            <button
              onClick={() => setActiveTab("results")}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition ${
                activeTab === "results"
                  ? "border-brand text-brand"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Results
              {result && !result.error && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-brand text-[10px]">
                  {result.row_count}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("explain")}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition ${
                activeTab === "explain"
                  ? "border-brand text-brand"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Explain
            </button>

            <div className="flex-1" />

            {result && !result.error && result.elapsed_ms > 0 && (
              <span className="text-[10px] text-gray-400">{result.elapsed_ms}ms</span>
            )}
            {result && !result.error && result.columns.length > 0 && (
              <button onClick={copyResult} className="ml-2 p-1.5 text-gray-400 hover:text-gray-700 transition" title="Copy as TSV">
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => { setResult(null); setPlan(null); setSql(STARTER_SQL); }}
              className="ml-1 p-1.5 text-gray-400 hover:text-gray-700 transition"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {loading && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand" />
                <p className="text-xs">Executing across warehouse...</p>
              </div>
            )}

            {!loading && activeTab === "results" && (
              <>
                {!result && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <Database className="w-10 h-10 opacity-15" />
                    <p className="text-sm font-medium">Run SQL across your warehouse</p>
                    {totalTables > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center max-w-md">
                        {sections.slice(0, 3).flatMap((s) =>
                          s.items.slice(0, 5).map((item) => (
                            <button
                              key={item.slug}
                              onClick={() => insertSelect(item.slug)}
                              className="font-mono text-[10px] bg-blue-50 text-brand px-2 py-0.5 rounded hover:bg-brand/20 transition"
                            >
                              {item.slug}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                {result?.error && (
                  <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-700 mb-1">Query Error</p>
                    <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">{result.error}</pre>
                  </div>
                )}
                {result && !result.error && result.columns.length > 0 && (
                  <SqlResultsTable columns={result.columns} rows={result.rows} truncated={result.truncated} rowCount={result.row_count} />
                )}
                {result && !result.error && result.columns.length === 0 && (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">Query returned no rows</div>
                )}
              </>
            )}

            {!loading && activeTab === "explain" && (
              <>
                {!plan ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                    <Zap className="w-8 h-8 opacity-20" />
                    <p className="text-sm">Click Explain to see the query plan</p>
                  </div>
                ) : (
                  <pre className="m-4 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-auto whitespace-pre-wrap">{plan}</pre>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
