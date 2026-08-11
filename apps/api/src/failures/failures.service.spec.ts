import { FailureCategory } from '@control-tower/shared-types';
import { FailuresService } from './failures.service';

const NOW = new Date('2026-08-11T12:00:00Z');
const EARLIER = new Date('2026-08-10T12:00:00Z');
const LATER = new Date('2026-08-11T18:00:00Z');

function buildService(overrides: {
  openFailures?: Array<{ id: string; orderNumber: string; lastSeenAt: Date }>;
  orders?: Array<{ orderNumber: string; licenceOrderMatch: string | null; importedAt: Date }>;
}) {
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    provisioningFailure: {
      findMany: jest.fn().mockResolvedValue(overrides.openFailures ?? []),
      updateMany,
    },
    order: {
      findMany: jest.fn().mockResolvedValue(overrides.orders ?? []),
    },
  };
  const service = new FailuresService(
    prisma as never,
    { record: jest.fn() } as never,
    { reapply: jest.fn().mockResolvedValue(0) } as never,
  );
  return { service, prisma, updateMany };
}

describe('FailuresService.autoResolveReconciled', () => {
  it('resolves when every line matched in an import newer than the failure', async () => {
    const { service, updateMany } = buildService({
      openFailures: [{ id: 'f1', orderNumber: '13925034', lastSeenAt: EARLIER }],
      orders: [
        { orderNumber: '13925034', licenceOrderMatch: 'Match', importedAt: LATER },
        { orderNumber: '13925034', licenceOrderMatch: 'Match', importedAt: LATER },
      ],
    });
    updateMany.mockResolvedValue({ count: 1 });

    expect(await service.autoResolveReconciled('tester')).toBe(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['f1'] } } }),
    );
  });

  // The report is today's truth; stale order data must not silently close it.
  it('does NOT resolve a failure reported after the last order import', async () => {
    const { service, updateMany } = buildService({
      openFailures: [{ id: 'f1', orderNumber: '13925034', lastSeenAt: NOW }],
      orders: [{ orderNumber: '13925034', licenceOrderMatch: 'Match', importedAt: EARLIER }],
    });

    expect(await service.autoResolveReconciled('tester')).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not resolve a partially reconciled order', async () => {
    const { service, updateMany } = buildService({
      openFailures: [{ id: 'f1', orderNumber: '13925034', lastSeenAt: EARLIER }],
      orders: [
        { orderNumber: '13925034', licenceOrderMatch: 'Match', importedAt: LATER },
        { orderNumber: '13925034', licenceOrderMatch: 'Not Match', importedAt: LATER },
      ],
    });

    expect(await service.autoResolveReconciled('tester')).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not resolve when no order has been imported yet', async () => {
    const { service } = buildService({
      openFailures: [{ id: 'f1', orderNumber: '99999', lastSeenAt: EARLIER }],
      orders: [],
    });
    expect(await service.autoResolveReconciled('tester')).toBe(0);
  });

  it('short-circuits when nothing is open', async () => {
    const { service, prisma } = buildService({ openFailures: [] });
    expect(await service.autoResolveReconciled('tester')).toBe(0);
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });
});

