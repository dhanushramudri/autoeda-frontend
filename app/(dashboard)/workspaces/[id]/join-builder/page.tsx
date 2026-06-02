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
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight,
  Settings, Zap, Table2, Layers, Save, ExternalLink, Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Dataset } from "@/types";

// ────────── Constants ──────────────────────────────────────────────────────

const JOIN_TYPES = ["INNER", "LEFT", "RIGHT", "FULL"] as const;
type JoinType = typeof JOIN_TYPES[number];

const JOIN_META: Record<JoinType, { color: string; bg: string; border: string; desc: string; symbol: string; gradient: string }> = {
  INNER: { 
    color: "hsl(var(--primary))", 
    bg: "hsl(var(--primary) / 0.08)", 
    border: "hsl(var(--primary) / 0.20)", 
    desc: "Only matching rows from both tables", 
    symbol: "⋈", 
    gradient: "from-[hsl(var(--primary))] to-[hsl(var(--primary) / 0.8)]" 
  },
  LEFT:  { 
    color: "#8b5cf6", 
    bg: "#f5f3ff", 
    border: "#ddd6fe", 
    desc: "All left rows + matching right rows", 
    symbol: "⟕", 
    gradient: "from-violet-500 to-violet-600" 
  },
  RIGHT: { 
    color: "#06b6d4", 
    bg: "#f0f9ff", 
    border: "#a5f3fc", 
    desc: "All right rows + matching left rows", 
    symbol: "⟵", 
    gradient: "from-cyan-500 to-cyan-600" 
  },
  FULL:  { 
    color: "#f59e0b", 
    bg: "#fffbeb", 
    border: "#fde68a", 
    desc: "All rows from both tables", 
    symbol: "⟷", 
    gradient: "from-amber-500 to-amber-600" 
  },
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
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        minWidth: 220,
        maxWidth: 250,
        background: "white",
        boxShadow: selected
          ? `0 0 0 2px hsl(var(--primary)), 0 20px 40px hsl(var(--primary) / 0.15)`
          : `0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)`,
        transition: "box-shadow 0.2s",
      }}
    >
      {/* Left (target) handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          width: 16, height: 16,
          background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
          border: "3px solid white",
          boxShadow: "0 0 0 2px #8b5cf6",
          left: -9,
        }}
      />

      {/* Header */}
      <div
        className="px-3 py-2.5 flex items-center gap-2"
        style={{
          background: selected
            ? "hsl(var(--primary) / 0.08)"
            : "linear-gradient(135deg, #f8fafc, #f1f5f9)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: selected ? "hsl(var(--primary))" : "#64748b" }}
        >
          <Table2 className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{data.label}</span>
        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
          {data.columns.length}
        </span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="p-0.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition"
        >
          {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        <button
          onClick={() => data.onDelete(id)}
          className="p-0.5 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Column list */}
      {!collapsed && (
        <>
          {data.columns.length > 6 && (
            <div className="px-2.5 pt-2 pb-1">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                <Search className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                <input
                  className="text-[10px] bg-transparent outline-none flex-1 text-gray-600 placeholder-gray-300"
                  placeholder="Find column..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
            {filtered.slice(0, 30).map((col, idx) => (
              <button
                key={col}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 group flex items-center gap-2 transition-colors"
                style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f8fafc" : "none" }}
                onClick={() => data.onSuggestKey(id, col)}
                title={`Use "${col}" as join key`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
                  style={{ background: "#cbd5e1" }}
                />
                <span className="text-[10px] font-mono text-gray-500 group-hover:text-[hsl(var(--primary))] truncate transition-colors">{col}</span>
              </button>
            ))}
            {filtered.length > 30 && (
              <div className="px-3 py-1.5 text-[9px] text-gray-400 italic">+{filtered.length - 30} more columns</div>
            )}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-[10px] text-gray-400 text-center">No matches</div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(0,0,0,0.04)", background: "#fafafa" }}
      >
        <span className="text-[9px] text-gray-400">
          <span style={{ color: "hsl(var(--primary))" }} className="font-semibold">→</span> drag to connect
        </span>
        <span className="text-[9px] text-gray-400">click col to key</span>
      </div>

      {/* Right (source) handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          width: 16, height: 16,
          background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
          border: "3px solid white",
          boxShadow: "0 0 0 2px hsl(var(--primary))",
          right: -9,
        }}
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
        style={{
          stroke: meta.color,
          strokeWidth: selected ? 3 : 2,
          filter: selected ? `drop-shadow(0 0 6px ${meta.color}88)` : "none",
          transition: "stroke-width 0.2s, filter 0.2s",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            zIndex: 10,
          }}
          className="nodrag nopan flex flex-col items-center gap-1"
        >
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-lg cursor-pointer select-none"
            style={{
              background: `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)`,
              boxShadow: selected ? `0 4px 16px ${meta.color}44` : `0 2px 8px ${meta.color}33`,
              border: `1px solid ${meta.color}33`,
            }}
          >
            <span className="text-white text-[10px] font-bold tracking-wide">{jt}</span>
            <span className="text-white/80 text-sm">{meta.symbol}</span>
          </div>

          {condCount > 0 && data?.conditions.map((c, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-lg text-[9px] font-mono shadow-sm border backdrop-blur-sm"
              style={{
                background: `${meta.bg}ee`,
                borderColor: meta.border,
                color: meta.color,
              }}
            >
              {c.sourceKey} = {c.targetKey}
            </span>
          ))}

          {condCount === 0 && (
            <span className="px-2 py-0.5 rounded-lg text-[9px] bg-amber-50/90 border border-amber-200 text-amber-600 flex items-center gap-1 backdrop-blur-sm">
              <AlertCircle className="w-2.5 h-2.5" /> set keys
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { joinEdge: JoinEdge };

// ────────── Collapsible Panel Wrapper ──────────────────────────────────────

function CollapsiblePanel({
  side,
  collapsed,
  onToggle,
  width,
  children,
  label,
  icon,
}: {
  side: "left" | "right";
  collapsed: boolean;
  onToggle: () => void;
  width: number;
  children: React.ReactNode;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col bg-white flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        width: collapsed ? 52 : width,
        borderRight: side === "left" ? "1px solid hsl(var(--sidebar-border))" : undefined,
        borderLeft: side === "right" ? "1px solid hsl(var(--sidebar-border))" : undefined,
        boxShadow: side === "left"
          ? "4px 0 16px rgba(0,0,0,0.07)"
          : "-4px 0 16px rgba(0,0,0,0.07)",
      }}
    >
      {/* Top Header */}
      <div
        className={`h-12 flex items-center justify-between px-3 border-b flex-shrink-0 ${
          side === "left"
            ? "bg-gradient-to-r border-b"
            : "bg-white border-gray-100"
        }`}
        style={{
          background: side === "left" 
            ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))"
            : "white",
          borderBottomColor: side === "left" ? "hsl(var(--primary) / 0.3)" : "hsl(var(--sidebar-border))",
        }}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2">
              <div style={{ color: side === "left" ? "white" : "hsl(var(--sidebar-foreground))" }}>
                {icon}
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  side === "left" ? "text-white" : "text-gray-700"
                }`}
              >
                {label}
              </span>
            </div>

            <button
              onClick={onToggle}
              className={`p-1.5 rounded-lg transition ${
                side === "left"
                  ? "hover:bg-white/10"
                  : "hover:bg-gray-100"
              }`}
            >
              {side === "left" ? (
                <ChevronLeft className="w-4 h-4 text-white" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </>
        ) : (
          <button
            onClick={onToggle}
            className={`w-full h-full flex items-center justify-center transition ${
              side === "left"
                ? "bg-gradient-to-b hover:opacity-80"
                : "hover:bg-gray-50"
            }`}
            style={side === "left" ? {
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
            } : {}}
          >
            {side === "left" ? (
              <Database className="w-4 h-4 text-white/90" />
            ) : (
              <Settings className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

// ────────── Main Component ────────────────────────────────────────────────

function JoinBuilderInner() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const { fitView } = useReactFlow();
  const router = useRouter();

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const nodesRef = useRef<Node<NodeData>[]>([]);
  const edgesRef = useRef<Edge<EdgeData>[]>([]);
  const selectedEdgeIdRef = useRef<string | null>(null);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const history = useRef<HistoryEntry[]>([]);
  const pushHistory = useCallback(() => {
    history.current = [...history.current.slice(-29), { nodes: nodesRef.current, edges: edgesRef.current }];
  }, []);
  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return;
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [setNodes, setEdges]);

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeConfig, setEdgeConfig] = useState<{ joinType: JoinType; conditions: JoinCondition[] }>({
    joinType: "INNER", conditions: [],
  });
  useEffect(() => { selectedEdgeIdRef.current = selectedEdgeId; }, [selectedEdgeId]);
  useEffect(() => {
    if (selectedEdgeId && rightCollapsed) setRightCollapsed(false);
  }, [selectedEdgeId]);
  const [showSqlInDrawer, setShowSqlInDrawer] = useState(false);

  const [suggestedKey, setSuggestedKey] = useState<{ nodeId: string; col: string } | null>(null);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [generatedSql, setGeneratedSql] = useState("");
  const [rowLimit, setRowLimit] = useState(1000);
  const [datasetSchemas, setDatasetSchemas] = useState<Record<string | number, string[]>>({});
  const [datasetSearch, setDatasetSearch] = useState("");
  const nodeIdCounter = useRef(0);

  const { data: datasets, isLoading } = useQuery({
    queryKey: queryKeys.datasets.list(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId).then((r) => r.data),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if (e.key === "Escape") setSelectedEdgeId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  const deleteNode = useCallback((id: string) => {
    pushHistory();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [pushHistory, setNodes, setEdges]);

  const handleSuggestKey = useCallback((nodeId: string, col: string) => {
    if (!selectedEdgeIdRef.current) { setSuggestedKey({ nodeId, col }); return; }
    const edge = edgesRef.current.find((e) => e.id === selectedEdgeIdRef.current);
    if (!edge) return;
    const srcNode = nodesRef.current.find((n) => n.id === edge.source);
    const isSource = srcNode?.id === nodeId;
    setEdgeConfig((cfg) => {
      const conds = [...cfg.conditions];
      if (conds.length === 0) conds.push({ sourceKey: "", targetKey: "" });
      const last = conds[conds.length - 1];
      conds[conds.length - 1] = isSource ? { ...last, sourceKey: col } : { ...last, targetKey: col };
      return { ...cfg, conditions: conds };
    });
  }, []);

  const cbRef = useRef({ deleteNode, handleSuggestKey });
  cbRef.current.deleteNode = deleteNode;
  cbRef.current.handleSuggestKey = handleSuggestKey;
  const stableOnDelete = useRef((id: string) => cbRef.current.deleteNode(id)).current;
  const stableOnSuggestKey = useRef((nodeId: string, col: string) => cbRef.current.handleSuggestKey(nodeId, col)).current;

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
            x: 80 + (nds.length % 3) * 300,
            y: 80 + Math.floor(nds.length / 3) * 360,
          },
          data: {
            label: sameCount > 0 ? `${ds.name} (${sameCount + 1})` : ds.name,
            datasetId: ds.id,
            columns: cols,
            onDelete: stableOnDelete,
            onSuggestKey: stableOnSuggestKey,
          },
        } as Node<NodeData>,
      ];
    });
  };

  const onConnect = useCallback(
    (conn: Connection) => {
      pushHistory();
      const edgeId = `edge-${Date.now()}`;
      const srcNode = nodesRef.current.find((n) => n.id === conn.source);
      const tgtNode = nodesRef.current.find((n) => n.id === conn.target);
      const srcCols = new Set(srcNode?.data.columns ?? []);
      const tgtCols = tgtNode?.data.columns ?? [];
      const autoMatch = tgtCols.find((c) => srcCols.has(c));
      const initConditions: JoinCondition[] = autoMatch ? [{ sourceKey: autoMatch, targetKey: autoMatch }] : [];

      const newEdge: Edge<EdgeData> = {
        ...conn,
        id: edgeId,
        type: "joinEdge",
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
        data: { joinType: "INNER", conditions: initConditions },
        source: conn.source!,
        target: conn.target!,
      };

      setEdges((eds) => addEdge(newEdge, eds));
      setSelectedEdgeId(edgeId);
      setEdgeConfig({ joinType: "INNER", conditions: initConditions });
      setSuggestedKey(null);
      if (rightCollapsed) setRightCollapsed(false);
    },
    [pushHistory, setEdges, rightCollapsed]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge<EdgeData>) => {
    setSelectedEdgeId(edge.id);
    setEdgeConfig({ joinType: edge.data?.joinType ?? "INNER", conditions: edge.data?.conditions ?? [] });
    if (rightCollapsed) setRightCollapsed(false);
  }, [rightCollapsed]);

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    setSuggestedKey(null);
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    pushHistory();
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    if (selectedEdgeIdRef.current === edgeId) setSelectedEdgeId(null);
  }, [pushHistory, setEdges]);

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
    onSuccess: (res) => { setGeneratedSql(res.data.sql ?? ""); setShowSqlInDrawer(true); setResult(null); setResultsOpen(true); },
  });

  const executeMutation = useMutation({
    mutationFn: () => workspacesExtraApi.executeJoin(workspaceId, { ...buildPayload(), limit: rowLimit }),
    onSuccess: (res) => { setResult(res.data); setShowSqlInDrawer(false); setResultsOpen(true); },
  });

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedDataset, setSavedDataset] = useState<{ dataset_id: number; name: string; job_id: string } | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      workspacesExtraApi.saveJoinAsDataset(workspaceId, {
        ...buildPayload(),
        name: saveName.trim(),
        workspace_id: Number(workspaceId),
      }),
    onSuccess: (res) => {
      setSavedDataset(res.data);
      setShowSaveModal(false);
      setSaveName("");
    },
  });

  const exportCsv = () => {
    if (!result) return;
    const rows = [result.columns.join(","), ...result.rows.map((r) => (r as unknown[]).map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "join_result.csv";
    a.click();
  };

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const srcNode = selectedEdge ? nodes.find((n) => n.id === selectedEdge.source) : null;
  const tgtNode = selectedEdge ? nodes.find((n) => n.id === selectedEdge.target) : null;
  const srcCols = srcNode?.data.columns ?? [];
  const tgtCols = tgtNode?.data.columns ?? [];
  const configuredEdges = edges.filter((e) => (e.data?.conditions?.length ?? 0) > 0).length;
  const readyToRun = nodes.length >= 2 && edges.length > 0 && configuredEdges === edges.length;
  const matchingSuggestions = srcCols.filter((c) => tgtCols.includes(c)).slice(0, 5);
  const filteredDatasets = (datasets ?? []).filter((ds: Dataset) =>
    ds.name.toLowerCase().includes(datasetSearch.toLowerCase())
  );

  if (isLoading) return <PageSpinner />;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden" style={{ background: "#f0f4f8" }}>

      {/* ═════════════ LEFT PANEL ═════════════ */}
      <CollapsiblePanel
        side="left"
        collapsed={leftCollapsed}
        onToggle={() => setLeftCollapsed((v) => !v)}
        width={220}
        label="Tables"
        icon={<Database className="w-4 h-4" />}
      >
        {/* Status bar */}
        <div className="px-3 py-2 flex-shrink-0 flex gap-2 border-b border-gray-100">
          <div className="flex-1 rounded-lg border px-2 py-1 text-center" style={{ backgroundColor: "hsl(var(--primary) / 0.08)", borderColor: "hsl(var(--primary) / 0.2)" }}>
            <div className="text-sm font-bold" style={{ color: "hsl(var(--primary))" }}>{nodes.length}</div>
            <div className="text-[9px] font-medium" style={{ color: "hsl(var(--primary) / 0.6)" }}>Tables</div>
          </div>
          <div className="flex-1 rounded-lg border px-2 py-1 text-center" style={{ backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" }}>
            <div className="text-sm font-bold text-purple-600">{edges.length}</div>
            <div className="text-[9px] text-purple-400 font-medium">Joins</div>
          </div>
          <div className="flex-1 rounded-lg border px-2 py-1 text-center" style={{ backgroundColor: "#f0fdf4", borderColor: "#a7f3d0" }}>
            <div className="text-sm font-bold text-green-600">{configuredEdges}</div>
            <div className="text-[9px] text-green-400 font-medium">Configured</div>
          </div>
        </div>

        {/* Dataset search */}
        <div className="px-3 py-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
            <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <input
              className="text-[10px] bg-transparent outline-none flex-1 text-gray-600 placeholder-gray-300"
              placeholder="Search tables..."
              value={datasetSearch}
              onChange={(e) => setDatasetSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Dataset list */}
        <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            {filteredDatasets.length} Tables
          </p>
          {filteredDatasets.map((ds: Dataset) => {
            const onCanvas = nodes.filter((n) => n.data.datasetId === ds.id).length;
            return (
              <button
                key={ds.id}
                onClick={() => addDatasetNode(ds)}
                className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all duration-150 group"
                style={{
                  borderColor: onCanvas > 0 ? "hsl(var(--primary) / 0.3)" : "#f1f5f9",
                  backgroundColor: onCanvas > 0 ? "hsl(var(--primary) / 0.08)" : "#fafafa",
                }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ backgroundColor: onCanvas > 0 ? "hsl(var(--primary))" : "#e2e8f0" }}
                >
                  <Database className="w-3 h-3" style={{ color: onCanvas > 0 ? "white" : "#94a3b8" }} />
                </div>
                <span className="text-[11px] font-medium text-gray-700 truncate flex-1 group-hover:transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50" >{ds.name}</span>
                {onCanvas > 0
                  ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>×{onCanvas}</span>
                  : <Plus className="w-3 h-3 text-gray-300 group-hover:text-[hsl(var(--primary))] transition-colors flex-shrink-0" />
                }
              </button>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="px-3 py-2 flex-shrink-0 space-y-1 border-t border-gray-100">
          <button
            onClick={undo}
            disabled={history.current.length === 0}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
            <span className="ml-auto text-[9px] text-gray-400">⌘Z</span>
          </button>
          <button
            onClick={() => fitView()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fit View
          </button>
        </div>
      </CollapsiblePanel>

      {/* ═════════════ CENTER CANVAS ═════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden">

          {/* Floating top toolbar */}
          <div
            className="absolute top-3 left-1/2 z-10 flex items-center gap-1.5 px-3 py-2 rounded-2xl shadow-lg"
            style={{
              transform: "translateX(-50%)",
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(226,232,240,0.8)",
            }}
          >
            {/* Canvas stats */}
            {nodes.length > 0 && (
              <div className="flex items-center gap-1 mr-1 pr-3 border-r border-gray-200">
                <Layers className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-500">
                  <span className="font-semibold text-gray-700">{nodes.length}</span> tables,{" "}
                  <span className="font-semibold text-gray-700">{edges.length}</span> joins
                </span>
              </div>
            )}

            {/* Run controls */}
            <button
              onClick={() => generateSqlMutation.mutate()}
              disabled={!readyToRun || generateSqlMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: readyToRun ? "hsl(var(--primary))" : "#94a3b8", 
                color: "white" 
              }}
              title={!readyToRun ? "Need 2+ tables with configured join keys" : ""}
            >
              <Code2 className="w-3 h-3" />
              SQL
            </button>

            <button
              onClick={() => executeMutation.mutate()}
              disabled={!readyToRun || executeMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: readyToRun ? "#10b981" : "#94a3b8", color: "white" }}
            >
              <Play className="w-3 h-3" />
              {executeMutation.isPending ? "Running..." : "Run"}
            </button>

            {result && (
              <>
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
                <button
                  onClick={() => { setSavedDataset(null); setShowSaveModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  style={{ backgroundColor: "#8b5cf6", color: "white" }}
                >
                  <Save className="w-3 h-3" />
                  Save Dataset
                </button>
              </>
            )}

            {/* Ready indicator */}
            <div className="ml-1 flex items-center gap-1">
              {readyToRun
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              }
              <span className="text-[9px] text-gray-400">{readyToRun ? "Ready" : "Configure joins"}</span>
            </div>
          </div>

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
            fitViewOptions={{ maxZoom: 0.75, padding: 0.3 }}
            connectionLineType={ConnectionLineType.Bezier}
            style={{ background: "transparent" }}
          >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls style={{ bottom: 16, left: 16 }} />
            <MiniMap
              style={{ bottom: 16, right: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}
              nodeColor="hsl(var(--primary))"
            />
          </ReactFlow>

          {/* Empty state overlay */}
          {nodes.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 5 }}
            >
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "hsl(var(--primary) / 0.08)", border: "2px dashed hsl(var(--primary) / 0.3)" }}
                >
                  <GitMerge className="w-8 h-8" style={{ color: "hsl(var(--primary) / 0.4)" }} />
                </div>
                <p className="text-sm font-semibold text-gray-400">Add tables from the left panel</p>
                <p className="text-[11px] text-gray-300 mt-1">Drag the blue handle → to the purple ← to create a join</p>
              </div>
            </div>
          )}

          {/* Save success banner */}
          {savedDataset && (
            <div
              className="absolute top-16 left-1/2 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl"
              style={{
                transform: "translateX(-50%)",
                background: "rgba(240,253,244,0.97)",
                backdropFilter: "blur(12px)",
                border: "1px solid #86efac",
                minWidth: 320,
              }}
            >
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-green-800">Dataset saved!</p>
                <p className="text-[10px] text-green-600 truncate">{savedDataset.name}</p>
              </div>
              <button
                onClick={() => router.push(`/datasets/${savedDataset.dataset_id}/overview`)}
                className="flex items-center gap-1 text-[10px] font-bold text-green-700 hover:text-green-900 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Open
              </button>
              <button onClick={() => setSavedDataset(null)} className="p-0.5 rounded hover:bg-green-100">
                <X className="w-3.5 h-3.5 text-green-400" />
              </button>
            </div>
          )}
        </div>{/* end canvas area */}

        {/* ── Bottom results drawer ── */}
        {(result || generatedSql) && (
          <div
            className="flex-shrink-0 flex flex-col bg-white overflow-hidden transition-all duration-300"
            style={{
              height: resultsOpen ? 300 : 0,
              borderTop: resultsOpen ? "1px solid #e2e8f0" : "none",
              boxShadow: resultsOpen ? "0 -4px 16px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {resultsOpen && (
              <>
                {/* Drawer header */}
                <div
                  className="flex items-center gap-3 px-4 h-10 flex-shrink-0 border-b border-gray-100"
                >
                  <Table2 className="w-3.5 h-3.5 text-gray-400" />
                  {result && !showSqlInDrawer ? (
                    <>
                      <span className="text-[11px] font-semibold text-gray-700">Results</span>
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}
                      >
                        {result.row_count.toLocaleString()} rows{result.truncated ? " (truncated)" : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold text-gray-700">Generated SQL</span>
                  )}

                  <div className="ml-auto flex items-center gap-1.5">
                    {/* Row limit */}
                    <span className="text-[9px] text-gray-400">Limit</span>
                    <select
                      value={rowLimit}
                      onChange={(e) => setRowLimit(Number(e.target.value))}
                      className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white"
                    >
                      {[100, 500, 1000, 5000].map((v) => <option key={v} value={v}>{v.toLocaleString()}</option>)}
                    </select>

                    {generatedSql && (
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedSql)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"
                        title="Copy SQL"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      onClick={() => setResultsOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"
                      title="Close results"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Drawer body */}
                <div className="flex-1 overflow-auto">
                  {showSqlInDrawer && generatedSql ? (
                    <pre
                      className="p-4 text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed h-full"
                      style={{ background: "#0f172a", color: "#22c55e" }}
                    >
                      {generatedSql}
                    </pre>
                  ) : result?.error ? (
                    <div
                      className="m-4 p-3 rounded-xl text-[11px] flex gap-2"
                      style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{result.error}</span>
                    </div>
                  ) : result ? (
                    <SqlResultsTable columns={result.columns} rows={result.rows} />
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}

        {/* Drawer toggle tab — shown when results exist but drawer is closed */}
        {(result || generatedSql) && !resultsOpen && (
          <button
            onClick={() => setResultsOpen(true)}
            className="flex-shrink-0 flex items-center justify-center gap-2 h-9 w-full text-[11px] font-semibold text-gray-600 hover:bg-white transition-colors border-t border-gray-100"
            style={{ background: "#f8fafc" }}
          >
            <ChevronUp className="w-3.5 h-3.5" />
            {result
              ? `Results — ${result.row_count.toLocaleString()} rows`
              : "Generated SQL"}
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        )}
      </div>{/* end center column */}

      {/* ═════════════ SAVE MODAL ════════════════ */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border"
            style={{ borderColor: "hsl(var(--sidebar-border))" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(var(--primary) / 0.1)" }}>
                <Save className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Save as Dataset</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {result?.row_count?.toLocaleString()} rows · {result?.columns?.length} columns
                </p>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Dataset name</label>
            <input
              autoFocus
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && saveName.trim()) saveMutation.mutate(); }}
              placeholder="e.g. Customer Orders Joined"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:border-transparent transition focus:outline-none focus:ring-2 focus:ring-primary/50"
            />

            {saveMutation.isError && (
              <p className="mt-2 text-[10px] text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {String((saveMutation.error as Error)?.message ?? "Save failed")}
              </p>
            )}

            <p className="mt-3 text-[10px] text-gray-400 leading-relaxed">
              The full join result will be saved and EDA analysis will run automatically.
              You can track progress in the Datasets tab.
            </p>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!saveName.trim() || saveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "hsl(var(--primary))" }}
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Save className="w-3.5 h-3.5" /> Save Dataset</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════ RIGHT PANEL ═════════════ */}
      <CollapsiblePanel
        side="right"
        collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed((v) => !v)}
        width={300}
        label="Configure"
        icon={<Settings className="w-4 h-4" />}
      >
        <div className="flex-1 overflow-y-auto">
          {selectedEdge ? (
            <div className="px-4 py-3 space-y-4">
              {/* Edge header */}
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: `${JOIN_META[edgeConfig.joinType].bg}`, border: `1px solid ${JOIN_META[edgeConfig.joinType].border}` }}
              >
                <div>
                  <p className="text-[10px] font-bold" style={{ color: JOIN_META[edgeConfig.joinType].color }}>
                    {srcNode?.data.label} → {tgtNode?.data.label}
                  </p>
                  <p className="text-[9px] text-gray-500 mt-0.5">{JOIN_META[edgeConfig.joinType].desc}</p>
                </div>
                <button onClick={() => setSelectedEdgeId(null)} className="p-1 rounded-lg hover:bg-white/60">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>

              {/* Join type */}
              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-2 uppercase tracking-wider">Join Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {JOIN_TYPES.map((jt) => (
                    <button
                      key={jt}
                      onClick={() => setEdgeConfig((c) => ({ ...c, joinType: jt }))}
                      className="px-2 py-2 rounded-xl border transition-all text-left"
                      style={{
                        borderColor: edgeConfig.joinType === jt ? JOIN_META[jt].color : "#e2e8f0",
                        backgroundColor: edgeConfig.joinType === jt ? JOIN_META[jt].bg : "white",
                        boxShadow: edgeConfig.joinType === jt ? `0 0 0 1px ${JOIN_META[jt].color}33` : "none",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-bold" style={{ color: edgeConfig.joinType === jt ? JOIN_META[jt].color : "#64748b" }}>{jt}</span>
                        <span className="text-sm">{JOIN_META[jt].symbol}</span>
                      </div>
                      <p className="text-[8px] text-gray-400 leading-tight">{JOIN_META[jt].desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-2 uppercase tracking-wider">Join Keys</label>

                {matchingSuggestions.length > 0 && edgeConfig.conditions.length === 0 && (
                  <div className="mb-2 p-2.5 rounded-xl border" style={{ backgroundColor: "hsl(var(--primary) / 0.08)", borderColor: "hsl(var(--primary) / 0.2)" }}>
                    <p className="text-[9px] font-bold mb-1.5 flex items-center gap-1" style={{ color: "hsl(var(--primary))" }}>
                      <Zap className="w-2.5 h-2.5" /> Smart suggestions
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {matchingSuggestions.map((col) => (
                        <button
                          key={col}
                          onClick={() => setEdgeConfig((c) => ({ ...c, conditions: [{ sourceKey: col, targetKey: col }] }))}
                          className="text-[9px] px-2 py-1 rounded-lg font-mono font-semibold transition-colors border"
                          style={{
                            backgroundColor: "white",
                            color: "hsl(var(--primary))",
                            borderColor: "hsl(var(--primary) / 0.3)",
                          }}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {edgeConfig.conditions.length === 0 ? (
                    <p className="text-[9px] text-gray-400 italic py-2 text-center">
                      No conditions yet — click a column in a table node or use suggestions above
                    </p>
                  ) : (
                    edgeConfig.conditions.map((c, i) => (
                      <div key={i} className="flex gap-1 items-center">
                        <select
                          value={c.sourceKey}
                          onChange={(e) => updateCondition(i, "sourceKey", e.target.value)}
                          className="flex-1 text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white focus:ring-1 focus:border-transparent transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="">Source…</option>
                          {srcCols.map((col) => <option key={col} value={col}>{col}</option>)}
                        </select>
                        <span className="text-gray-300 text-xs">=</span>
                        <select
                          value={c.targetKey}
                          onChange={(e) => updateCondition(i, "targetKey", e.target.value)}
                          className="flex-1 text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white focus:ring-1 focus:border-transparent transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="">Target…</option>
                          {tgtCols.map((col) => <option key={col} value={col}>{col}</option>)}
                        </select>
                        <button
                          onClick={() => removeCondition(i)}
                          className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={addCondition}
                    className="flex-1 text-[10px] px-2.5 py-2 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Condition
                  </button>
                  <button
                    onClick={applyEdgeConfig}
                    className="flex-1 text-[10px] px-2.5 py-2 text-white rounded-xl font-bold hover:opacity-90 transition"
                    style={{ backgroundColor: "hsl(var(--primary))" }}
                  >
                    Apply
                  </button>
                </div>
              </div>

              <button
                onClick={() => { deleteEdge(selectedEdge.id); setSelectedEdgeId(null); }}
                className="w-full text-[10px] px-3 py-2 text-red-500 border border-red-100 rounded-xl font-semibold hover:bg-red-50 transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" /> Remove Join
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ backgroundColor: "#f1f5f9" }}
              >
                <Settings className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-[11px] font-semibold text-gray-400">No join selected</p>
              <p className="text-[10px] text-gray-300 mt-1 leading-relaxed">
                Click on a join edge in the canvas to configure it
              </p>
            </div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
}

export default function JoinBuilder() {
  return (
    <ReactFlowProvider>
      <JoinBuilderInner />
    </ReactFlowProvider>
  );
}