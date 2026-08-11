import { ConnectionTestResult, SourceConfig, SourceType } from '@control-tower/shared-types';
import { FetchedFile } from '../types';
import { SourceConnector } from './connector';

/**
 * The daily provisioning failure report. The email body is supplied by upload
 * today; an automated transport (Graph mailbox poll, or a mail rule writing the
 * body to Blob storage) can be added later without changing the parser.
 */
export class EmailFailureReportConnector implements SourceConnector {
  readonly type = SourceType.EMAIL_FAILURE_REPORT;
  readonly supportsScheduledFetch = false;
  readonly supportsUpload = true;
  readonly configHints = {
    note: 'Paste or upload the email body as a .txt/.csv file. No mapping is required — the report layout is fixed.',
  };

  async test(_config: SourceConfig): Promise<ConnectionTestResult> {
    return {
      ok: true,
      message: 'Upload source — provide the failure report email body via the Upload action.',
    };
  }

  async fetch(_config: SourceConfig): Promise<FetchedFile[]> {
    return [];
  }
}
