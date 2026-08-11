export interface AppConfig {
  port: number;
  auth: {
    enabled: boolean;
    tenantId: string;
    audience: string;
  };
  ingestion: {
    dataDir: string;
  };
  otel: {
    enabled: boolean;
  };
}

export const configuration = (): AppConfig => ({
  port: Number(process.env.API_PORT ?? 4000),
  auth: {
    enabled: (process.env.AUTH_ENABLED ?? 'false').toLowerCase() === 'true',
    tenantId: process.env.ENTRA_TENANT_ID ?? '',
    audience: process.env.ENTRA_API_AUDIENCE ?? 'api://order-control-tower',
  },
  ingestion: {
    dataDir: process.env.INGESTION_DATA_DIR ?? './data/inbox',
  },
  otel: {
    enabled: (process.env.OTEL_ENABLED ?? 'false').toLowerCase() === 'true',
  },
});
