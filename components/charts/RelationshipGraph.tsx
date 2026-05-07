"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { CorrelationResult } from "@/types";

interface RelationshipGraphProps {
  correlationResult: CorrelationResult;
  onNodeClick?: (columnName: string) => void;
  threshold?: number;
}

export function RelationshipGraph({
  correlationResult,
  onNodeClick,
  threshold = 0.3,
}: RelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !correlationResult.matrix) return;

    const matrix = correlationResult.matrix;
    const columns = Object.keys(matrix);

    // Create nodes
    const nodes: Array<{ id: string; type: string; x?: number; y?: number; fx?: number | null; fy?: number | null }> = columns.map((col) => ({
      id: col,
      type: "numeric", // In real impl, determine type from data
    }));

    // Create edges for correlations above threshold
    const edges: Array<{ source: string; target: string; value: number }> = [];
    for (const col1 of columns) {
      for (const col2 of columns) {
        if (col1 < col2) {
          const value = matrix[col1]?.[col2];
          if (value !== null && value !== undefined && Math.abs(value) > threshold) {
            edges.push({ source: col1, target: col2, value });
          }
        }
      }
    }

    const width = svgRef.current.clientWidth || 800;
    const height = 500;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(edges as any)
          .id((d: any) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    // Create links
    const link = svg
      .append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => Math.abs(d.value) * 3);

    // Create nodes
    const node = svg
      .append("g")
      .selectAll("circle")
      .data(nodes as any)
      .join("circle")
      .attr("r", 20)
      .attr("fill", "#3b82f6")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .on("click", (_, d: any) => {
        if (onNodeClick) onNodeClick(d.id);
      })
      .on("mouseover", (_, d: any) => {
        setHoveredNode(d.id);
      })
      .on("mouseout", () => {
        setHoveredNode(null);
      }) as any;

    // Add drag behavior
    node.call(
      d3
        .drag<SVGCircleElement, any>()
        .on("start", (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event: any, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any
    );

    // Create labels
    const labels = svg
      .append("g")
      .selectAll("text")
      .data(nodes as any)
      .join("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("pointer-events", "none")
      .attr("font-size", "11px")
      .attr("fill", "#ffffff")
      .attr("font-weight", "bold")
      .text((d: any) => d.id.substring(0, 10));

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);

      labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [correlationResult, threshold, onNodeClick]);

  return (
    <div className="w-full rounded border border-gray-200 bg-white p-4">
      <svg
        ref={svgRef}
        className="w-full"
        style={{ minHeight: "500px" }}
      />
      <div className="mt-4 text-sm text-gray-600">
        <p>
          Nodes represent columns. Edges show correlations with |r| &gt;{" "}
          {threshold}. Thicker edges indicate stronger correlations.
        </p>
      </div>
    </div>
  );
}
