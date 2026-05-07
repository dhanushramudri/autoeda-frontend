import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceStore {
  currentWorkspaceId: string | null;
  setCurrentWorkspace: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspace: (id) => set({ currentWorkspaceId: id }),
    }),
    {
      name: "autoeda-workspace",
      partialize: (state) => ({ currentWorkspaceId: state.currentWorkspaceId }),
    }
  )
);
