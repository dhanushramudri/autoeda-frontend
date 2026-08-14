import { create } from "zustand";
import { persist } from "zustand/middleware";

export const ROW_LIMIT_OPTIONS = [
  { label: "10K rows", value: 10_000 },
  { label: "50K rows", value: 50_000 },
  { label: "100K rows", value: 100_000 },
  { label: "500K rows", value: 500_000 },
  { label: "1M rows", value: 1_000_000 },
  { label: "All rows (up to 2M)", value: 2_000_000 },
] as const;

export const DEFAULT_ROW_LIMIT = 2_000_000;

interface RowLimitStore {
  rowLimit: number;
  setRowLimit: (n: number) => void;
}

export const useRowLimitStore = create<RowLimitStore>()(
  persist(
    (set) => ({
      rowLimit: DEFAULT_ROW_LIMIT,
      setRowLimit: (n) => set({ rowLimit: n }),
    }),
    {
      name: "autoeda-row-limit",
      partialize: (state) => ({ rowLimit: state.rowLimit }),
    }
  )
);
