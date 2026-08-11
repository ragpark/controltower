import { ConnectionTestResult, SourceConfig, SourceType } from '@control-tower/shared-types';
import { FetchedFile } from '../types';

/**
 * Strategy pattern seam for data sources. Implement + register with the
 * ConnectorRegistry to add a new source type (SFTP, SharePoint, Kafka, …)
 * without touching the orchestration pipeline.
 */
export interface SourceConnector {
  readonly type: SourceType;
  /** Whether the orchestrator can pull data on a schedule (vs. push/upload only). */
  readonly supportsScheduledFetch: boolean;
  /** Human hints shown in the Settings UI for the connector block of configJson. */
  readonly configHints: Record<string, string>;
  test(config: SourceConfig): Promise<ConnectionTestResult>;
  fetch(config: SourceConfig): Promise<FetchedFile[]>;
}

export class ConnectorNotImplementedError extends Error {
  constructor(type: string) {
    super(
      `Connector "${type}" is registered but not yet implemented. ` +
        'Implement SourceConnector for this type and register it in the ConnectorRegistry.',
    );
    this.name = 'ConnectorNotImplementedError';
  }
}

export function connectorSetting(config: SourceConfig, key: string): string | undefined {
  const value = config.connector?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
