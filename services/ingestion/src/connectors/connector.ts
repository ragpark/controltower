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
  /**
   * Whether files are pushed to this source via the upload endpoint. Declared
   * per connector so the upload picker stays correct as new types are added.
   */
  readonly supportsUpload: boolean;
  /**
   * What the file dialog should accept, and the noun to show on the upload
   * button. Declared here so the picker never has to special-case a type.
   */
  readonly uploadAccept?: string;
  readonly uploadLabel?: string;
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

/**
 * The file extensions a connector accepts, parsed from its `uploadAccept`.
 * The upload endpoint validates against this so the extensions offered in the
 * browser and the ones the server allows cannot drift apart.
 */
export function allowedUploadExtensions(accept?: string): string[] {
  return (accept ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.startsWith('.'));
}

export function connectorSetting(config: SourceConfig, key: string): string | undefined {
  const value = config.connector?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
