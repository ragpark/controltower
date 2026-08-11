import { ConnectionTestResult, SourceConfig, SourceType } from '@control-tower/shared-types';
import { FetchedFile } from '../types';
import { SourceConnector } from './connector';

/** Manual uploads arrive via the API's upload endpoint, not by scheduled fetch. */
export class CsvUploadConnector implements SourceConnector {
  readonly type = SourceType.CSV_UPLOAD;
  readonly supportsScheduledFetch = false;
  readonly supportsUpload = true;
  readonly configHints = {
    mapping: 'Column mapping from canonical order fields to CSV headers',
    delimiter: 'CSV delimiter (default ",")',
  };

  async test(_config: SourceConfig): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Manual upload source — files are provided via the Upload action.' };
  }

  async fetch(_config: SourceConfig): Promise<FetchedFile[]> {
    return []; // nothing to pull; files are pushed via /imports/upload
  }
}
