"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Configure global retry: 3 attempts with 2s, 4s, 8s delays
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => [2000, 4000, 8000][attempt - 1] ?? 8000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}