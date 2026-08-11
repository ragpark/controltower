import { ConnectionTestResult, SourceConfig, SourceType } from '@control-tower/shared-types';
import { FetchedFile } from '../types';
import { ConnectorNotImplementedError, SourceConnector } from './connector';

/**
 * Planned connectors, registered so they appear in the Settings UI with clear
 * "not yet implemented" behaviour. Implement fetch()/test() and they light up —
 * no other code changes required.
 */
abstract class PlannedConnector implements SourceConnector {
  abstract readonly type: SourceType;
  abstract readonly configHints: Record<string, string>;
  readonly supportsScheduledFetch = true;

  async test(_config: SourceConfig): Promise<ConnectionTestResult> {
    return {
      ok: false,
      message: `The ${this.type} connector is registered but not yet implemented in this deployment.`,
    };
  }

  async fetch(_config: SourceConfig): Promise<FetchedFile[]> {
    throw new ConnectorNotImplementedError(this.type);
  }
}

export class SftpConnector extends PlannedConnector {
  readonly type = SourceType.SFTP;
  readonly configHints = {
    'connector.host': 'SFTP host',
    'connector.port': 'Port (default 22)',
    'connector.username': 'Username',
    'connector.privateKeySecret': 'Name of the secret holding the private key',
    'connector.remotePath': 'Remote directory containing CSV files',
  };
}

export class SharePointConnector extends PlannedConnector {
  readonly type = SourceType.SHAREPOINT;
  readonly configHints = {
    'connector.siteUrl': 'SharePoint site URL',
    'connector.driveName': 'Document library name',
    'connector.folderPath': 'Folder containing exports',
    'connector.clientIdSecret': 'Entra app registration used via Microsoft Graph',
  };
}

export class TableauConnector extends PlannedConnector {
  readonly type = SourceType.TABLEAU;
  readonly configHints = {
    'connector.serverUrl': 'Tableau server URL',
    'connector.viewId': 'View to export as CSV',
    'connector.patSecret': 'Name of the secret holding the personal access token',
  };
}
