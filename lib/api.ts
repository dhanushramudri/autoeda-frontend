import axios, { AxiosError } from "axios";
import type { ApiError } from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
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
        localStorage.removeItem("access_token");
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
  delete: (datasetId: string) => api.delete(`/datasets/${datasetId}`),
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
};

// Jobs
export const jobsApi = {
  get: (jobId: string) => api.get(`/jobs/${jobId}`),
  list: () => api.get("/jobs/"),
};
