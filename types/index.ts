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
  unique_count: number;
  unique_pct: number;
  missing_count: number;
  missing_pct: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  std: number | null;
  skewness: number | null;
  kurtosis: number | null;
  top_values: Array<{ value: string; count: number; pct: number }>;
}

export interface ProfileResult {
  total_rows: number;
  total_columns: number;
  memory_mb: number;
  file_size_bytes: number | null;
  duplicate_count: number;
  duplicate_pct: number;
  sampled: boolean;
  sample_size: number;
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
  insights?: InsightCard[] | null;
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

// -- NL Query ------------------------------------------------------------------
export interface NLQueryResult {
  action: "navigate" | "transform" | "filter" | "unknown";
  params: Record<string, string | number | boolean>;
  message: string;
}

// -- Pipeline ------------------------------------------------------------------
export interface PipelineStep {
  id?: number;
  step_order: number;
  operation: string;
  column: string | null;
  params: Record<string, unknown>;
}

// -- Column Metadata -----------------------------------------------------------
export interface ColumnMeta {
  column: string;
  tags: string[];
  notes: string | null;
}

// -- Column Detail -------------------------------------------------------------
export interface ColumnDetail {
  stats: {
    name: string;
    dtype: string;
    total: number;
    missing_count: number;
    missing_pct: number;
    unique_count: number;
    mean?: number;
    median?: number;
    std?: number;
    min?: number;
    max?: number;
    q1?: number;
    q3?: number;
    outlier_count?: number;
    skewness?: number;
    kurtosis?: number;
  };
  histogram: { bins: number[]; counts: number[] } | null;
  top_values: Array<{ value: string; count: number; pct: number }>;
  suggested_dtype: string | null;
  tags: string[];
  notes: string | null;
}

// -- Filter --------------------------------------------------------------------
export type FilterOperator =
  | "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "starts_with" | "is_null" | "is_not_null";

export interface FilterConfig {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
  logic?: "AND" | "OR";
}

// -- Rules ---------------------------------------------------------------------
export type RuleType = "not_null" | "range" | "regex" | "unique" | "allowed_values";

export interface QualityRule {
  id?: number;
  column_name: string | null;
  rule_type: RuleType;
  params: Record<string, unknown>;
}

export interface RuleResult extends QualityRule {
  label: string;
  pass_pct: number;
  fail_count: number;
  fail_pct: number;
  sample_failing_rows: Record<string, unknown>[];
}

// -- Pivot ---------------------------------------------------------------------
export interface PivotResult {
  index: string[];
  columns: string[];
  data: number[][];
}

// -- Saved Chart ---------------------------------------------------------------
export interface SavedChart {
  id: number;
  name: string;
  chart_type: string;
  config: Record<string, unknown>;
  created_at: string;
}

// -- Segment -------------------------------------------------------------------
export interface NamedSegment {
  id: number;
  name: string;
  filters: FilterConfig[];
  created_at: string;
}

// -- EDA History ---------------------------------------------------------------
export interface EDARunRecord {
  id: number;
  run_at: string;
  row_count: number | null;
  col_count: number | null;
  quality_score: number | null;
  missing_pct: number | null;
  triggered_by: string;
}

// -- EDA Full Analysis ---------------------------------------------------------

export interface HistogramKDE {
  bins: (number | null)[];
  counts: (number | null)[];
  kde_x: (number | null)[];
  kde_y: (number | null)[];
  mean: number | null;
  median: number | null;
}

export interface BoxStats {
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
  mean: number | null;
  outliers: (number | null)[];
}

export interface ViolinData {
  y: (number | null)[];
  density: (number | null)[];
}

export interface QQData {
  theoretical: (number | null)[];
  sample: (number | null)[];
  line_x: (number | null)[];
  line_y: (number | null)[];
}

export interface ECDFData {
  x: (number | null)[];
  y: (number | null)[];
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export interface NormalityResult {
  test: string;
  statistic?: number | null;
  p_value: number | null;
  is_normal: boolean | null;
}

export interface NumericCharts {
  histogram_kde: HistogramKDE;
  box: BoxStats;
  violin: ViolinData;
  qq: QQData;
  ecdf: ECDFData;
  normality: NormalityResult;
  skewness: number | null;
  kurtosis: number | null;
}

export interface BarChartData {
  labels: string[];
  values: number[];
  percentages: number[];
  other_count: number;
  total_categories: number;
}

export interface PieData {
  labels: string[];
  values: number[];
  percentages: number[];
}

export interface ParetoData {
  labels: string[];
  values: number[];
  cumulative_pct: number[];
}

export interface CategoricalCharts {
  bar: BarChartData;
  pie: PieData | null;
  pareto: ParetoData;
}

export interface TimeseriesData {
  dates: string[];
  values: (number | null)[];
}

export interface SeasonalityData {
  by_hour: { labels: string[]; values: number[] };
  by_dow: { labels: string[]; values: number[] };
  by_month: { labels: string[]; values: number[] };
}

export interface DatetimeCharts {
  timeseries: TimeseriesData;
  seasonality: SeasonalityData;
}

export interface CorrelationHeatmapData {
  labels: string[];
  z: (number | null)[][];
}

export interface ScatterPair {
  col1: string;
  col2: string;
  pearson_r: number | null;
  r2: number | null;
  x: (number | null)[];
  y: (number | null)[];
  line_x: number[];
  line_y: number[];
}

export interface GroupedBoxGroup {
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
  outliers: (number | null)[];
  n: number;
}

export interface GroupedBoxData {
  numeric_col: string;
  categorical_col: string;
  groups: Record<string, GroupedBoxGroup>;
}

export interface MultiColumnAnalysis {
  correlation: CorrelationHeatmapData;
  scatter_pairs: ScatterPair[];
  grouped_box: GroupedBoxData;
}

export interface MissingBarItem {
  column: string;
  missing_count: number;
  missing_pct: number | null;
}

export interface NormalityRow {
  column: string;
  n: number;
  test: string;
  p_value: number | null;
  is_normal: boolean | null;
  skewness: number | null;
  kurtosis: number | null;
}

export interface OutlierSummaryRow {
  column: string;
  outlier_count: number;
  outlier_pct: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
}

export interface CardinalityRow {
  column: string;
  unique_count: number;
  unique_pct: number | null;
  flag: "id_like" | "constant" | "binary" | "low_cardinality" | "normal";
  dtype: string;
}

export interface DuplicateInfo {
  total_rows: number;
  duplicate_count: number;
  duplicate_pct: number | null;
}

export interface StatCards {
  normality_table: NormalityRow[];
  outlier_summary: OutlierSummaryRow[];
  cardinality: CardinalityRow[];
  duplicates: DuplicateInfo;
  missing_bar: MissingBarItem[];
}

export interface FullAnalysisResult {
  sampled: boolean;
  sample_size: number;
  total_rows: number;
  column_types: Record<string, string>;
  numeric_cols: string[];
  categorical_cols: string[];
  datetime_cols: string[];
  numeric_charts: Record<string, NumericCharts>;
  categorical_charts: Record<string, CategoricalCharts>;
  datetime_charts: Record<string, DatetimeCharts>;
  multi_column: MultiColumnAnalysis;
  missing_charts: { bar: MissingBarItem[] };
  stat_cards: StatCards;
}

// -- Workspace Analytics -------------------------------------------------------
export interface DatasetSummary {
  id: number;
  name: string;
  row_count: number | null;
  column_count: number | null;
  quality_score: number | null;
  missing_pct: number | null;
  status: string;
  created_at: string;
  last_eda_run: string | null;
}

export interface TrendPoint {
  dataset_id: number;
  dataset_name: string;
  run_at: string;
  quality_score: number;
}

export interface WorkspaceAnalytics {
  datasets: DatasetSummary[];
  trends: TrendPoint[];
  worst_quality: DatasetSummary | null;
  most_missing: DatasetSummary | null;
}
