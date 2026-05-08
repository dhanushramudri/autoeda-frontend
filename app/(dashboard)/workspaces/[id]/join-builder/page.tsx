"use client";

import {
  useState, useCallback, useRef, useEffect,
} from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  ConnectionLineType,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type EdgeProps,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { datasetsApi, workspacesExtraApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SqlResultsTable } from "@/components/shared/SqlResultsTable";
import { PageSpinner } from "@/components/shared/LoadingBar";
import {
  GitMerge, Database, Plus, Trash2, X, Play, Code2, Copy,
  ChevronDown, ChevronUp, Search, Download, Undo2, Maximize2,
  AlertCircle, CheckCircle2, Info,
} from "lucide-react";
import type { Dataset } from "@/types";

// ────────── Constants ──────────────────────────────────────────────────────

const JOIN_TYPES = ["INNER", "LEFT", "RIGHT", "FULL"] as const;
type JoinType = typeof JOIN_TYPES[number];

const JOIN_META: Record<JoinType, { color: string; bg: string; border: string; desc: string; symbol: string }> = {
  INNER: { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", desc: "Only matching rows from both tables", symbol: "⋈" },
  LEFT:  { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", desc: "All left rows + matching right rows", symbol: "⟕" },
  RIGHT: { color: "#10b981", bg: "#f0fdf4", border: "#a7f3d0", desc: "All right rows + matching left rows", symbol: "⟵" },
  FULL:  { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", desc: "All rows from both tables", symbol: "⟷" },
};

// ────────── Types ──────────────────────────────────────────────────────────

interface JoinCondition { sourceKey: string; targetKey: string }
interface EdgeData {
  joinType: JoinType;
  conditions: JoinCondition[];
  label?: string;
}
interface NodeData {
  label: string;
  datasetId: number | string;
  columns: string[];
  onDelete: (id: string) => void;
  onSuggestKey: (nodeId: string, col: string) => void;
}
interface SqlResult {
  sql: string; columns: string[]; rows: unknown[][];
  row_count: number; truncated: boolean; error?: string;
}
interface HistoryEntry { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] }

// ────────── Dataset Node ──────────────────────────────────────────────────

function DatasetNode({ id, data, selected }: NodeProps<NodeData>) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const filtered = data.columns.filter((c) => c.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      className="rounded-xl shadow-lg bg-white flex flex-col"
      style={{
        minWidth: 210,
        maxWidth: 240,
        border: `2px solid ${selected ? "#3b82f6" : "#e2e8f0"}`,
        transition: "border-color 0.15s",
      }}
    >
      {/* Left (target) handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ width: 14, height: 14, background: "#8b5cf6", border: "3px solid #fff", boxShadow: "0 0 0 2px #8b5cf6", left: -8 }}
      />

      {/* Header */}
      <div
        className="px-2.5 py-2 flex items-center gap-1.5 rounded-t-xl"
        style={{ background: selected ? "#eff6ff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}
      >
        <Database className="w-3.5 h-3.5 text-brand flex-shrink-0" />
        <span className="text-xs font-bold text-gray-800 flex-1 truncate">{data.label}</span>
        <span className="text-[9px] text-gray-400">{data.columns.length} cols</span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        <button
          onClick={() => data.onDelete(id)}
          className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
          title="Remove from canvas"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Column list */}
      {!collapsed && (
        <>
          {data.columns.length > 8 && (
            <div className="px-2 pt-1.5 pb-1">
              <div className="flex items-center gap-1 border border-gray-200 rounded px-2 py-0.5 bg-white">
                <Search className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                <input
                  className="text-[10px] bg-transparent outline-none flex-1 text-gray-600 placeholder-gray-300"
                  placeholder="Search columns..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  // prevent ReactFlow drag when typing
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto divide-y divide-gray-50" style={{ maxHeight: 200 }}>
            {filtered.slice(0, 30).map((col) => (
              <button
                key={col}
                className="w-full text-left px-3 py-1 hover:bg-brand/10 group flex items-center gap-1.5 transition-colors"
                onClick={() => data.onSuggestKey(id, col)}
                title={`Click to suggest "${col}" as a join key`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-blue-400 flex-shrink-0 transition-colors" />
                <span className="text-[10px] font-mono text-gray-600 group-hover:text-brand truncate">{col}</span>
              </button>
            ))}
            {filtered.length > 30 && (
              <div className="px-3 py-1">
                <span className="text-[9px] text-gray-400">+{filtered.length - 30} more</span>
              </div>
            )}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-gray-400">No matching columns</div>
            )}
          </div>
        </>
      )}

      {/* Footer hint */}
      <div className="px-2.5 py-1 rounded-b-xl" style={{ borderTop: "1px solid #f1f5f9", background: "#fafafa" }}>
        <span className="text-[9px] text-gray-400">
          Drag <span className="font-bold text-brand">→</span> (right) → <span className="font-bold text-purple-500">←</span> (left) to join
        </span>
      </div>

      {/* Right (source) handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ width: 14, height: 14, background: "#3b82f6", border: "3px solid #fff", boxShadow: "0 0 0 2px #3b82f6", right: -8 }}
      />
    </div>
  );
}

const nodeTypes = { datasetNode: DatasetNode };

// ────────── Join Edge ──────────────────────────────────────────────────────

function JoinEdge({ id, sourceX, sourceY, targetX, targetY, data, selected, markerEnd }: EdgeProps<EdgeData>) {
  const jt = data?.joinType ?? "INNER";
  const meta = JOIN_META[jt];
  const condCount = data?.conditions?.length ?? 0;
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: meta.color, strokeWidth: selected ? 3 : 2.5, filter: selected ? `drop-shadow(0 0 4px ${meta.color}88)` : "none" }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            zIndex: 10,
          }}
          className="nodrag nopan flex flex-col items-center gap-0.5"
        >
          {/* Join type badge */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full shadow-md cursor-pointer select-none"
            style={{ background: meta.color }}
            title="Click edge to configure"
          >
            <span className="text-white text-[10px] font-bold">{jt}</span>
            <span className="text-white text-[11px]">{meta.symbol}</span>
          </div>

          {/* Condition pills */}
          {condCount > 0 && data?.conditions.map((c, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-[9px] font-mono shadow-sm border"
              style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
            >
              {c.sourceKey} = {c.targetKey}
            </span>
          ))}

          {condCount === 0 && (
            <span className="px-2 py-0.5 rounded text-[9px] bg-amber-50 border border-amber-200 text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              set keys
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { joinEdge: JoinEdge };

// ────────── Main Component (needs ReactFlowProvider) ────────────────────────

function JoinBuilderInner() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const { fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);

  // ────── Stable refs for current state (avoids stale closures without causing re-renders) ──
  const nodesRef = useRef<Node<NodeData>[]>([]);
  const edgesRef = useRef<Edge<EdgeData>[]>([]);
  const selectedEdgeIdRef = useRef<string | null>(null);
  // Keep refs in sync -- these effects never call setNodes/setEdges, so no loop
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // ────── Undo history ──────────────────────────────────────────────────────
  const history = useRef<HistoryEntry[]>([]);
  // pushHistory uses refs -> empty deps -> always stable
  const pushHistory = useCallback(() => {
    history.current = [
      ...history.current.slice(-29),
      { nodes: nodesRef.current, edges: edgesRef.current },
    ];
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return;
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [setNodes, setEdges]);

  // ────── Selected edge state + ref ──────────────────────────────────────────
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeConfig, setEdgeConfig] = useState<{ joinType: JoinType; conditions: JoinCondition[] }>({
    joinType: "INNER", conditions: [],
  });
  useEffect(() => { selectedEdgeIdRef.current = selectedEdgeId; }, [selectedEdgeId]);

  // Key suggestion from node column click
  const [suggestedKey, setSuggestedKey] = useState<{ nodeId: string; col: string } | null>(null);

  // Results & SQL
  const [result, setResult] = useState<SqlResult | null>(null);
  const [generatedSql, setGeneratedSql] = useState("");
  const [showSql, setShowSql] = useState(false);
  const [rowLimit, setRowLimit] = useState(1000);
  const [datasetSchemas, setDatasetSchemas] = useState<Record<string | number, string[]>>({});
  const nodeIdCounter = useRef(0);

  // Data
  const { data: datasets, isLoading } = useQuery({
    queryKey: queryKeys.datasets.list(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId).then((r) => r.data),
  });

  // ────── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if (e.key === "Escape") setSelectedEdgeId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  // ────── Delete node -- stable: pushHistory is stable, setNodes/setEdges are stable ──
  const deleteNode = useCallback((id: string) => {
    pushHistory();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [pushHistory, setNodes, setEdges]);

  // ────── Column click -> suggest join key -- stable: uses refs, no state deps ────
  const handleSuggestKey = useCallback((nodeId: string, col: string) => {
    if (!selectedEdgeIdRef.current) {
      setSuggestedKey({ nodeId, col });
      return;
    }
    const edge = edgesRef.current.find((e) => e.id === selectedEdgeIdRef.current);
    if (!edge) return;
    const srcNode = nodesRef.current.find((n) => n.id === edge.source);
    const isSource = srcNode?.id === nodeId;
    setEdgeConfig((cfg) => {
      const conds = [...cfg.conditions];
      if (conds.length === 0) conds.push({ sourceKey: "", targetKey: "" });
      const last = conds[conds.length - 1];
      conds[conds.length - 1] = isSource
        ? { ...last, sourceKey: col }
        : { ...last, targetKey: col };
      return { ...cfg, conditions: conds };
    });
  }, []); // -> empty deps: truly stable forever

  // ────── Stable wrapper ref: delegates to latest callbacks without changing identity ──
  // This is the key fix -- node data holds wrappers that call through the ref,
  // so node data never needs to be updated when callbacks change.
  const cbRef = useRef({ deleteNode, handleSuggestKey });
  cbRef.current.deleteNode = deleteNode;
  cbRef.current.handleSuggestKey = handleSuggestKey;
  // These wrappers are created once and never change
  const stableOnDelete = useRef((id: string) => cbRef.current.deleteNode(id)).current;
  const stableOnSuggestKey = useRef((nodeId: string, col: string) => cbRef.current.handleSuggestKey(nodeId, col)).current;

  // ────── Add dataset to canvas ────────────────────────────────────────────
  const addDatasetNode = async (ds: Dataset) => {
    let cols: string[] = datasetSchemas[ds.id] ?? [];
    if (!cols.length) {
      try {
        const res = await datasetsApi.sqlSchema(ds.id);
        cols = (res.data.columns ?? []).map((c: { name: string }) => c.name);
        setDatasetSchemas((prev) => ({ ...prev, [ds.id]: cols }));
      } catch { cols = []; }
    }
    pushHistory();
    const nodeId = `ds-${ds.id}-${++nodeIdCounter.current}`;
    setNodes((nds) => {
      const sameCount = nds.filter((n) => n.data.datasetId === ds.id).length;
      return [
        ...nds,
        {
          id: nodeId,
          type: "datasetNode",
          position: {
            x: 80 + (nds.length % 3) * 280,
            y: 60 + Math.floor(nds.length / 3) * 380,
          },
          data: {
            label: sameCount > 0 ? `${ds.name} (${sameCount + 1})` : ds.name,
            datasetId: ds.id,
            columns: cols,
            // Use stable wrappers -- no useEffect needed, no infinite loop
            onDelete: stableOnDelete,
            onSuggestKey: stableOnSuggestKey,
          },
        } as Node<NodeData>,
      ];
    });
  };

  // ────── Connect two nodes ────────────────────────────────────────────────
  const onConnect = useCallback(
    (conn: Connection) => {
      pushHistory();
      const edgeId = `edge-${Date.now()}`;

      // Auto-detect matching column names -- use ref to avoid stale closure
      const srcNode = nodesRef.current.find((n) => n.id === conn.source);
      const tgtNode = nodesRef.current.find((n) => n.id === conn.target);
      const srcCols = new Set(srcNode?.data.columns ?? []);
      const tgtCols = tgtNode?.data.columns ?? [];
      const autoMatch = tgtCols.find((c) => srcCols.has(c));
      const initConditions: JoinCondition[] = autoMatch
        ? [{ sourceKey: autoMatch, targetKey: autoMatch }]
        : [];

  const newEdge: Edge<EdgeData> = {
    ...conn,
    id: edgeId,
    type: "joinEdge",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
    data: { joinType: "INNER", conditions: initConditions },
    source: conn.source!,
    target: conn.target!,
  };
 
      setEdges((eds) => addEdge(newEdge, eds));

      // Open config immediately
      setSelectedEdgeId(edgeId);
      setEdgeConfig({ joinType: "INNER", conditions: initConditions });
      setSuggestedKey(null);
    },
    [pushHistory, setEdges]  // nodesRef is a ref -- not a dep
  );

  // ────── Edge click ────────────────────────────────────────────────────────
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge<EdgeData>) => {
    setSelectedEdgeId(edge.id);
    setEdgeConfig({
      joinType: edge.data?.joinType ?? "INNER",
      conditions: edge.data?.conditions ?? [],
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    setSuggestedKey(null);
  }, []);

  // ────── Edge deletion -- uses ref for selectedEdgeId to stay stable ───────
  const deleteEdge = useCallback((edgeId: string) => {
    pushHistory();
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    if (selectedEdgeIdRef.current === edgeId) setSelectedEdgeId(null);
  }, [pushHistory, setEdges]);

  // ────── Apply config ────────────────────────────────────────────────────
  const applyEdgeConfig = () => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === selectedEdgeId
          ? { ...e, data: { joinType: edgeConfig.joinType, conditions: edgeConfig.conditions } }
          : e
      )
    );
    setSelectedEdgeId(null);
  };

  // ────── Condition helpers ────────────────────────────────────────────────
  const addCondition = () =>
    setEdgeConfig((c) => ({ ...c, conditions: [...c.conditions, { sourceKey: "", targetKey: "" }] }));

  const removeCondition = (i: number) =>
    setEdgeConfig((c) => ({ ...c, conditions: c.conditions.filter((_, idx) => idx !== i) }));

  const updateCondition = (i: number, field: "sourceKey" | "targetKey", val: string) =>
    setEdgeConfig((c) => {
      const conds = [...c.conditions];
      conds[i] = { ...conds[i], [field]: val };
      return { ...c, conditions: conds };
    });

  // ────── Build API payload ────────────────────────────────────────────────
  const buildPayload = () => ({
    nodes: nodes.map((n) => ({ id: n.data.datasetId, label: n.data.label })),
    edges: edges.map((e) => {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      const conds = e.data?.conditions ?? [];
      return {
        source: src?.data.datasetId ?? e.source,
        target: tgt?.data.datasetId ?? e.target,
        join_type: e.data?.joinType ?? "INNER",
        source_key: conds[0]?.sourceKey ?? "",
        target_key: conds[0]?.targetKey ?? "",
        conditions: conds.map((c) => ({ source_key: c.sourceKey, target_key: c.targetKey })),
      };
    }),
  });

  const generateSqlMutation = useMutation({
    mutationFn: () => workspacesExtraApi.generateJoinSql(workspaceId, buildPayload()),
    onSuccess: (res) => { setGeneratedSql(res.data.sql ?? ""); setShowSql(true); },
  });

  const executeMutation = useMutation({
    mutationFn: () => workspacesExtraApi.executeJoin(workspaceId, { ...buildPayload(), limit: rowLimit }),
    onSuccess: (res) => { setResult(res.data); setShowSql(false); },
  });

  // ────── Export result as CSV ────────────────────────────────────────────
  const exportCsv = () => {
    if (!result) return;
    const rows = [result.columns.join(","), ...result.rows.map((r) => (r as unknown[]).map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "join_result.csv";
    a.click();
  };

  // ────── Derived state ────────────────────────────────────────────────────
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const srcNode = selectedEdge ? nodes.find((n) => n.id === selectedEdge.source) : null;
  const tgtNode = selectedEdge ? nodes.find((n) => n.id === selectedEdge.target) : null;
  const srcCols = srcNode?.data.columns ?? [];
  const tgtCols = tgtNode?.data.columns ?? [];
  const configuredEdges = edges.filter((e) => (e.data?.conditions?.length ?? 0) > 0).length;
  const readyToRun = nodes.length >= 2 && edges.length > 0 && configuredEdges === edges.length;

  // Smart suggestions: matching column names
  const matchingSuggestions = srcCols.filter((c) => tgtCols.includes(c)).slice(0, 5);

  if (isLoading) return <PageSpinner />;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-slate-50">

      {/* ═════════════ LEFT PANEL ═════════════ */}
      <div className="w-60 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-2 mb-0.5">
            <GitMerge className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">Join Builder</span>
          </div>
          <p className="text-[10px] text-blue-200 leading-snug">
            Add tables · Connect handles · Configure keys
          </p>
        </div>

        {/* Dataset list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Tables ({(datasets ?? []).length})
          </p>
          <div className="space-y-1">
            {(datasets ?? []).map((ds: Dataset) => {
              const onCanvas = nodes.filter((n) => n.data.datasetId === ds.id).length;
              return (
                <button
                  key={ds.id}
                  onClick={() => addDatasetNode(ds)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gray-100 hover:border-brand/30 hover:bg-brand/10 transition group"
                >
                  <Database className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{ds.name}</span>
                  {onCanvas > 0 && (
                    <span className="text-[9px] bg-blue-100 text-brand px-1.5 py-0.5 rounded-full font-semibold">
                      ✕ {onCanvas}
                    </span>
                  )}
                  <Plus className="w-3 h-3 text-gray-300 group-hover:text-brand transition" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Undo / Actions */}
        <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">
          <button
            onClick={undo}
            disabled={history.current.length === 0}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            title="Ctrl/Cmd+Z"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            onClick={() => fitView()}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
            title="Fit to view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fit View
          </button>
        </div>
      </div>

      {/* ═════════════ CENTER CANVAS ═════════════ */}
      <div className="flex-1 flex flex-col bg-slate-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          connectionLineType={ConnectionLineType.Bezier}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* ═════════════ RIGHT PANEL ═════════════ */}
      <div className="w-80 border-l border-gray-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
        {/* Top: Actions */}
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div className="flex gap-1.5">
            <button
              onClick={() => generateSqlMutation.mutate()}
              disabled={!readyToRun}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title={!readyToRun ? "Need: 2+ tables, configured join keys" : ""}
            >
              <Code2 className="w-3.5 h-3.5" />
              Gen SQL
            </button>
            <button
              onClick={() => executeMutation.mutate()}
              disabled={!readyToRun}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title={!readyToRun ? "Need: 2+ tables, configured join keys" : ""}
            >
              <Play className="w-3.5 h-3.5" />
              Run
            </button>
          </div>
          {result && (
            <button
              onClick={exportCsv}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>

        {/* Edge config panel */}
        {selectedEdge && (
          <div className="px-4 py-3 border-b border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Join Configuration</span>
              <button onClick={() => setSelectedEdgeId(null)} className="p-0.5 rounded hover:bg-gray-100">
                <X className="w-3 h-3 text-gray-400" />
              </button>
            </div>

            {/* Join type selector */}
            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-1">Join Type</label>
              <div className="space-y-1">
                {JOIN_TYPES.map((jt) => (
                  <button
                    key={jt}
                    onClick={() => setEdgeConfig((c) => ({ ...c, joinType: jt }))}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg border transition"
                    style={{
                      borderColor: edgeConfig.joinType === jt ? JOIN_META[jt].color : "#e2e8f0",
                      background: edgeConfig.joinType === jt ? JOIN_META[jt].bg : "#fff",
                      color: edgeConfig.joinType === jt ? JOIN_META[jt].color : "#666",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold">{jt}</span>
                      <span className="text-[10px]">{JOIN_META[jt].symbol}</span>
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">{JOIN_META[jt].desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Join conditions */}
            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-1.5">Join Conditions</label>
              <div className="space-y-1.5">
                {edgeConfig.conditions.length === 0 ? (
                  <p className="text-[9px] text-gray-400 italic">No conditions yet. Click a column to add.</p>
                ) : (
                  edgeConfig.conditions.map((c, i) => (
                    <div key={i} className="flex gap-1 items-center">
                      <select
                        value={c.sourceKey}
                        onChange={(e) => updateCondition(i, "sourceKey", e.target.value)}
                        className="flex-1 text-[10px] border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-brand"
                      >
                        <option value="">Source key...</option>
                        {srcCols.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                      <span className="text-[9px] text-gray-400">=</span>
                      <select
                        value={c.targetKey}
                        onChange={(e) => updateCondition(i, "targetKey", e.target.value)}
                        className="flex-1 text-[10px] border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-brand"
                      >
                        <option value="">Target key...</option>
                        {tgtCols.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeCondition(i)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Matching suggestions */}
              {matchingSuggestions.length > 0 && edgeConfig.conditions.length === 0 && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-[9px] font-semibold text-blue-900 mb-1">Matching columns:</p>
                  <div className="flex flex-wrap gap-1">
                    {matchingSuggestions.map((col) => (
                      <button
                        key={col}
                        onClick={() => setEdgeConfig((c) => ({
                          ...c,
                          conditions: [{ sourceKey: col, targetKey: col }],
                        }))}
                        className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition font-mono"
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-1 mt-2">
                <button
                  onClick={addCondition}
                  className="flex-1 text-[10px] px-2 py-1.5 border border-gray-200 rounded hover:bg-gray-50 font-medium text-gray-700 transition"
                >
                  + Add Condition
                </button>
                <button
                  onClick={applyEdgeConfig}
                  className="flex-1 text-[10px] px-2 py-1.5 bg-brand text-white rounded hover:bg-blue-700 font-bold transition"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Delete edge */}
            <button
              onClick={() => { deleteEdge(selectedEdge.id); setSelectedEdgeId(null); }}
              className="w-full text-[10px] px-2 py-1.5 text-red-600 border border-red-200 rounded hover:bg-red-50 font-medium transition flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Delete Edge
            </button>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {generatedSql && showSql && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Generated SQL:</p>
              <div className="p-2.5 bg-gray-900 rounded-lg text-[9px] text-gray-100 font-mono overflow-x-auto whitespace-pre-wrap break-words">
                {generatedSql}
              </div>
            </div>
          )}

          {result && !showSql && (
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">Results</p>
                <span className="text-[9px] text-gray-500">
                  {result.row_count} rows{result.truncated ? " (truncated)" : ""}
                </span>
              </div>
              {result.error ? (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-700 flex gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{result.error}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <SqlResultsTable columns={result.columns} rows={result.rows.slice(0, 50)} />
                </div>
              )}
            </div>
          )}

          {!result && !generatedSql && (
            <div className="px-4 py-6 text-center">
              <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Connect datasets and configure join keys to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────── Exported wrapper with provider ──────────────────────────────────

export default function JoinBuilder() {
  return (
    <ReactFlowProvider>
      <JoinBuilderInner />
    </ReactFlowProvider>
  );
}