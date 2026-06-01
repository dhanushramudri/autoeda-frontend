import axios, { AxiosError } from "axios";
import type { ApiError } from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
export const UPLOADS_BASE = API_BASE.replace(/\/api\/v1$/, "");

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("access_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  updateProfile: (data: { full_name?: string }) =>
    api.patch("/auth/me", data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post("/auth/me/change-password", data),
};

// Workspaces
export const workspacesApi = {
  list: () => api.get("/workspaces/"),
  create: (data: { name: string; description?: string }) =>
    api.post("/workspaces/", data),
  get: (id: string) => api.get(`/workspaces/${id}`),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.put(`/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/workspaces/${id}`),
  listMembers: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/members`),
  addMember: (workspaceId: string, data: { email: string; role: string }) =>
    api.post(`/workspaces/${workspaceId}/members`, data),
  removeMember: (workspaceId: string, memberId: string) =>
    api.delete(`/workspaces/${workspaceId}/members/${memberId}`),
};

// Datasets
export const datasetsApi = {
  list: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/datasets`),
  create: (workspaceId: string, formData: FormData) =>
    api.post(`/workspaces/${workspaceId}/datasets`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  get: (datasetId: string) => api.get(`/datasets/${datasetId}`),
  delete: (workspaceId: string, datasetId: string) =>
  api.delete(`/workspaces/${workspaceId}/datasets/${datasetId}`),
  refresh: (datasetId: string) => api.post(`/datasets/${datasetId}/refresh`),
  preview: (datasetId: string) => api.get(`/datasets/${datasetId}/preview`),
  getProfile: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/profile`),
  getMissing: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/missing`),
  getDistributions: (datasetId: string, column: string) =>
    api.get(`/datasets/${datasetId}/distributions`, { params: { column } }),
  getCorrelations: (datasetId: string, method: string = "pearson") =>
    api.get(`/datasets/${datasetId}/correlations`, { params: { method } }),
  getOutliers: (datasetId: string, method: string = "iqr", column?: string) =>
    api.get(`/datasets/${datasetId}/outliers`, { params: { method, column } }),
  getFeatureImportance: (datasetId: string, target: string) =>
    api.get(`/datasets/${datasetId}/feature-importance`, { params: { target } }),
  getTimeSeries: (datasetId: string, time_col: string, value_col: string) =>
    api.get(`/datasets/${datasetId}/timeseries`, { params: { time_col, value_col } }),
  getText: (datasetId: string, column: string) =>
    api.get(`/datasets/${datasetId}/text`, { params: { column } }),
  getQualityScore: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/quality-score`),
  getInsights: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/insights`),
  transformPreview: (datasetId: string, operations: unknown[]) =>
    api.post(`/datasets/${datasetId}/transform/preview`, { operations }),
  transformApply: (datasetId: string, operations: unknown[]) =>
    api.post(`/datasets/${datasetId}/transform/apply`, { operations }),
  transform: (datasetId: string, ops: unknown[]) =>
    api.post(`/datasets/${datasetId}/transform`, { operations: ops }),
  export: (datasetId: string) => api.get(`/datasets/${datasetId}/export`, { responseType: "blob" }),
  // NL Query
  nlQuery: (datasetId: string, query: string) =>
    api.post(`/datasets/${datasetId}/nl-query`, { query }),
  // Filter Preview
  filterPreview: (datasetId: string, filters: unknown[], limit = 100) =>
    api.post(`/datasets/${datasetId}/filter-preview`, { filters, limit }),
  // Pipeline
  getPipeline: (datasetId: string) => api.get(`/datasets/${datasetId}/pipeline`),
  savePipeline: (datasetId: string, steps: unknown[]) =>
    api.post(`/datasets/${datasetId}/pipeline`, { steps }),
  clearPipeline: (datasetId: string) => api.delete(`/datasets/${datasetId}/pipeline`),
  // Column Metadata
  getAllColumnMetadata: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/columns/metadata`),
  upsertColumnMetadata: (datasetId: string, column: string, data: { tags: string[]; notes?: string }) =>
    api.put(`/datasets/${datasetId}/columns/${encodeURIComponent(column)}/metadata`, data),
  // Column Detail
  getColumnDetail: (datasetId: string, column: string) =>
    api.get(`/datasets/${datasetId}/columns/${encodeURIComponent(column)}/detail`),
  // Rules
  saveRules: (datasetId: string, rules: unknown[]) =>
    api.post(`/datasets/${datasetId}/rules`, { rules }),
  getRuleResults: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/rules/results`),
  // Pivot
  getPivot: (datasetId: string, params: { row_col: string; col_col: string; value_col: string; agg_func?: string }) =>
    api.get(`/datasets/${datasetId}/pivot`, { params }),
  // Saved Charts
  getSavedCharts: (datasetId: string) => api.get(`/datasets/${datasetId}/charts/saved`),
  saveChart: (datasetId: string, data: { name: string; chart_type: string; config: unknown }) =>
    api.post(`/datasets/${datasetId}/charts/saved`, data),
  deleteSavedChart: (datasetId: string, chartId: number) =>
    api.delete(`/datasets/${datasetId}/charts/saved/${chartId}`),
  // Segments
  getSegments: (datasetId: string) => api.get(`/datasets/${datasetId}/segments`),
  createSegment: (datasetId: string, data: { name: string; filters: unknown[] }) =>
    api.post(`/datasets/${datasetId}/segments`, data),
  deleteSegment: (datasetId: string, segmentId: number) =>
    api.delete(`/datasets/${datasetId}/segments/${segmentId}`),
  // History
  getHistory: (datasetId: string) => api.get(`/datasets/${datasetId}/history`),
  recordEDArun: (datasetId: string) => api.post(`/datasets/${datasetId}/history/record`),
  // Report
  getReport: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/report`, { responseType: "text", headers: { Accept: "text/html" } }),
  // Full EDA Analysis
  getAnalysis: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/analysis`),
  getAnalysisColumn: (datasetId: string, colName: string) =>
    api.get(`/datasets/${datasetId}/analysis/column/${encodeURIComponent(colName)}`),
  // On-demand bivariate / multivariate
  getBivariate: (datasetId: string, col1: string, col2: string, btype: "num_num" | "cat_cat" | "num_cat") =>
    api.get(`/datasets/${datasetId}/bivariate`, { params: { col1, col2, btype } }),
  getPCA: (datasetId: string, nComponents = 2) =>
    api.get(`/datasets/${datasetId}/pca`, { params: { n_components: nComponents } }),
  getScatter3d: (datasetId: string, x: string, y: string, z: string) =>
    api.get(`/datasets/${datasetId}/scatter3d`, { params: { x, y, z } }),
  // AI features
  getAiNarrative: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/ai/narrative`),
  aiChat: (datasetId: string, message: string, history: { role: string; content: string }[], pageContext?: Record<string, unknown>) =>
    api.post(`/datasets/${datasetId}/ai/chat`, { message, history, page_context: pageContext ?? null }),
  getAiTransformSuggestions: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/ai/transform-suggestions`),
  nlTransform: (datasetId: string, prompt: string) =>
    api.post(`/datasets/${datasetId}/ai/nl-transform`, { prompt }),
  getHypotheses: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/ai/hypotheses`),
  // SQL Editor
  sqlExecute: (datasetId: string, sql: string, limit = 1000) =>
    api.post(`/datasets/${datasetId}/sql/execute`, { sql, limit }),
  sqlExplain: (datasetId: string, sql: string) =>
    api.post(`/datasets/${datasetId}/sql/explain`, { sql }),
  sqlSchema: (datasetId: string) =>
    api.get(`/datasets/${datasetId}/sql/schema`),
  // Assumptions / Validation
  validateAssumption: (datasetId: string, assumption: string, source: string = "user") =>
    api.post(`/datasets/${datasetId}/assumptions/validate`, { assumption, source }),
};

// Workspaces extra
export const workspacesExtraApi = {
  joinDatasets: (workspaceId: string, data: unknown) =>
    api.post(`/workspaces/${workspaceId}/datasets/join`, data),
  getAnalytics: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/analytics`),
  // Join Builder
  generateJoinSql: (workspaceId: string, data: { nodes: unknown[]; edges: unknown[] }) =>
    api.post(`/workspaces/${workspaceId}/join-builder/generate-sql`, data),
  executeJoin: (workspaceId: string, data: { nodes: unknown[]; edges: unknown[]; limit?: number }) =>
    api.post(`/workspaces/${workspaceId}/join-builder/execute`, data),
  saveJoinAsDataset: (workspaceId: string, data: { nodes: unknown[]; edges: unknown[]; name: string; workspace_id: number }) =>
    api.post(`/workspaces/${workspaceId}/join-builder/save-as-dataset`, data),
};

