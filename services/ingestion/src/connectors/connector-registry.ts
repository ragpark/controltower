import { SourceType, SourceTypeInfo, SOURCE_TYPE_LABELS } from '@control-tower/shared-types';
import { SourceConnector } from './connector';
import { AzureBlobConnector } from './azure-blob.connector';
import { CsvFileConnector } from './csv-file.connector';
import { CsvUploadConnector } from './csv-upload.connector';
import { RestApiConnector } from './rest-api.connector';
import { EmailFailureReportConnector } from './email-report.connector';
import { SftpConnector, SharePointConnector, TableauConnector } from './stub.connectors';

export class ConnectorRegistry {
  private readonly connectors = new Map<SourceType, SourceConnector>();

  register(connector: SourceConnector): this {
    this.connectors.set(connector.type, connector);
    return this;
  }

  get(type: SourceType): SourceConnector {
    const connector = this.connectors.get(type);
    if (!connector) {
      throw new Error(
        `No connector registered for source type "${type}". Registered: ${[...this.connectors.keys()].join(', ')}`,
      );
    }
    return connector;
  }

  has(type: SourceType): boolean {
    return this.connectors.has(type);
  }

  listTypes(): SourceTypeInfo[] {
    return [...this.connectors.values()].map((c) => ({
      type: c.type,
      label: SOURCE_TYPE_LABELS[c.type],
      supportsSchedule: c.supportsScheduledFetch,
      supportsUpload: c.supportsUpload,
      uploadAccept: c.uploadAccept,
      uploadLabel: c.uploadLabel,
      configHints: c.configHints,
    }));
  }
}

export function createDefaultConnectorRegistry(options?: {
  csvFileBaseDir?: string;
}): ConnectorRegistry {
  return new ConnectorRegistry()
    .register(new CsvUploadConnector())
    .register(new CsvFileConnector(options?.csvFileBaseDir))
    .register(new RestApiConnector())
    .register(new AzureBlobConnector())
    .register(new EmailFailureReportConnector())
    .register(new SftpConnector())
    .register(new SharePointConnector())
    .register(new TableauConnector());
}
