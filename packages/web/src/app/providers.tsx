'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';
import { useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = createTRPCReact<any>();

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kite402:token') ?? '';
}

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.trim() || '';
}

function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeData = (error as { data?: { httpStatus?: number; code?: string } }).data;
  return maybeData?.httpStatus === 401 || maybeData?.code === 'UNAUTHORIZED';
}

function handleSessionExpired() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (path.startsWith('/auth/')) return;

  localStorage.removeItem('kite402:token');
  sessionStorage.setItem('kite402:authMessage', 'session-expired');
  window.location.assign('/auth/login?reason=session_expired');
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        onError: (error) => {
          if (isUnauthorizedError(error)) handleSessionExpired();
        },
      },
      mutations: {
        onError: (error) => {
          if (isUnauthorizedError(error)) handleSessionExpired();
        },
      },
    },
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getApiBase()}/trpc`,
          headers() {
            const token = getToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
