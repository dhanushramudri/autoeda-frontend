export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  workspaces: {
    all: ["workspaces"] as const,
    list: () => ["workspaces", "list"] as const,
    detail: (id: string) => ["workspaces", id] as const,
    members: (id: string) => ["workspaces", id, "members"] as const,
  },
  datasets: {
    all: ["datasets"] as const,
    list: (workspaceId: string) => ["datasets", "list", workspaceId] as const,
    detail: (datasetId: string) => ["datasets", datasetId] as const,
    preview: (datasetId: string) => ["datasets", "preview", datasetId] as const,
  },
  eda: {
    profile: (datasetId: string) => ["eda", "profile", datasetId] as const,
    missing: (datasetId: string) => ["eda", "missing", datasetId] as const,
    distributions: (datasetId: string, column: string) =>
      ["eda", "distributions", datasetId, column] as const,
    correlations: (datasetId: string, method: string) =>
      ["eda", "correlations", datasetId, method] as const,
    outliers: (datasetId: string, method: string, column?: string) =>
      ["eda", "outliers", datasetId, method, column] as const,
    featureImportance: (datasetId: string, target: string) =>
      ["eda", "feature-importance", datasetId, target] as const,
    timeseries: (datasetId: string, timeCol: string, valueCol: string) =>
      ["eda", "timeseries", datasetId, timeCol, valueCol] as const,
    text: (datasetId: string, column: string) =>
      ["eda", "text", datasetId, column] as const,
    quality: (datasetId: string) => ["eda", "quality", datasetId] as const,
    insights: (datasetId: string) => ["eda", "insights", datasetId] as const,
  },
  jobs: {
    get: (jobId: string) => ["jobs", jobId] as const,
    list: ["jobs"] as const,
  },
};
