import { promises as fs } from 'fs';
import * as path from 'path';
import { ConnectionTestResult, SourceConfig, SourceType } from '@control-tower/shared-types';
import { FetchedFile } from '../types';
import { connectorSetting, SourceConnector } from './connector';

/**
 * Watches a directory (e.g. a mounted share or the local inbox) for CSV files
 * matching a glob-ish pattern. Processed files are the orchestrator's concern —
 * it archives them after a successful run.
 */
export class CsvFileConnector implements SourceConnector {
  readonly type = SourceType.CSV_FILE;
  readonly supportsScheduledFetch = true;
  readonly configHints = {
    'connector.directory': 'Directory to scan (relative paths resolve under the ingestion data dir)',
    'connector.pattern': 'Filename filter, e.g. "orders" matches orders*.csv (optional)',
  };

  constructor(private readonly baseDir: string = process.cwd()) {}

  private resolveDir(config: SourceConfig): string {
    const dir = connectorSetting(config, 'directory') ?? '.';
    const resolved = path.resolve(this.baseDir, dir);
    // path traversal guard: stay under baseDir for relative configs
    if (!path.isAbsolute(dir) && !resolved.startsWith(path.resolve(this.baseDir))) {
      throw new Error('directory must resolve inside the ingestion data directory');
    }
    return resolved;
  }

  async test(config: SourceConfig): Promise<ConnectionTestResult> {
    try {
      const dir = this.resolveDir(config);
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) return { ok: false, message: `${dir} is not a directory` };
      const files = await this.listCsvFiles(config);
      return { ok: true, message: `Directory reachable — ${files.length} CSV file(s) waiting.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async listCsvFiles(config: SourceConfig): Promise<string[]> {
    const dir = this.resolveDir(config);
    const pattern = connectorSetting(config, 'pattern')?.toLowerCase();
    const entries = await fs.readdir(dir);
    return entries
      .filter((f) => f.toLowerCase().endsWith('.csv'))
      .filter((f) => !pattern || f.toLowerCase().includes(pattern))
      .map((f) => path.join(dir, f));
  }

  async fetch(config: SourceConfig): Promise<FetchedFile[]> {
    const files = await this.listCsvFiles(config);
    return Promise.all(
      files.map(async (file) => ({
        filename: path.basename(file),
        content: await fs.readFile(file),
      })),
    );
  }
}
