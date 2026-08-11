/**
 * API integration tests. They need a real PostgreSQL — set DATABASE_URL
 * (e.g. via `docker compose up db`) before running `npm run test:e2e`.
 * Without a database the suite skips instead of failing.
 */
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d('Order Control Tower API (e2e)', () => {
  let app: INestApplication;
  let sourceId: string;

  beforeAll(async () => {
    process.env.AUTH_ENABLED = 'false';
    process.env.SCHEDULER_ENABLED = 'false';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['healthz', 'readyz', 'metrics'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /healthz and /readyz report healthy', async () => {
    await request(app.getHttpServer()).get('/healthz').expect(200);
    const ready = await request(app.getHttpServer()).get('/readyz').expect(200);
    expect(ready.body.database).toBe('up');
  });

  it('GET /metrics exposes Prometheus metrics', async () => {
    const res = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(res.text).toContain('process_cpu_user_seconds_total');
  });

  it('creates a source, uploads a CSV and the pipeline classifies orders', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/v1/sources')
      .send({ name: `e2e-src-${Date.now()}`, type: 'CSV_UPLOAD', configJson: {} })
      .expect(201);
    sourceId = create.body.id;

    const csv = [
      'Order Number,Product Code,Customer Name,Order Status,Quantity,Value,Order Date',
      `E2E-${Date.now()},SKU-1,Test Customer,Cancelled,1,10.00,2026-08-01`,
    ].join('\n');

    const upload = await request(app.getHttpServer())
      .post('/api/v1/imports/upload')
      .field('sourceId', sourceId)
      .attach('file', Buffer.from(csv), 'orders.csv')
      .expect(201);

    expect(upload.body.successfulRows).toBe(1);
    expect(['COMPLETED', 'COMPLETED_WITH_ERRORS']).toContain(upload.body.status);

    const orders = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ sourceId })
      .expect(200);
    expect(orders.body.total).toBe(1);

    const orderId = orders.body.items[0].id;
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .expect(200);
    expect(detail.body.orderNumber).toContain('E2E-');

    const trace = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}/trace`)
      .expect(200);
    expect(Array.isArray(trace.body)).toBe(true);
  });

  it('GET /api/v1/dashboard/summary returns counts', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/dashboard/summary').expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(0);
    expect(res.body.byClassification).toBeDefined();
  });

  it('rejects invalid payloads (validation pipe)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sources')
      .send({ name: '', type: 'NOT_A_TYPE' })
      .expect(400);
  });
});

if (!hasDb) {
  // eslint-disable-next-line no-console
  console.warn('DATABASE_URL not set — skipping e2e suite');
  it('e2e suite skipped without DATABASE_URL', () => expect(true).toBe(true));
}
