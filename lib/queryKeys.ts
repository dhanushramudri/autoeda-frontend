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
    analysis: (datasetId: string) => ["eda", "analysis", datasetId] as const,
    analysisColumn: (datasetId: string, col: string) => ["eda", "analysis", datasetId, col] as const,
  },
  jobs: {
    get: (jobId: string) => ["jobs", jobId] as const,
    list: ["jobs"] as const,
  },
  pipeline: {
    get: (datasetId: string) => ["pipeline", datasetId] as const,
  },
  columnMeta: {
    all: (datasetId: string) => ["columnMeta", datasetId] as const,
    one: (datasetId: string, column: string) => ["columnMeta", datasetId, column] as const,
  },
  columnDetail: {
    get: (datasetId: string, column: string) => ["columnDetail", datasetId, column] as const,
  },
  rules: {
    results: (datasetId: string) => ["rules", "results", datasetId] as const,
  },
  charts: {
    saved: (datasetId: string) => ["charts", "saved", datasetId] as const,
  },
  segments: {
    list: (datasetId: string) => ["segments", datasetId] as const,
  },
  history: {
    list: (datasetId: string) => ["history", datasetId] as const,
  },
  analytics: {
    workspace: (workspaceId: string) => ["analytics", "workspace", workspaceId] as const,
  },
  sql: {
    schema: (datasetId: string) => ["sql", "schema", datasetId] as const,
  },
  sources: {
    catalog: () => ["sources", "catalog"] as const,
    list: (workspaceId: string) => ["sources", workspaceId] as const,
    detail: (workspaceId: string, sourceId: number) => ["sources", workspaceId, sourceId] as const,
    schema: (workspaceId: string, sourceId: number) => ["source-schema", workspaceId, sourceId] as const,
  },
  docs: {
    categories: () => ["docs", "categories"] as const,
    articles: (categoryId: number) => ["docs", "articles", categoryId] as const,
    article: (articleId: number) => ["docs", "article", articleId] as const,
    forDataset: (datasetId: string) => ["docs", "for-dataset", datasetId] as const,
  },
  scout: {
    conversations: (workspaceId: string) => ["scout", "conversations", workspaceId] as const,
    thread: (workspaceId: string, conversationId: number) => ["scout", "thread", workspaceId, conversationId] as const,
    suggestions: (workspaceId: string) => ["scout", "suggestions", workspaceId] as const,
  },
  hypotheses: {
    list: (workspaceId: string, datasetId?: string) => ["hypotheses", "list", workspaceId, datasetId] as const,
  },
};
