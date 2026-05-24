"use client";

// Client-side providers for the whole web app. Currently just the
// QueryClientProvider; future client-side global state (toaster, theme)
// joins here.
//
// We instantiate the QueryClient lazily in useState so it isn't shared
// across React Server Component renders (each request creates a fresh
// one). The cache then lives for the lifetime of the browser session.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 30s baseline — most reads are cheap and we don't want
            // stale data sitting around for minutes.
            staleTime: 30_000,
            // We poll deliberately (IES extraction status). Window-
            // focus refetches just create noise.
            refetchOnWindowFocus: false,
            // One retry on transient. Apps/api already retries
            // upstream errors via the SDK; this is just for network
            // hiccups between browser ↔ Next.js route.
            retry: 1,
          },
          mutations: {
            // Mutations don't retry — replays are caller's call.
            retry: 0,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