// Warehouse
export const warehouseApi = {
  catalog: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/warehouse/catalog`),
  execute: (workspaceId: string, sql: string, limit = 5000) =>
    api.post(`/workspaces/${workspaceId}/warehouse/execute`, { sql, limit }),
  explain: (workspaceId: string, sql: string) =>
    api.post(`/workspaces/${workspaceId}/warehouse/explain`, { sql }),
  sourceTableColumns: (workspaceId: string, sourceId: number, table: string) =>
    api.get(`/workspaces/${workspaceId}/warehouse/sources/${sourceId}/tables/${encodeURIComponent(table)}/columns`),
};

// Data Sources
export const sourcesApi = {
  catalog: () => api.get("/sources/catalog"),
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/sources`),
  create: (workspaceId: string, data: {
    name: string; description?: string; source_type: string;
    credentials?: Record<string, unknown>; config?: Record<string, unknown>;
  }) => api.post(`/workspaces/${workspaceId}/sources`, data),
  get: (workspaceId: string, sourceId: number) =>
    api.get(`/workspaces/${workspaceId}/sources/${sourceId}`),
  update: (workspaceId: string, sourceId: number, data: {
    name?: string; description?: string;
    credentials?: Record<string, unknown>; config?: Record<string, unknown>;
  }) => api.patch(`/workspaces/${workspaceId}/sources/${sourceId}`, data),
  delete: (workspaceId: string, sourceId: number) =>
    api.delete(`/workspaces/${workspaceId}/sources/${sourceId}`),
  test: (workspaceId: string, sourceId: number) =>
    api.post(`/workspaces/${workspaceId}/sources/${sourceId}/test`),
  testAdhoc: (data: {
    source_type: string; credentials?: Record<string, unknown>; config?: Record<string, unknown>;
  }) => api.post("/sources/test", data),
  schema: (workspaceId: string, sourceId: number) =>
    api.get(`/workspaces/${workspaceId}/sources/${sourceId}/schema`),
  tableColumns: (workspaceId: string, sourceId: number, table: string) =>
    api.get(`/workspaces/${workspaceId}/sources/${sourceId}/schema/${encodeURIComponent(table)}/columns`),
  preview: (workspaceId: string, sourceId: number, table?: string, rows = 50) =>
    api.get(`/workspaces/${workspaceId}/sources/${sourceId}/preview`, { params: { table, rows } }),
  importAsDataset: (workspaceId: string, sourceId: number, data: {
    dataset_name: string;
    workspace_id: number;
    table?: string | null;
    limit?: number;
  }) => api.post(`/workspaces/${workspaceId}/sources/${sourceId}/import`, data),
};

// Jobs
export const jobsApi = {
  get: (jobId: string) => api.get(`/jobs/${jobId}`),
  list: () => api.get("/jobs/"),
};

// Feedback
export const feedbackApi = {
  submit: (data: FormData) =>
    api.post("/feedback", data, { headers: { "Content-Type": undefined } }),
  list: () => api.get("/feedback"),
  vote: (id: number) => api.post(`/feedback/${id}/vote`),
  getComments: (id: number) => api.get(`/feedback/${id}/comments`),
  addComment: (id: number, content: string, parentId?: number | null) =>
    api.post(`/feedback/${id}/comments`, { content, parent_id: parentId ?? null }),
  deleteComment: (id: number, commentId: number) =>
    api.delete(`/feedback/${id}/comments/${commentId}`),
  voteComment: (id: number, commentId: number, voteType: "like" | "dislike") =>
    api.post(`/feedback/${id}/comments/${commentId}/vote`, { vote_type: voteType }),
  updateStatus: (id: number, status: string) =>
    api.patch(`/feedback/${id}`, { status }),
};
