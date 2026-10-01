"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { TourProvider } from "@/hooks/useTourContext";
import { TourOverlay } from "@/components/tour/TourOverlay";

function ThemeApplier() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return null;
}

function AuthRehydrator({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    useAuthStore.persist.rehydrate();
    // Auto-load the current user from the backend (no login required — backend returns the admin).
    // This populates user info so components that read authStore.user work correctly.
    if (!useAuthStore.getState().user) {
      import("@/lib/api").then(({ authApi }) => {
        authApi.me().then((res) => {
          useAuthStore.getState().setAuth(res.data, "");
        }).catch(() => {/* ignore — user stays null */});
      });
    }
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TourProvider>
        <ThemeApplier />
        <AuthRehydrator>{children}</AuthRehydrator>
        <TourOverlay />
        <ReactQueryDevtools initialIsOpen={false} />
      </TourProvider>
    </QueryClientProvider>
  );
}