describe('FailuresService.syncOrderSummaries', () => {
  function syncService(
    openFailures: Array<Record<string, unknown>>,
    orders: Array<Record<string, unknown>>,
  ) {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      provisioningFailure: { findMany: jest.fn().mockResolvedValue(openFailures) },
      order: { findMany: jest.fn().mockResolvedValue(orders), update },
    };
    const service = new FailuresService(
      prisma as never,
      { record: jest.fn() } as never,
      { reapply: jest.fn().mockResolvedValue(0) } as never,
    );
    return { service, update };
  }

  const failure = {
    orderNumber: '13925034',
    category: FailureCategory.TEP_ACCOUNT_MISSING,
    owner: 'Customer Data',
    orderDate: EARLIER,
    firstSeenAt: EARLIER,
    lastSeenAt: EARLIER,
  };

  it('writes the summary onto every matching order line', async () => {
    const { service, update } = syncService(
      [failure],
      [
        { id: 'o1', orderNumber: '13925034', provisioningCategory: null, provisioningOwner: null, provisioningFailedAt: null },
        { id: 'o2', orderNumber: '13925034', provisioningCategory: null, provisioningOwner: null, provisioningFailedAt: null },
      ],
    );

    const result = await service.syncOrderSummaries(['13925034']);
    expect(result.linkedOrders).toBe(2);
    expect(result.changedOrderIds).toEqual(['o1', 'o2']);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0].data).toMatchObject({
      provisioningCategory: FailureCategory.TEP_ACCOUNT_MISSING,
      provisioningOwner: 'Customer Data',
    });
  });

  it('does not rewrite an order whose summary is already correct', async () => {
    const { service, update } = syncService(
      [failure],
      [
        {
          id: 'o1',
          orderNumber: '13925034',
          provisioningCategory: FailureCategory.TEP_ACCOUNT_MISSING,
          provisioningOwner: 'Customer Data',
          provisioningFailedAt: EARLIER,
        },
      ],
    );

    const result = await service.syncOrderSummaries(['13925034']);
    expect(result.changedOrderIds).toEqual([]);
    expect(update).not.toHaveBeenCalled();
  });

  it('clears the summary once the failure is resolved', async () => {
    const { service, update } = syncService(
      [], // nothing open any more
      [
        {
          id: 'o1',
          orderNumber: '13925034',
          provisioningCategory: FailureCategory.TEP_ACCOUNT_MISSING,
          provisioningOwner: 'Customer Data',
          provisioningFailedAt: EARLIER,
        },
      ],
    );

    const result = await service.syncOrderSummaries(['13925034']);
    expect(result.changedOrderIds).toEqual(['o1']);
    expect(update.mock.calls[0][0].data).toEqual({
      provisioningCategory: null,
      provisioningOwner: null,
      provisioningFailedAt: null,
    });
  });

  it('reports order numbers with no imported order yet', async () => {
    const { service } = syncService([failure], []);
    const result = await service.syncOrderSummaries(['13925034']);
    expect(result.unmatchedOrderNumbers).toEqual(['13925034']);
    expect(result.linkedOrders).toBe(0);
  });
});

describe('FailuresService.syncAndReclassify', () => {
  it('reclassifies only the orders whose provisioning state changed', async () => {
    const reapply = jest.fn().mockResolvedValue(1);
    const prisma = {
      provisioningFailure: {
        findMany: jest.fn().mockResolvedValue([
          {
            orderNumber: 'A',
            category: FailureCategory.INTEGRATION_FAULT,
            owner: 'Platform Engineering',
            orderDate: EARLIER,
            firstSeenAt: EARLIER,
            lastSeenAt: EARLIER,
          },
        ]),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'o1', orderNumber: 'A', provisioningCategory: null, provisioningOwner: null, provisioningFailedAt: null },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new FailuresService(
      prisma as never,
      { record: jest.fn() } as never,
      { reapply } as never,
    );

    const result = await service.syncAndReclassify(['A'], 'tester');
    expect(reapply).toHaveBeenCalledWith(['o1'], 'tester');
    expect(result.reclassified).toBe(1);
  });

  it('skips reclassification entirely when nothing changed', async () => {
    const reapply = jest.fn();
    const prisma = {
      provisioningFailure: { findMany: jest.fn().mockResolvedValue([]) },
      order: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    };
    const service = new FailuresService(
      prisma as never,
      { record: jest.fn() } as never,
      { reapply } as never,
    );

    expect((await service.syncAndReclassify(['A'], 'tester')).reclassified).toBe(0);
    expect(reapply).not.toHaveBeenCalled();
  });
});
