import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import {
  createDefaultRegistry,
  EngineRule,
  EvaluableOrder,
  EvaluationResult,
  RuleEngine,
  StrategyRegistry,
} from '@control-tower/classification';
import { Classification, EVENTS, RuleDefinition } from '@control-tower/shared-types';
import { Order, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';

/**
 * Bridges the pure rule engine to persistence + events:
 * loads enabled rules, evaluates, stores the trace, updates the order and
 * emits OrderClassified / OrderReclassified.
 */
@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);
  readonly registry: StrategyRegistry = createDefaultRegistry();
  private readonly engine = new RuleEngine(this.registry);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly metrics: MetricsService,
  ) {}

  async loadRules(): Promise<EngineRule[]> {
    const rules = await this.prisma.classificationRule.findMany({
      where: { enabled: true },
      orderBy: { priority: 'asc' },
    });
    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      enabled: r.enabled,
      strategy: r.strategy,
      ruleDefinition: r.ruleDefinition as unknown as RuleDefinition,
      outcome: r.outcome as Classification,
    }));
  }

  toEvaluable(order: Order): EvaluableOrder {
    return {
      ...order,
      value: order.value === null ? null : Number(order.value),
    } as unknown as EvaluableOrder;
  }

  evaluate(order: EvaluableOrder, rules: EngineRule[]): EvaluationResult {
    return this.engine.evaluate(order, rules);
  }

  /**
   * Classify one order with a pre-loaded rule set (batch imports load rules
   * once). Persists the trace and returns the evaluation.
   */
  async classifyOrder(
    order: Order,
    rules: EngineRule[],
    actor: string,
  ): Promise<EvaluationResult> {
    const evaluation = this.engine.evaluate(this.toEvaluable(order), rules);
    const evaluationId = randomUUID();
    const previous = (order.classification as Classification | null) ?? null;

    await this.prisma.$transaction([
      this.prisma.ruleExecution.createMany({
        data: evaluation.trace.map((t) => ({
          orderId: order.id,
          ruleId: t.ruleId,
          ruleName: t.ruleName,
          priority: t.priority,
          matched: t.matched,
          outcome: t.outcome,
          detail: t.detail as Prisma.InputJsonValue,
          evaluationId,
        })),
      }),
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          classification: evaluation.classification,
          classificationReason: evaluation.reason,
          classifiedAt: new Date(),
        },
      }),
    ]);

    this.metrics.ordersClassified.inc({ classification: evaluation.classification });

    const payload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      productCode: order.productCode,
      classification: evaluation.classification,
      previousClassification: previous,
      ruleName: evaluation.matchedRule?.name ?? null,
      evaluationId,
      actor,
    };
    if (previous === null) {
      this.events.emit(EVENTS.ORDER_CLASSIFIED, payload);
    } else if (previous !== evaluation.classification) {
      this.events.emit(EVENTS.ORDER_RECLASSIFIED, payload);
    }
    return evaluation;
  }

  /** Re-run the engine over a set of orders (bulk action / rules changed). */
  async reapply(orderIds: string[] | null, actor: string): Promise<number> {
    const rules = await this.loadRules();
    const orders = await this.prisma.order.findMany({
      where: orderIds ? { id: { in: orderIds } } : {},
    });
    for (const order of orders) {
      await this.classifyOrder(order, rules, actor);
    }
    this.logger.log(`Re-applied rules to ${orders.length} orders (actor=${actor})`);
    return orders.length;
  }
}
