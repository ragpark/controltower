import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Classification } from '@control-tower/shared-types';
import { ClassificationService } from './classification.service';
import { RulesService } from './rules.service';

const prismaMock = {
  classificationRule: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as never;

const auditMock = { record: jest.fn() } as never;
const metricsMock = { ordersClassified: { inc: jest.fn() } } as never;

describe('RulesService', () => {
  let service: RulesService;
  let classification: ClassificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    classification = new ClassificationService(prismaMock, new EventEmitter2(), metricsMock);
    service = new RulesService(prismaMock, auditMock, classification);
  });

  describe('create', () => {
    const dto = {
      name: 'Test rule',
      priority: 10,
      strategy: 'field-match',
      ruleDefinition: { conditions: [{ field: 'orderStatus', operator: 'eq', value: 'X' }] },
      outcome: Classification.PENDING,
    };

    it('validates the definition against the strategy and persists', async () => {
      (prismaMock as any).classificationRule.create.mockResolvedValue({ id: 'r1', ...dto });
      const rule = await service.create(dto as never, 'tester');
      expect(rule.id).toBe('r1');
      expect((auditMock as any).record).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'classification_rule', action: 'CREATE' }),
      );
    });

    it('rejects unknown strategies', async () => {
      await expect(
        service.create({ ...dto, strategy: 'nope' } as never, 'tester'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid definitions with the strategy message', async () => {
      await expect(
        service.create({ ...dto, ruleDefinition: { conditions: [] } } as never, 'tester'),
      ).rejects.toThrow(/non-empty/);
    });
  });

  describe('update', () => {
    it('404s for missing rules', async () => {
      (prismaMock as any).classificationRule.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', {}, 'tester')).rejects.toThrow(NotFoundException);
    });

    it('re-validates when the definition changes', async () => {
      (prismaMock as any).classificationRule.findUnique.mockResolvedValue({
        id: 'r1',
        strategy: 'field-match',
        ruleDefinition: { conditions: [{ field: 'a', operator: 'notEmpty' }] },
      });
      await expect(
        service.update('r1', { ruleDefinition: { conditions: [] } } as never, 'tester'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('preview', () => {
    it('evaluates a candidate rule against a sample order', () => {
      const result = service.preview({
        strategy: 'field-match',
        ruleDefinition: {
          conditions: [{ field: 'orderStatus', operator: 'eq', value: 'Cancelled' }],
        },
        outcome: Classification.CANCELLED,
        sampleOrder: { orderStatus: 'Cancelled' },
      } as never);
      expect(result.matched).toBe(true);
      expect(result.outcome).toBe(Classification.CANCELLED);
    });

    it('returns null outcome when unmatched', () => {
      const result = service.preview({
        strategy: 'field-match',
        ruleDefinition: {
          conditions: [{ field: 'orderStatus', operator: 'eq', value: 'Cancelled' }],
        },
        outcome: Classification.CANCELLED,
        sampleOrder: { orderStatus: 'Placed' },
      } as never);
      expect(result.matched).toBe(false);
      expect(result.outcome).toBeNull();
    });
  });

  it('lists the registered strategies', () => {
    expect(service.strategies().sort()).toEqual(['always', 'field-match', 'order-age']);
  });
});
