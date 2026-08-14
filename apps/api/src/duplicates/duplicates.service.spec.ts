import { ConflictException, NotFoundException } from '@nestjs/common';
import { DuplicatesService } from './duplicates.service';

const d = (iso: string) => new Date(iso);

const order = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'id-1',
  orderNumber: 'ORD-1',
  productCode: '9780141036144',
  productName: 'A Book',
  orderStatus: 'Complete',
  classification: 'COMPLETED',
  importedAt: d('2026-08-10T00:00:00Z'),
  createdAt: d('2026-08-10T00:00:00Z'),
  updatedAt: d('2026-08-10T00:00:00Z'),
  sourceFile: 'monday.csv',
  sourceId: 'src-1',
  importRunId: 'run-1',
  ...over,
});

function build(rows: ReturnType<typeof order>[]) {
  const tx = {
    orderHistory: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ruleExecution: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    order: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(rows.filter((r) => where.id.in.includes(r.id)));
        // Revalidation read: case-insensitive match on the group's key.
        const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
        return Promise.resolve(
          rows.filter(
            (r) =>
              eq(r.orderNumber, where.orderNumber.equals) &&
              eq(r.productCode, where.productCode.equals),
          ),
        );
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    order: { findMany: jest.fn().mockResolvedValue(rows) },
    $transaction: jest
      .fn()
      .mockImplementation((fn: (t: typeof tx) => unknown, _opts?: unknown) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const failures = {
    syncAndReclassify: jest
      .fn()
      .mockResolvedValue({ linkedOrders: 1, unmatchedOrderNumbers: [], reclassified: 1 }),
  };
  const service = new DuplicatesService(
    prisma as never,
    audit as never,
    failures as never,
  );
  return { service, prisma, tx, audit, failures };
}

const caseVariants = [
  order({ id: 'old', orderNumber: 'ORD-1', importedAt: d('2026-08-10T00:00:00Z'), sourceFile: 'mon.csv' }),
  order({ id: 'new', orderNumber: 'ord-1', importedAt: d('2026-08-11T00:00:00Z'), sourceFile: 'tue.csv' }),
];

describe('DuplicatesService.report', () => {
  it('groups case-only variants and marks the newest import as survivor', async () => {
    const { service } = build(caseVariants);
    const report = await service.report();

    expect(report.groupCount).toBe(1);
    expect(report.removableCount).toBe(1);
    const [group] = report.groups;
    expect(group.variantCount).toBe(2);
    expect(group.variants.find((v) => v.survivor)?.id).toBe('new');
    // Provenance is what lets an operator see which import introduced which row.
    expect(group.variants.map((v) => v.sourceFile).sort()).toEqual(['mon.csv', 'tue.csv']);
  });

  it('writes nothing', async () => {
    const { service, prisma, audit } = build(caseVariants);
    await service.report();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('reports nothing for a multi-line order', async () => {
    const { service } = build([
      order({ id: 'a', productCode: 'ISBN-1' }),
      order({ id: 'b', productCode: 'ISBN-2' }),
    ]);

    const report = await service.report();
    expect(report.groupCount).toBe(0);
    expect(report.removableCount).toBe(0);
  });
});

describe('DuplicatesService.exportCsv', () => {
  it('carries no customer name or email', async () => {
    const { service } = build(caseVariants);
    const csv = await service.exportCsv();

    expect(csv).not.toMatch(/customer_name|customer_email/i);
    // The query never selects them, so they cannot be present to leak.
    expect(csv.split('\n')[0]).toBe(
      'group_key,order_number,product_code,disposition,classification,order_status,imported_at,source_file,import_run_id,order_id',
    );
  });

  it('marks which row is kept and which is removed, with provenance', async () => {
    const { service } = build(caseVariants);
    const [, ...rows] = (await service.exportCsv()).split('\n');

    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.includes(',keep,'))).toHaveLength(1);
    expect(rows.filter((r) => r.includes(',remove,'))).toHaveLength(1);
    expect(rows.join('\n')).toContain('run-1');
  });

  it('quotes a value containing a comma', async () => {
    const { service } = build([
      order({ id: 'a', orderNumber: 'ORD-1', sourceFile: 'monday, final.csv' }),
      order({ id: 'b', orderNumber: 'ord-1', importedAt: d('2026-08-11T00:00:00Z') }),
    ]);
    expect(await service.exportCsv()).toContain('"monday, final.csv"');
  });
});

describe('DuplicatesService.resolve', () => {
  const key = 'ord-1::9780141036144';

  it('removes the older row and keeps the most recent import', async () => {
    const { service, tx } = build(caseVariants);
    const result = await service.resolve([key], 'alex');

    expect(tx.order.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['old'] } } });
    expect(result.groupsResolved).toBe(1);
    expect(result.ordersRemoved).toBe(1);
  });

  it('re-points history and rule executions to the survivor before deleting', async () => {
    const { service, tx } = build(caseVariants);
    await service.resolve([key], 'alex');

    expect(tx.orderHistory.updateMany).toHaveBeenCalledWith({
      where: { orderId: { in: ['old'] } },
      data: { orderId: 'new' },
    });
    expect(tx.ruleExecution.updateMany).toHaveBeenCalledWith({
      where: { orderId: { in: ['old'] } },
      data: { orderId: 'new' },
    });
    // Both cascade on delete, so re-pointing has to happen first or the trail is lost.
    const historyCall = tx.orderHistory.updateMany.mock.invocationCallOrder[0];
    const deleteCall = tx.order.deleteMany.mock.invocationCallOrder[0];
    expect(historyCall).toBeLessThan(deleteCall);
  });

  it('snapshots the removed row into the survivor history before deleting it', async () => {
    const { service, tx } = build(caseVariants);
    await service.resolve([key], 'alex');

    const [{ data }] = tx.orderHistory.createMany.mock.calls[0];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      orderId: 'new',
      changedFields: ['__superseded_duplicate__'],
    });
    expect(data[0].snapshot).toMatchObject({ id: 'old' });
    expect(
      tx.orderHistory.createMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.order.deleteMany.mock.invocationCallOrder[0]);
  });

  it('writes an audit record naming the survivor and every removed row', async () => {
    const { service, audit } = build(caseVariants);
    await service.resolve([key], 'alex');

    expect(audit.record).toHaveBeenCalledTimes(1);
    const entry = audit.record.mock.calls[0][0];
    expect(entry).toMatchObject({
      entityType: 'order',
      entityId: 'new',
      action: 'DELETE',
      changedBy: 'alex',
    });
    expect(entry.changes).toMatchObject({ operation: 'duplicate_resolution', survivorId: 'new' });
    expect(entry.changes.removed).toEqual([
      expect.objectContaining({ id: 'old', orderNumber: 'ORD-1' }),
    ]);
  });

  it('recomputes the survivor rather than trusting a stale caller', async () => {
    // Caller names the group; the service still decides which row lives.
    const { service, tx } = build([
      order({ id: 'old', orderNumber: 'ORD-1', importedAt: d('2026-08-01T00:00:00Z') }),
      order({ id: 'newest', orderNumber: 'ord-1', importedAt: d('2026-08-14T00:00:00Z') }),
    ]);
    await service.resolve([key], 'alex');

    expect(tx.order.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['old'] } } });
  });

  it('rejects an unknown key with an actionable message instead of silently doing nothing', async () => {
    const { service, tx } = build(caseVariants);

    await expect(service.resolve(['no-such::key'], 'alex')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.resolve(['no-such::key'], 'alex')).rejects.toThrow(/stale/i);
    expect(tx.order.deleteMany).not.toHaveBeenCalled();
  });

  it('resyncs provisioning summaries, since they are keyed on order number', async () => {
    const { service, failures } = build(caseVariants);
    const result = await service.resolve([key], 'alex');

    expect(failures.syncAndReclassify).toHaveBeenCalledWith(undefined, 'alex');
    expect(result.ordersResynced).toBe(1);
  });

  it('runs the delete at serializable isolation', async () => {
    const { service, prisma } = build(caseVariants);
    await service.resolve([key], 'alex');

    const [, options] = prisma.$transaction.mock.calls[0];
    expect(options).toMatchObject({ isolationLevel: 'Serializable' });
  });

  it('aborts the group if an import changes the survivor mid-flight', async () => {
    const { service, tx } = build(caseVariants);

    // A concurrent import re-imports the older row, making it the freshest
    // between the planning read and the transaction.
    tx.order.findMany.mockImplementationOnce(() =>
      Promise.resolve([
        order({ id: 'old', orderNumber: 'ORD-1', importedAt: d('2026-08-20T00:00:00Z') }),
        order({ id: 'new', orderNumber: 'ord-1', importedAt: d('2026-08-11T00:00:00Z') }),
      ]),
    );

    await expect(service.resolve([key], 'alex')).rejects.toBeInstanceOf(ConflictException);
    // The row we promised to keep must never be the row we delete.
    expect(tx.order.deleteMany).not.toHaveBeenCalled();
  });

  it('aborts if a new variant appears in the group mid-flight', async () => {
    const { service, tx } = build(caseVariants);
    tx.order.findMany.mockImplementationOnce(() =>
      Promise.resolve([
        ...caseVariants,
        order({ id: 'third', orderNumber: 'Ord-1', importedAt: d('2026-08-09T00:00:00Z') }),
      ]),
    );

    await expect(service.resolve([key], 'alex')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.deleteMany).not.toHaveBeenCalled();
  });

  it('resolves only the groups named, leaving others untouched', async () => {
    const { service, tx } = build([
      ...caseVariants,
      order({ id: 'x1', orderNumber: 'ORD-2', productCode: 'ISBN-2', importedAt: d('2026-08-10T00:00:00Z') }),
      order({ id: 'x2', orderNumber: 'ord-2', productCode: 'ISBN-2', importedAt: d('2026-08-11T00:00:00Z') }),
    ]);

    const result = await service.resolve([key], 'alex');
    expect(result.groupsResolved).toBe(1);
    expect(tx.order.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.order.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['old'] } } });
  });
});
