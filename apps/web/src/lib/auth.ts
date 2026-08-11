'use client';
import {
  Configuration,
  PublicClientApplication,
} from '@azure/msal-browser';

export const authEnabled =
  (process.env.NEXT_PUBLIC_AUTH_ENABLED ?? 'false').toLowerCase() === 'true';

const tenantId = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID ?? 'common';
export const apiScope =
  process.env.NEXT_PUBLIC_ENTRA_API_SCOPE ?? 'api://order-control-tower/access_as_user';

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID ?? '',
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window === 'undefined' ? '/' : window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
};

let instance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (!instance) instance = new PublicClientApplication(msalConfig);
  return instance;
}

/** Returns a bearer token for the API, or null when auth is disabled. */
export async function acquireApiToken(): Promise<string | null> {
  if (!authEnabled) return null;
  const msal = getMsalInstance();
  const account = msal.getAllAccounts()[0];
  if (!account) return null;
  try {
    const result = await msal.acquireTokenSilent({ scopes: [apiScope], account });
    return result.accessToken;
  } catch {
    await msal.acquireTokenRedirect({ scopes: [apiScope] });
    return null;
  }
}
