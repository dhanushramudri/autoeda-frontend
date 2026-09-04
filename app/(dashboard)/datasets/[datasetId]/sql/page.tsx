"use client";

import { useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SubNav } from "@/components/layout/SubNav";
import { SqlResultsTable } from "@/components/shared/SqlResultsTable";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Play, Zap, Copy, RotateCcw, ChevronDown, ChevronUp, Code2 } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const STARTER_SQL = `-- Query your dataset as a table called "df"
SELECT *
FROM df
LIMIT 100`;

const SNIPPETS = [
  { label: "Count rows", sql: "SELECT COUNT(*) AS row_count FROM df" },
  { label: "Column stats", sql: "SELECT * FROM df LIMIT 100" },
  { label: "Null counts", sql: "SELECT\n  COUNT(*) AS total,\n  COUNT(*) - COUNT(*) FILTER (WHERE true) AS nulls\nFROM df" },
  { label: "Distinct values", sql: "SELECT DISTINCT column_name FROM df LIMIT 50" },
  { label: "Group by", sql: "SELECT column_name, COUNT(*) AS cnt\nFROM df\nGROUP BY column_name\nORDER BY cnt DESC\nLIMIT 20" },
];

console.log("health check");

interface SqlResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  elapsed_ms: number;
  truncated: boolean;
  error?: string;
}

interface SchemaColumn {
  name: string;
  type: string;
}

export default function SqlEditorPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [sql, setSql] = useState(STARTER_SQL);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSchema, setShowSchema] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const [limit, setLimit] = useState(1000);
  const [activeTab, setActiveTab] = useState<"results" | "explain">("results");
  const editorRef = useRef<unknown>(null);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: queryKeys.sql.schema(datasetId),
    queryFn: () => datasetsApi.sqlSchema(datasetId).then((r) => r.data),
  });

  const runQuery = useCallback(async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setResult(null);
    setPlan(null);
    setActiveTab("results");
    try {
      const res = await datasetsApi.sqlExecute(datasetId, sql, limit);
      setResult(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setResult({
        columns: [],
        rows: [],
        row_count: 0,
        elapsed_ms: 0,
        truncated: false,
        error: err?.response?.data?.detail ?? "Query failed",
      });
    } finally {
      setLoading(false);
    }
  }, [sql, datasetId, limit]);

  const runExplain = useCallback(async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setPlan(null);
    setActiveTab("explain");
    try {
      const res = await datasetsApi.sqlExplain(datasetId, sql);
      setPlan(res.data.plan ?? res.data.error ?? "No plan returned");
    } catch {
      setPlan("Could not generate query plan");
    } finally {
      setLoading(false);
    }
  }, [sql, datasetId]);

  const copyResult = () => {
    if (!result) return;
    const header = result.columns.join("\t");
    const rows = result.rows.map((r) => (r as unknown[]).join("\t")).join("\n");
    navigator.clipboard.writeText(`${header}\n${rows}`);
  };

  const schemaColumns: SchemaColumn[] = schema?.columns ?? [];

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="flex h-[calc(100vh-104px)] overflow-hidden">
        {/* Schema panel */}
        <div
          className="border-r border-border bg-muted flex flex-col transition-all duration-200"
          style={{ width: showSchema ? 220 : 0, minWidth: showSchema ? 220 : 0 }}
        >
          {showSchema && (
            <>
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schema</span>
                <button onClick={() => setShowSchema(false)} className="text-muted-foreground hover:text-muted-foreground">
                  <ChevronUp className="w-3.5 h-3.5 rotate-90" />
                </button>
              </div>
              <div className="px-3 py-1.5 border-b border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Table: df</p>
                <p className="text-[10px] text-muted-foreground">{dataset?.name}</p>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {schemaLoading ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Loading...</p>
                ) : (
                  schemaColumns.map((col) => (
                    <button
                      key={col.name}
                      className="w-full text-left px-3 py-1 hover:bg-muted flex items-center gap-2 group"
                      onClick={() => {
                        setSql((prev) => prev + `\n-- ${col.name} (${col.type})`);
                      }}
                      title={`Click to insert column reference`}
                    >
                      <span className="font-mono text-[10px] text-foreground flex-1 truncate">{col.name}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">{col.type}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-border p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 px-1">Snippets</p>
                {SNIPPETS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSql(s.sql)}
                    className="w-full text-left px-2 py-1 text-[10px] text-brand hover:bg-brand/10 rounded truncate"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Main editor + results */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card flex-shrink-0">
            {!showSchema && (
              <button
                onClick={() => setShowSchema(true)}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                title="Show schema"
              >
                <Code2 className="w-4 h-4" />
              </button>
            )}
            <span className="text-sm font-semibold text-foreground">SQL Editor</span>
            <span className="text-muted-foreground/60 text-xs">--</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{dataset?.name}</span>

            <div className="flex-1" />

            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Limit
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(100000, Number(e.target.value))))}
                className="w-20 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-brand"
              />
            </label>

            <button
              onClick={runExplain}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 transition"
            >
              <Zap className="w-3.5 h-3.5" />
              Explain
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

          {/* Monaco editor */}
          <div className="border-b border-border flex-shrink-0" style={{ height: 240 }}>
            <MonacoEditor
              height="240px"
              language="sql"
              value={sql}
              onChange={(v) => setSql(v ?? "")}
              onMount={(editor) => {
              editorRef.current = editor;
              const monaco = (window as any).monaco;
              if (monaco) {
                const keybinding = monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter;
                editor.addCommand(keybinding, runQuery);
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

          {/* Results area */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tabs */}
            <div className="flex items-center border-b border-border bg-card px-3 flex-shrink-0">
              <button
                onClick={() => setActiveTab("results")}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition ${activeTab === "results" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Results
                {result && !result.error && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-brand text-[10px]">
                    {result.row_count}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("explain")}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition ${activeTab === "explain" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Explain
              </button>
              {result && !result.error && result.elapsed_ms > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">{result.elapsed_ms}ms</span>
              )}
              {result && !result.error && result.columns.length > 0 && (
                <button
                  onClick={copyResult}
                  className="ml-2 p-1.5 text-muted-foreground hover:text-foreground transition"
                  title="Copy as TSV"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => { setResult(null); setPlan(null); setSql(STARTER_SQL); }}
                className="ml-1 p-1.5 text-muted-foreground hover:text-foreground transition"
                title="Reset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Result content */}
            <div className="flex-1 min-h-0">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <PageSpinner />
                </div>
              )}

              {!loading && activeTab === "results" && (
                <>
                  {!result && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                      <Play className="w-8 h-8 opacity-30" />
                      <p className="text-sm">Run a query to see results</p>
                    </div>
                  )}
                  {result?.error && (
                    <div className="m-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Query Error</p>
                      <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">{result.error}</pre>
                    </div>
                  )}
                  {result && !result.error && result.columns.length > 0 && (
                    <SqlResultsTable
                      columns={result.columns}
                      rows={result.rows}
                      truncated={result.truncated}
                      rowCount={result.row_count}
                    />
                  )}
                  {result && !result.error && result.columns.length === 0 && (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Query returned no rows
                    </div>
                  )}
                </>
              )}

              {!loading && activeTab === "explain" && (
                <>
                  {!plan && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                      <Zap className="w-8 h-8 opacity-30" />
                      <p className="text-sm">Click Explain to see the query plan</p>
                    </div>
                  )}
                  {plan && (
                    <pre className="m-4 p-4 bg-gray-900 text-green-400 dark:text-green-400 rounded-lg text-xs font-mono overflow-auto whitespace-pre-wrap">
                      {plan}
                    </pre>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
