'use client';
import { useState, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MsalProvider } from '@azure/msal-react';
import { theme } from '@/theme';
import { authEnabled, getMsalInstance } from '@/lib/auth';
import { AuthGate } from '@/components/AuthGate';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  const app = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );

  if (!authEnabled) return app;
  return (
    <MsalProvider instance={getMsalInstance()}>
      <AuthGate>{app}</AuthGate>
    </MsalProvider>
  );
}
