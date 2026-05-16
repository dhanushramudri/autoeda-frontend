import { create } from "zustand";

export interface PageContext {
  page: string;
  label: string;                      // shown as badge in chat panel
  details: Record<string, unknown>;   // sent to backend (keep < 10 keys)
  suggestedQuestions: string[];       // chips shown when chat is empty
}

interface AiContextState {
  pageContext: PageContext | null;
  setPageContext: (ctx: PageContext | null) => void;
  // Trigger a question from a chart button without the user typing
  pendingQuestion: string | null;
  setPendingQuestion: (q: string | null) => void;
}

export const useAiContextStore = create<AiContextState>((set) => ({
  pageContext: null,
  setPageContext: (ctx) => set({ pageContext: ctx }),
  pendingQuestion: null,
  setPendingQuestion: (q) => set({ pendingQuestion: q }),
}));
