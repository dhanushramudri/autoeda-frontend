"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { datasetsApi, workspacesApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { QualityGauge } from "@/components/charts/QualityGauge";
import { MissingHeatmap } from "@/components/charts/MissingHeatmap";
import { GitBranch } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function CompareDatasets() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  const { data: workspace } = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspacesApi.get(workspaceId).then((r) => r.data),
  });

  const { data: datasets } = useQuery({
    queryKey: queryKeys.datasets.list(workspaceId),
    queryFn: () => datasetsApi.list(workspaceId).then((r) => (r.data as Array<{ id: string; name: string; status: string; row_count: number | null; column_count: number | null }>).filter((d) => d.status === "ready")),
  });

  const { data: leftQuality } = useQuery({
    queryKey: queryKeys.eda.quality(leftId),
    queryFn: () => datasetsApi.getQualityScore(leftId).then((r) => r.data),
    enabled: !!leftId,
  });

  const { data: rightQuality } = useQuery({
    queryKey: queryKeys.eda.quality(rightId),
    queryFn: () => datasetsApi.getQualityScore(rightId).then((r) => r.data),
    enabled: !!rightId,
  });

  const { data: leftMissing } = useQuery({
    queryKey: queryKeys.eda.missing(leftId),
    queryFn: () => datasetsApi.getMissing(leftId).then((r) => r.data),
    enabled: !!leftId,
  });

  const { data: rightMissing } = useQuery({
    queryKey: queryKeys.eda.missing(rightId),
    queryFn: () => datasetsApi.getMissing(rightId).then((r) => r.data),
    enabled: !!rightId,
  });

  const { data: leftProfile } = useQuery({
    queryKey: queryKeys.eda.profile(leftId),
    queryFn: () => datasetsApi.getProfile(leftId).then((r) => r.data),
    enabled: !!leftId,
  });

  const { data: rightProfile } = useQuery({
    queryKey: queryKeys.eda.profile(rightId),
    queryFn: () => datasetsApi.getProfile(rightId).then((r) => r.data),
    enabled: !!rightId,
  });

  const leftDs = datasets?.find((d: { id: string }) => d.id === leftId);
  const rightDs = datasets?.find((d: { id: string }) => d.id === rightId);

  const readyToCompare = !!leftId && !!rightId && leftId !== rightId;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Workspaces", href: "/workspaces" },
          { label: workspace?.name ?? "Workspace", href: `/workspaces/${workspaceId}/datasets` },
          { label: "Compare" },
        ]}
      />

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Compare Datasets</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Side-by-side comparison of quality, missing data, and column profiles
        </p>
      </div>

      {/* Dataset selectors */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {(["left", "right"] as const).map((side) => {
          const current = side === "left" ? leftId : rightId;
          const setter = side === "left" ? setLeftId : setRightId;
          const other = side === "left" ? rightId : leftId;
          return (
            <div key={side}>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                {side === "left" ? "Dataset A" : "Dataset B"}
              </label>
              <select
                value={current}
                onChange={(e) => setter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Select a dataset</option>
                {(datasets ?? [])
                  .filter((d: { id: string }) => d.id !== other)
                  .map((d: { id: string; name: string }) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>

      {!readyToCompare ? (
        <EmptyState
          icon={<GitBranch className="w-12 h-12" />}
          title="Select two datasets to compare"
          description="Choose different datasets from the dropdowns above to see a side-by-side comparison."
        />
      ) : (
        <div className="space-y-8">
          {/* Overview */}
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: leftDs?.name, ds: leftDs },
              { label: rightDs?.name, ds: rightDs },
            ].map(({ label, ds }, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-foreground mb-3">{label}</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-muted rounded-lg p-2">
                    <p className="text-muted-foreground">Rows</p>
                    <p className="font-semibold text-foreground">{ds?.row_count?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <p className="text-muted-foreground">Columns</p>
                    <p className="font-semibold text-foreground">{ds?.column_count ?? "—"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quality comparison */}
          {(leftQuality || rightQuality) && (
            <div>
              <h2 className="text-base font-semibold text-foreground mb-4">Data Quality</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-card rounded-xl border border-border p-5">
                  {leftQuality ? (
                    <QualityGauge data={leftQuality} />
                  ) : (
                    <PageSpinner />
                  )}
                </div>
                <div className="bg-card rounded-xl border border-border p-5">
                  {rightQuality ? (
                    <QualityGauge data={rightQuality} />
                  ) : (
                    <PageSpinner />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Missing comparison */}
          {(leftMissing || rightMissing) && (
            <div>
              <h2 className="text-base font-semibold text-foreground mb-4">Missing Values</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-card rounded-xl border border-border p-5">
                  {leftMissing ? <MissingHeatmap data={leftMissing} /> : <PageSpinner />}
                </div>
                <div className="bg-card rounded-xl border border-border p-5">
                  {rightMissing ? <MissingHeatmap data={rightMissing} /> : <PageSpinner />}
                </div>
              </div>
            </div>
          )}

          {/* Column profile comparison */}
          {leftProfile && rightProfile && (
            <div>
              <h2 className="text-base font-semibold text-foreground mb-4">Column Types</h2>
              <div className="grid grid-cols-2 gap-6">
                {[leftProfile, rightProfile].map((prof, i) => {
                  const typeCounts: Record<string, number> = {};
                  prof.columns.forEach((c: { semantic_type: string }) => {
                    typeCounts[c.semantic_type] = (typeCounts[c.semantic_type] ?? 0) + 1;
                  });
                  return (
                    <div key={i} className="bg-card rounded-xl border border-border p-5">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(typeCounts).map(([type, count]) => (
                          <span
                            key={type}
                            className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-brand rounded-full text-xs font-medium"
                          >
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
