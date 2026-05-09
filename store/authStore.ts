import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/types";

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  rehydrate: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        set({ user, token });
        if (typeof window !== "undefined") {
          sessionStorage.setItem("access_token", token);
        }
      },
      clearAuth: () => {
        set({ user: null, token: null });
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("access_token");
          sessionStorage.removeItem("autoeda-auth");
        }
      },
      isAuthenticated: () => !!get().token,
      rehydrate: () => {
        if (typeof window !== "undefined") {
          const stored = sessionStorage.getItem("autoeda-auth");
          if (stored) {
            try {
              const { user, token } = JSON.parse(stored);
              set({ user, token });
            } catch (e) {
              // Storage data is invalid
            }
          }
        }
      },
    }),
    {
      name: "autoeda-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : ({} as Storage)
      ),
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token && typeof window !== "undefined") {
          sessionStorage.setItem("access_token", state.token);
        }
      },
    }
  )
);

