import { EventEmitter2 } from '@nestjs/event-emitter';
import { Classification, EVENTS } from '@control-tower/shared-types';
import { ClassificationService } from './classification.service';

describe('ClassificationService', () => {
  const prisma = {
    classificationRule: { findMany: jest.fn() },
    ruleExecution: { createMany: jest.fn() },
    order: { update: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const metrics = { ordersClassified: { inc: jest.fn() } };
  let events: EventEmitter2;
  let service: ClassificationService;

  const order = {
    id: 'o1',
    orderNumber: 'ORD-1',
    productCode: 'P-1',
    orderStatus: 'Cancelled',
    classification: null,
    value: null,
  } as never;

  const rules = [
    {
      id: 'r1',
      name: 'Cancelled',
      priority: 10,
      enabled: true,
      strategy: 'field-match',
      ruleDefinition: {
        conditions: [{ field: 'orderStatus', operator: 'eq', value: 'Cancelled' }],
      },
      outcome: Classification.CANCELLED,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    events = new EventEmitter2();
    service = new ClassificationService(prisma as never, events, metrics as never);
  });

  it('classifies, persists the trace and emits OrderClassified for first classification', async () => {
    const emitted: unknown[] = [];
    events.on(EVENTS.ORDER_CLASSIFIED, (e) => emitted.push(e));

    const result = await service.classifyOrder(order, rules as never, 'tester');

    expect(result.classification).toBe(Classification.CANCELLED);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(metrics.ordersClassified.inc).toHaveBeenCalledWith({
      classification: Classification.CANCELLED,
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      orderId: 'o1',
      classification: Classification.CANCELLED,
      previousClassification: null,
      ruleName: 'Cancelled',
    });
  });

  it('emits OrderReclassified when the outcome changes', async () => {
    const reclassified: unknown[] = [];
    events.on(EVENTS.ORDER_RECLASSIFIED, (e) => reclassified.push(e));

    await service.classifyOrder(
      { ...(order as object), classification: Classification.PENDING } as never,
      rules as never,
      'tester',
    );
    expect(reclassified).toHaveLength(1);
  });

  it('emits nothing when the classification is unchanged', async () => {
    const any: unknown[] = [];
    events.onAny((_e, payload) => any.push(payload));
    await service.classifyOrder(
      { ...(order as object), classification: Classification.CANCELLED } as never,
      rules as never,
      'tester',
    );
    expect(any).toHaveLength(0);
  });

  it('loadRules maps database rows to engine rules', async () => {
    prisma.classificationRule.findMany.mockResolvedValue([
      {
        id: 'r1',
        name: 'x',
        priority: 1,
        enabled: true,
        strategy: 'always',
        ruleDefinition: {},
        outcome: 'COMPLETED',
      },
    ]);
    const loaded = await service.loadRules();
    expect(loaded).toEqual([
      expect.objectContaining({ id: 'r1', strategy: 'always', outcome: 'COMPLETED' }),
    ]);
  });

  it('toEvaluable converts Decimal values to numbers', () => {
    const evaluable = service.toEvaluable({ ...(order as object), value: { toString: () => '12.5' } } as never);
    expect(evaluable.value).toBe(12.5);
  });
});
