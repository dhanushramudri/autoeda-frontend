import { create } from "zustand";

export interface PageContext {
  page: string;
  label: string;                   
  details: Record<string, unknown>;  
  suggestedQuestions: string[];       
}

export interface AnalysisData {
  total_rows: number;
  numeric_cols: string[];
  categorical_cols: string[];
  datetime_cols: string[];
  sampled?: boolean;
  sample_size?: number;
  [key: string]: unknown;
}

interface AiContextState {
  pageContext: PageContext | null;
  setPageContext: (ctx: PageContext | null) => void;
  pendingQuestion: string | null;
  setPendingQuestion: (q: string | null) => void;
  analysisData: AnalysisData | undefined;
  setAnalysisData: (data: AnalysisData | undefined) => void;
}

export function serializeAnalysisForAI(analysisData: AnalysisData | undefined): string | null {
  if (!analysisData) return null;
  return JSON.stringify({
    total_rows: analysisData.total_rows,
    numeric_columns: analysisData.numeric_cols,
    categorical_columns: analysisData.categorical_cols,
    datetime_columns: analysisData.datetime_cols,
    is_sampled: analysisData.sampled || false,
    sample_size: analysisData.sample_size || null,
  });
}

export const useAiContextStore = create<AiContextState>((set) => ({
  pageContext: null,
  setPageContext: (ctx) => set({ pageContext: ctx }),
  pendingQuestion: null,
  setPendingQuestion: (q) => set({ pendingQuestion: q }),
  analysisData: undefined,
  setAnalysisData: (data) => set({ analysisData: data }),
}));