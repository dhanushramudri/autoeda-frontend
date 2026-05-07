// Auth
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_active: boolean;
}

// Workspaces
export interface WorkspaceMember {
  id: string;
  role: "admin" | "analyst" | "viewer";
  joined_at: string | null;
  user: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  dataset_count: number;
  workspace_name?: string;
}

// Datasets
export type SourceType =
  | "file"
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "mssql"
  | "mongodb"
  | "s3"
  | "azure"
  | "gcs"
  | "rest_api";

export interface Dataset {
  id: string;
  workspace_id: string;
  workspace_name?: string;
  name: string;
  description: string | null;
  source_type: SourceType;
  row_count: number | null;
  column_count: number | null;
  file_size_bytes: number | null;
  content_hash: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
  job_id?: string | null;
}

export interface DatasetPreview {
  columns: string[];
  dtypes: Record<string, string>;
  rows: Record<string, unknown>[];
  total_rows: number;
}

// EDA Types
export interface ColumnProfile {
  name: string;
  dtype: string;
  semantic_type: "numeric" | "categorical" | "datetime" | "boolean" | "text" | "id_like" | "constant";
  nunique: number;
  missing_count: number;
  missing_pct: number;
  min: number | string | null;
  max: number | string | null;
  mean: number | null;
  std: number | null;
  skewness: number | null;
  kurtosis: number | null;
  top_values: Array<[string, number]> | null;
}

export interface ProfileResult {
  row_count: number;
  column_count: number;
  sampled: boolean;
  columns: ColumnProfile[];
  insights?: InsightCard[];
}

export interface MissingColumnStats {
  name: string;
  count: number;
  pct: number;
  dtype?: string;
}

export interface MissingResult {
  columns: MissingColumnStats[];
  total_missing: number;
  missing_pct: number;
  correlation_matrix: Record<string, Record<string, number | null>>;
  mcar_indicators: Record<string, { likely: string; correlated_with: string[] }>;
  imputation_suggestions: Record<string, string>;
}

export interface DistributionResult {
  column: string;
  is_numeric: boolean;
  histogram?: { bins: (number | null)[]; counts: number[] } | null;
  kde?: { x: (number | null)[]; y: (number | null)[] } | null;
  box_stats?: {
    min: number | null;
    q1: number | null;
    median: number | null;
    q3: number | null;
    max: number | null;
    outliers: (number | null)[];
  } | null;
  qq_plot?: { theoretical: (number | null)[]; sample: (number | null)[] } | null;
  normality?: {
    test: string;
    statistic: number | null;
    p_value: number | null;
    is_normal: boolean;
  } | null;
  skewness?: number | null;
  kurtosis?: number | null;
  bar_chart?: { labels: string[]; values: number[] } | null;
  unique_count?: number | null;
  top_category?: string | null;
  error?: string | null;
}

export interface CorrelationPair {
  col1: string;
  col2: string;
  correlation: number;
  abs_correlation?: number;
}

export interface CorrelationResult {
  method: string;
  matrix: Record<string, Record<string, number | null>>;
  top_pairs: CorrelationPair[];
  vif?: Array<{ column: string; vif: number }> | null;
  cramers_v?: Record<string, Record<string, number | null>> | null;
}

export interface OutlierResult {
  method: string;
  columns: Array<{
    name: string;
    outlier_count: number;
    outlier_pct: number;
    bounds: Record<string, number | null>;
  }>;
  outlier_rows: unknown[];
  total_outliers: number;
}

export interface FeatureImportanceResult {
  target: string;
  problem_type: string;
  importances: Array<{ feature: string; importance: number; method: string }>;
  mutual_info: Array<{ feature: string; score: number }>;
  correlations: Array<{ feature: string; correlation: number }>;
  error?: string | null;
}

export interface TimeSeriesResult {
  time_col: string;
  value_col: string;
  n_points: number;
  start_date: string;
  end_date: string;
  has_trend: boolean;
  seasonality?: string | null;
  adf_statistic?: number | null;
  adf_pvalue?: number | null;
  is_stationary?: boolean | null;
  line_data: { dates: string[]; values: (number | null)[] };
  rolling: { window: number; mean: (number | null)[]; std: (number | null)[] };
  decomposition?: { trend: (number | null)[]; seasonal: (number | null)[]; residual: (number | null)[]; dates: string[] } | null;
  acf?: { values: (number | null)[] } | null;
  pacf?: { values: (number | null)[] } | null;
  anomalies: Array<{ index: number; date: string; value: number | null }>;
  error?: string | null;
}

export interface TextResult {
  column: string;
  total_texts: number;
  avg_length: number;
  median_length: number;
  word_freq: Array<{ word: string; count: number }>;
  bigrams: Array<{ ngram: string; count: number }>;
  trigrams: Array<{ ngram: string; count: number }>;
  sentiment_dist: { positive: number; negative: number; neutral: number };
  language: string;
  length_distribution: { bins: number[]; counts: number[] };
  error?: string | null;
}

export interface QualityScore {
  overall: number;
  completeness: number;
  consistency: number;
  uniqueness: number;
  validity: number;
  issues: Array<{ type: string; column: string; description: string; severity: string }>;
  suggestions: string[];
}

export interface InsightCard {
  chart_type: string;
  insight: string;
  severity: "info" | "warning" | "danger";
}

export interface JobStatus {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message?: string | null;
  result_data?: Record<string, unknown> | null;
}

export interface ApiError {
  detail: string;
  code?: string;
}
