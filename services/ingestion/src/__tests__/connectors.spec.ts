import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SourceType } from '@control-tower/shared-types';
import { createDefaultConnectorRegistry } from '../connectors/connector-registry';
import { CsvFileConnector } from '../connectors/csv-file.connector';
import { jsonArrayToCsv } from '../connectors/rest-api.connector';
import { allowedUploadExtensions, ConnectorNotImplementedError } from '../connectors/connector';

describe('ConnectorRegistry', () => {
  const registry = createDefaultConnectorRegistry();

  it('registers every source type', () => {
    const types = registry.listTypes().map((t) => t.type).sort();
    expect(types).toEqual(
      [
        SourceType.AZURE_BLOB,
        SourceType.CSV_FILE,
        SourceType.CSV_UPLOAD,
        SourceType.EMAIL_FAILURE_REPORT,
        SourceType.REST_API,
        SourceType.SFTP,
        SourceType.SHAREPOINT,
        SourceType.TABLEAU,
      ].sort(),
    );
  });

  it('the failure report source is upload-only', async () => {
    const connector = registry.get(SourceType.EMAIL_FAILURE_REPORT);
    expect(connector.supportsScheduledFetch).toBe(false);
    expect((await connector.test({})).ok).toBe(true);
    expect(await connector.fetch({})).toEqual([]);
  });

  // The upload picker is driven entirely by this metadata, so a connector that
  // accepts uploads without declaring them would render as a generic "file".
  it('every upload-capable connector declares what it accepts and its label', () => {
    const uploadable = registry.listTypes().filter((t) => t.supportsUpload);
    expect(uploadable.map((t) => t.type).sort()).toEqual(
      [SourceType.CSV_UPLOAD, SourceType.EMAIL_FAILURE_REPORT].sort(),
    );
    for (const type of uploadable) {
      expect(type.uploadAccept).toBeTruthy();
      expect(type.uploadLabel).toBeTruthy();
    }
  });

  it('the failure report accepts .txt and the CSV source accepts .csv', () => {
    const byType = new Map(registry.listTypes().map((t) => [t.type, t]));
    expect(byType.get(SourceType.EMAIL_FAILURE_REPORT)!.uploadAccept).toContain('.txt');
    expect(byType.get(SourceType.EMAIL_FAILURE_REPORT)!.uploadLabel).toBe('report');
    expect(byType.get(SourceType.CSV_UPLOAD)!.uploadAccept).toContain('.csv');
    // tab-delimited exports keep a .txt name; the parser detects the delimiter
    expect(byType.get(SourceType.CSV_UPLOAD)!.uploadAccept).toContain('.txt');
  });

  it('non-upload connectors declare no upload metadata', () => {
    for (const type of registry.listTypes().filter((t) => !t.supportsUpload)) {
      expect(type.uploadAccept).toBeUndefined();
    }
  });

  // The upload endpoint validates against these, so anything advertised in the
  // browser must be a real extension the server will accept.
  it('every advertised extension is parseable and non-empty', () => {
    for (const type of registry.listTypes().filter((t) => t.supportsUpload)) {
      const extensions = allowedUploadExtensions(type.uploadAccept);
      expect(extensions.length).toBeGreaterThan(0);
      for (const ext of extensions) {
        expect(ext).toMatch(/^\.[a-z0-9]+$/);
      }
    }
  });

  it('throws a helpful error for unregistered types', () => {
    const empty = createDefaultConnectorRegistry();
    expect(empty.has(SourceType.CSV_UPLOAD)).toBe(true);
    expect(() => empty.get('NOPE' as SourceType)).toThrow(/No connector registered/);
  });

  it('upload connector: test ok, fetch returns nothing', async () => {
    const upload = registry.get(SourceType.CSV_UPLOAD);
    expect((await upload.test({})).ok).toBe(true);
    expect(await upload.fetch({})).toEqual([]);
  });

  it('planned connectors surface as not implemented', async () => {
    const sftp = registry.get(SourceType.SFTP);
    expect((await sftp.test({})).ok).toBe(false);
    await expect(sftp.fetch({})).rejects.toThrow(ConnectorNotImplementedError);
  });
});

describe('allowedUploadExtensions', () => {
  it('extracts extensions and ignores MIME types', () => {
    expect(allowedUploadExtensions('.txt,.csv,text/plain,text/csv')).toEqual(['.txt', '.csv']);
  });

  it('trims and lowercases', () => {
    expect(allowedUploadExtensions(' .TXT , .Csv ')).toEqual(['.txt', '.csv']);
  });

  it('returns nothing for undefined or MIME-only accepts', () => {
    expect(allowedUploadExtensions(undefined)).toEqual([]);
    expect(allowedUploadExtensions('text/plain')).toEqual([]);
  });
});


describe('CsvFileConnector', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'octower-'));
    await fs.writeFile(path.join(dir, 'orders_a.csv'), 'Order Number,Product Code\nA,B\n');
    await fs.writeFile(path.join(dir, 'other.txt'), 'not a csv');
    await fs.writeFile(path.join(dir, 'misc.csv'), 'Order Number,Product Code\nC,D\n');
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('fetches only CSV files, honouring the filename pattern', async () => {
    const connector = new CsvFileConnector(dir);
    const all = await connector.fetch({ connector: { directory: '.' } });
    expect(all.map((f) => f.filename).sort()).toEqual(['misc.csv', 'orders_a.csv']);

    const filtered = await connector.fetch({ connector: { directory: '.', pattern: 'orders' } });
    expect(filtered.map((f) => f.filename)).toEqual(['orders_a.csv']);
    expect(filtered[0].content.toString()).toContain('Order Number');
  });

  it('test() reports reachability and file count', async () => {
    const connector = new CsvFileConnector(dir);
    const result = await connector.test({ connector: { directory: '.' } });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('2 CSV file(s)');
  });

  it('test() fails for a missing directory', async () => {
    const connector = new CsvFileConnector(dir);
    const result = await connector.test({ connector: { directory: './does-not-exist' } });
    expect(result.ok).toBe(false);
  });

  it('blocks path traversal outside the base directory', async () => {
    const connector = new CsvFileConnector(dir);
    await expect(
      connector.fetch({ connector: { directory: '../../../../etc' } }),
    ).rejects.toThrow(/inside the ingestion data directory/);
  });
});

describe('jsonArrayToCsv', () => {
  it('converts a JSON array to CSV with a union of headers and escaping', () => {
    const csv = jsonArrayToCsv(
      JSON.stringify([
        { a: 1, b: 'x,y' },
        { a: 2, c: 'he said "hi"' },
      ]),
    );
    expect(csv.split('\n')).toEqual(['a,b,c', '1,"x,y",', '2,,"he said ""hi"""']);
  });

  it('empty array → empty string', () => {
    expect(jsonArrayToCsv('[]')).toBe('');
  });
});
