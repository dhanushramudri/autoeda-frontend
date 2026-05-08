import { create } from "zustand";
import { persist } from "zustand/middleware";
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
          localStorage.setItem("access_token", token);
          localStorage.setItem("autoeda-auth", JSON.stringify({ user, token }));
        }
      },
      clearAuth: () => {
        set({ user: null, token: null });
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("autoeda-auth");
        }
      },
      isAuthenticated: () => !!get().token,
      rehydrate: () => {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("autoeda-auth");
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
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        // Restore token to localStorage when hydrating
        if (state && state.token && typeof window !== "undefined") {
          localStorage.setItem("access_token", state.token);
        }
      },
    }
  )
);

