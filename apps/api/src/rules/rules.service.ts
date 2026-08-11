import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, RuleDefinition } from '@control-tower/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClassificationService } from './classification.service';
import { CreateRuleDto, RulePreviewDto, UpdateRuleDto } from './dto';

@Injectable()
export class RulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly classification: ClassificationService,
  ) {}

  list() {
    return this.prisma.classificationRule.findMany({ orderBy: { priority: 'asc' } });
  }

  private validateDefinition(strategy: string, definition: Record<string, unknown>) {
    if (!this.classification.registry.has(strategy)) {
      throw new BadRequestException(
        `Unknown strategy "${strategy}". Available: ${this.classification.registry.list().join(', ')}`,
      );
    }
    try {
      this.classification.registry.get(strategy).validate(definition as RuleDefinition);
    } catch (error) {
      throw new BadRequestException(
        `Invalid rule definition: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async create(dto: CreateRuleDto, actor: string) {
    this.validateDefinition(dto.strategy, dto.ruleDefinition);
    const rule = await this.prisma.classificationRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        priority: dto.priority,
        enabled: dto.enabled ?? true,
        strategy: dto.strategy,
        ruleDefinition: dto.ruleDefinition as Prisma.InputJsonValue,
        outcome: dto.outcome,
      },
    });
    await this.audit.record({
      entityType: 'classification_rule',
      entityId: rule.id,
      action: AuditAction.CREATE,
      changedBy: actor,
      changes: { name: rule.name, priority: rule.priority, outcome: rule.outcome },
    });
    return rule;
  }

  async update(id: string, dto: UpdateRuleDto, actor: string) {
    const existing = await this.prisma.classificationRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rule not found');

    const strategy = dto.strategy ?? existing.strategy;
    const definition = dto.ruleDefinition ?? (existing.ruleDefinition as Record<string, unknown>);
    this.validateDefinition(strategy, definition);

    const rule = await this.prisma.classificationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        strategy,
        ruleDefinition: definition as Prisma.InputJsonValue,
        ...(dto.outcome !== undefined ? { outcome: dto.outcome } : {}),
      },
    });
    await this.audit.record({
      entityType: 'classification_rule',
      entityId: id,
      action: AuditAction.UPDATE,
      changedBy: actor,
      changes: dto as unknown as Record<string, unknown>,
    });
    return rule;
  }

  async remove(id: string, actor: string) {
    const existing = await this.prisma.classificationRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rule not found');
    await this.prisma.classificationRule.delete({ where: { id } });
    await this.audit.record({
      entityType: 'classification_rule',
      entityId: id,
      action: AuditAction.DELETE,
      changedBy: actor,
      changes: { name: existing.name },
    });
    return { deleted: true };
  }

  preview(dto: RulePreviewDto) {
    this.validateDefinition(dto.strategy, dto.ruleDefinition);
    const strategy = this.classification.registry.get(dto.strategy);
    const { matched, detail } = strategy.evaluate(
      dto.ruleDefinition as RuleDefinition,
      dto.sampleOrder,
    );
    return { matched, outcome: matched ? dto.outcome : null, detail };
  }

  strategies() {
    return this.classification.registry.list();
  }
}
