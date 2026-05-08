"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

function AuthRehydrator({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Rehydrate auth store from localStorage on mount
    if (typeof window !== "undefined") {
      useAuthStore.persist.rehydrate();
      setIsHydrated(true);
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
      <AuthRehydrator>{children}</AuthRehydrator>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
