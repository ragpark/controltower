import { ConnectionTestResult, SourceConfig, SourceType } from '@control-tower/shared-types';
import { FetchedFile } from '../types';
import { connectorSetting, SourceConnector } from './connector';

/**
 * Pulls a CSV payload from an HTTP(S) endpoint. Supports a bearer token or
 * custom header for auth. JSON array responses are converted to CSV so the
 * same parsing pipeline applies.
 */
export class RestApiConnector implements SourceConnector {
  readonly type = SourceType.REST_API;
  readonly supportsScheduledFetch = true;
  readonly configHints = {
    'connector.url': 'HTTPS endpoint returning CSV (or a JSON array of objects)',
    'connector.authToken': 'Optional bearer token',
    'connector.headerName': 'Optional custom auth header name (used with authToken)',
  };

  private buildHeaders(config: SourceConfig): Record<string, string> {
    const token = connectorSetting(config, 'authToken');
    if (!token) return {};
    const headerName = connectorSetting(config, 'headerName');
    return headerName ? { [headerName]: token } : { Authorization: `Bearer ${token}` };
  }

  private requireUrl(config: SourceConfig): string {
    const url = connectorSetting(config, 'url');
    if (!url) throw new Error('connector.url is required for REST API sources');
    if (!/^https?:\/\//i.test(url)) throw new Error('connector.url must be http(s)');
    return url;
  }

  async test(config: SourceConfig): Promise<ConnectionTestResult> {
    try {
      const url = this.requireUrl(config);
      const res = await fetch(url, { method: 'GET', headers: this.buildHeaders(config) });
      return res.ok
        ? { ok: true, message: `Endpoint reachable (HTTP ${res.status}).` }
        : { ok: false, message: `Endpoint returned HTTP ${res.status}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async fetch(config: SourceConfig): Promise<FetchedFile[]> {
    const url = this.requireUrl(config);
    const res = await fetch(url, { headers: this.buildHeaders(config) });
    if (!res.ok) throw new Error(`REST source returned HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') ?? '';
    const body = await res.text();
    const filename = `rest-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

    if (contentType.includes('json') || body.trimStart().startsWith('[')) {
      return [{ filename, content: jsonArrayToCsv(body) }];
    }
    return [{ filename, content: body }];
  }
}

export function jsonArrayToCsv(json: string): string {
  const data = JSON.parse(json) as Record<string, unknown>[];
  if (!Array.isArray(data) || data.length === 0) return '';
  const headers = [...new Set(data.flatMap((row) => Object.keys(row)))];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(escape).join(','),
    ...data.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  return lines.join('\n');
}
