"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sourcesApi } from "@/lib/api";
import {
  ArrowLeft, Database, Table2, ChevronRight, ChevronDown,
  Download, Eye, Search, Loader2, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { SqlResultsTable } from "@/components/shared/SqlResultsTable";

interface SchemaColumn {
  name: string;
  type: string;
}

interface PreviewResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
}

export default function BrowseSourcePage() {
  const { id: workspaceId, sourceId } = useParams<{ id: string; sourceId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<SchemaColumn[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importName, setImportName] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [searchTable, setSearchTable] = useState("");

  const { data: sourceData } = useQuery({
    queryKey: ["source", workspaceId, sourceId],
    queryFn: () => sourcesApi.get(workspaceId, Number(sourceId)).then((r) => r.data),
  });

  const { data: schemaData, isLoading: schemaLoading } = useQuery({
    queryKey: ["source-schema", workspaceId, sourceId],
    queryFn: () => sourcesApi.schema(workspaceId, Number(sourceId)).then((r) => r.data),
  });

  const importMut = useMutation({
    mutationFn: () =>
      sourcesApi.importAsDataset(workspaceId, Number(sourceId), {
        dataset_name: importName.trim(),
        workspace_id: Number(workspaceId),
        limit: 100000,
      }),
    onSuccess: () => {
      setImportSuccess(true);
      qc.invalidateQueries({ queryKey: ["datasets", workspaceId] });
      setTimeout(() => {
        router.push(`/workspaces/${workspaceId}/datasets`);
      }, 1500);
    },
  });

  const tables: string[] = schemaData?.tables ?? schemaData?.objects ?? [];
  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(searchTable.toLowerCase())
  );

  const handleSelectTable = async (table: string) => {
    setSelectedTable(table);
    setPreview(null);
    setExpandedTable(table);
    setImportName(`${sourceData?.name ?? "source"} - ${table}`);

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

  const source = sourceData;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <Link
          href={`/workspaces/${workspaceId}/sources`}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Database className="w-5 h-5 text-brand" />
        <div>
          <h1 className="text-base font-bold text-gray-900">{source?.name ?? "Data Source"}</h1>
          <p className="text-xs text-gray-500">{source?.source_type}</p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: Schema Tree */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Filter tables..."
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {schemaLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading schema...
              </div>
            ) : filteredTables.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400">No tables found</p>
            ) : (
              filteredTables.map((table) => (
                <div key={table}>
                  <button
                    onClick={() => handleSelectTable(table)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition ${
                      selectedTable === table
                        ? "bg-blue-50 text-brand font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Table2 className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                    <span className="flex-1 text-left truncate font-mono">{table}</span>
                    {expandedTable === table ? (
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                    )}
                  </button>

                  {expandedTable === table && tableColumns.length > 0 && (
                    <div className="ml-4 border-l border-gray-200 pl-2 pb-1">
                      {tableColumns.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center gap-2 px-2 py-1 text-[11px] text-gray-500"
                        >
                          <span className="font-mono truncate flex-1">{col.name}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{col.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Preview + Import */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedTable ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <Table2 className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a table to preview and import</p>
            </div>
          ) : (
            <>
              {/* Table actions bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                <span className="font-mono text-sm font-semibold text-gray-700">{selectedTable}</span>
                <div className="flex-1" />
                <button
                  onClick={() => handlePreview(selectedTable)}
                  disabled={previewLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  Preview 100 rows
                </button>

                {/* Import panel */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder="Dataset name..."
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand w-48"
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

              {/* Preview table */}
              <div className="flex-1 min-h-0">
                {previewLoading && (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                  </div>
                )}
                {!previewLoading && !preview && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                    <Eye className="w-8 h-8 opacity-20" />
                    <p className="text-sm">Click "Preview 100 rows" to sample this table</p>
                  </div>
                )}
                {preview && (
                  <SqlResultsTable
                    columns={preview.columns}
                    rows={preview.rows}
                    rowCount={preview.row_count}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
