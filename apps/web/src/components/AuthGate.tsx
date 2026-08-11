'use client';
import { type ReactNode, useEffect } from 'react';
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useIsAuthenticated,
  useMsal,
} from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { apiScope } from '@/lib/auth';

/** Redirects unauthenticated users to Entra ID sign-in. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (!isAuthenticated && inProgress === InteractionStatus.None) {
      instance.loginRedirect({ scopes: [apiScope] }).catch(() => undefined);
    }
  }, [isAuthenticated, inProgress, instance]);

  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress />
          <Typography>Signing you in with Microsoft Entra ID…</Typography>
        </Box>
      </UnauthenticatedTemplate>
    </>
  );
}
