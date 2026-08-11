import { ConnectionTestResult, SourceConfig, SourceType } from '@control-tower/shared-types';
import { FetchedFile } from '../types';
import { connectorSetting, SourceConnector } from './connector';

/**
 * Reads a single blob via a SAS URL — no SDK dependency needed for read-only
 * ingestion. For container listing, extend with @azure/storage-blob.
 */
export class AzureBlobConnector implements SourceConnector {
  readonly type = SourceType.AZURE_BLOB;
  readonly supportsScheduledFetch = true;
  readonly supportsUpload = false;
  readonly configHints = {
    'connector.sasUrl': 'Full blob SAS URL (read permission) pointing at the CSV blob',
  };

  private requireSasUrl(config: SourceConfig): string {
    const url = connectorSetting(config, 'sasUrl');
    if (!url) throw new Error('connector.sasUrl is required for Azure Blob sources');
    if (!/^https:\/\//i.test(url)) throw new Error('connector.sasUrl must be https');
    return url;
  }

  async test(config: SourceConfig): Promise<ConnectionTestResult> {
    try {
      const url = this.requireSasUrl(config);
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok
        ? { ok: true, message: `Blob reachable (HTTP ${res.status}).` }
        : { ok: false, message: `Blob returned HTTP ${res.status}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async fetch(config: SourceConfig): Promise<FetchedFile[]> {
    const url = this.requireSasUrl(config);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Azure Blob returned HTTP ${res.status}`);
    const content = Buffer.from(await res.arrayBuffer());
    const pathname = new URL(url).pathname;
    const filename = decodeURIComponent(pathname.split('/').pop() || 'blob.csv');
    return [{ filename, content }];
  }
}
