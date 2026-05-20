"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { useEffect, useRef } from "react";

interface Node {
  id: string;
  type: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  strength: number;
}

const TYPE_COLORS: Record<string, string> = {
  numeric: "#3b82f6",
  categorical: "#8b5cf6",
  datetime: "#10b981",
  boolean: "#f59e0b",
  text: "#ef4444",
  id_like: "#94a3b8",
  constant: "#cbd5e1",
};

export default function RelationshipGraphPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const { data: dataset } = useQuery({
    queryKey: queryKeys.datasets.detail(datasetId),
    queryFn: () => datasetsApi.get(datasetId).then((r) => r.data),
  });

  const { data: correlations, isLoading } = useQuery({
    queryKey: queryKeys.eda.correlations(datasetId, "pearson"),
    queryFn: () => datasetsApi.getCorrelations(datasetId, "pearson").then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.eda.profile(datasetId),
    queryFn: () => datasetsApi.getProfile(datasetId).then((r) => r.data),
  });

  useEffect(() => {
    if (!correlations || !profile || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const colTypeMap: Record<string, string> = {};
    profile.columns.forEach((c: { name: string; semantic_type: string }) => {
      colTypeMap[c.name] = c.semantic_type;
    });

    const threshold = 0.3;
    const nodeSet = new Set<string>();
    const links: Link[] = [];

    (correlations.top_pairs ?? []).forEach(
      (pair: { col1: string; col2: string; correlation: number }) => {
        const abs = Math.abs(pair.correlation);
        if (abs >= threshold) {
          nodeSet.add(pair.col1);
          nodeSet.add(pair.col2);
          links.push({ source: pair.col1, target: pair.col2, strength: abs });
        }
      }
    );

    const nodes: Node[] = Array.from(nodeSet).map((id) => ({
      id,
      type: colTypeMap[id] ?? "unknown",
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
    }));

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    links.forEach((l) => {
      l.source = nodeById.get(String(l.source)) ?? l.source;
      l.target = nodeById.get(String(l.target)) ?? l.target;
    });

    const tick = () => {
      const centerX = W / 2;
      const centerY = H / 2;

      nodes.forEach((n) => {
        n.vx = (n.vx ?? 0) + (centerX - (n.x ?? 0)) * 0.002;
        n.vy = (n.vy ?? 0) + (centerY - (n.y ?? 0)) * 0.002;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const ni = nodes[i];
          const nj = nodes[j];
          const dx = (ni.x ?? 0) - (nj.x ?? 0);
          const dy = (ni.y ?? 0) - (nj.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1200 / (dist * dist);
          ni.vx = (ni.vx ?? 0) + (dx / dist) * force;
          ni.vy = (ni.vy ?? 0) + (dy / dist) * force;
          nj.vx = (nj.vx ?? 0) - (dx / dist) * force;
          nj.vy = (nj.vy ?? 0) - (dy / dist) * force;
        }
      }

      links.forEach((l) => {
        const s = l.source as Node;
        const t = l.target as Node;
        const dx = (t.x ?? 0) - (s.x ?? 0);
        const dy = (t.y ?? 0) - (s.y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const target_dist = 120 / l.strength;
        const force = (dist - target_dist) * 0.05 * l.strength;
        s.vx = (s.vx ?? 0) + (dx / dist) * force;
        s.vy = (s.vy ?? 0) + (dy / dist) * force;
        t.vx = (t.vx ?? 0) - (dx / dist) * force;
        t.vy = (t.vy ?? 0) - (dy / dist) * force;
      });

      nodes.forEach((n) => {
        n.vx = (n.vx ?? 0) * 0.8;
        n.vy = (n.vy ?? 0) * 0.8;
        n.x = Math.max(60, Math.min(W - 60, (n.x ?? 0) + (n.vx ?? 0)));
        n.y = Math.max(30, Math.min(H - 40, (n.y ?? 0) + (n.vy ?? 0)));
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      links.forEach((l) => {
        const s = l.source as Node;
        const t = l.target as Node;
        ctx.beginPath();
        ctx.moveTo(s.x ?? 0, s.y ?? 0);
        ctx.lineTo(t.x ?? 0, t.y ?? 0);
        ctx.strokeStyle = `rgba(148,163,184,${l.strength * 0.7})`;
        ctx.lineWidth = l.strength * 2;
        ctx.stroke();
      });

      nodes.forEach((n) => {
        const color = TYPE_COLORS[n.type] ?? "#94a3b8";
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#374151";
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.id, n.x ?? 0, (n.y ?? 0) + 22);
      });
    };

    let frame = 0;
    const animate = () => {
      if (frame < 300) tick();
      draw();
      animRef.current = requestAnimationFrame(animate);
      frame++;
    };

    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [correlations, profile]);

  return (
    <>
      <SubNav datasetId={datasetId} />
      <div className="p-8 max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Workspaces", href: "/workspaces" },
            { label: dataset?.name ?? "Dataset", href: `/datasets/${datasetId}` },
            { label: "Relationship Graph" },
          ]}
        />

        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Column Relationship Graph</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Force-directed graph of correlated columns (|r| ≥ 0.3). Edge thickness = correlation
            strength.
          </p>
        </div>

        {isLoading ? (
          <PageSpinner />
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <span key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {type}
                </span>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <canvas ref={canvasRef} className="w-full" style={{ height: 520 }} />
            </div>
          </>
        )}
      </div>
    </>
  );
}