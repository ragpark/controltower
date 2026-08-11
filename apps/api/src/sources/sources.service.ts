import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, SourceConfig, SourceType } from '@control-tower/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { OrchestratorService } from '../imports/orchestrator.service';
import { SourceSchedulerService } from '../imports/scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSourceDto, UpdateSourceDto } from './dto';

@Injectable()
export class SourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orchestrator: OrchestratorService,
    private readonly scheduler: SourceSchedulerService,
  ) {}

  async list() {
    const sources = await this.prisma.source.findMany({
      orderBy: { name: 'asc' },
      include: {
        importRuns: {
          orderBy: { startTime: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            startTime: true,
            successfulRows: true,
            failedRows: true,
          },
        },
      },
    });
    return sources.map(({ importRuns, ...source }) => ({
      ...source,
      lastRun: importRuns[0] ?? null,
    }));
  }

  async get(id: string) {
    const source = await this.prisma.source.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Source not found');
    return source;
  }

  async create(dto: CreateSourceDto, actor: string) {
    const source = await this.prisma.source.create({
      data: {
        name: dto.name,
        type: dto.type,
        enabled: dto.enabled ?? true,
        schedule: dto.schedule ?? null,
        configJson: (dto.configJson ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.scheduler.syncSource(source.id);
    await this.audit.record({
      entityType: 'source',
      entityId: source.id,
      action: AuditAction.CREATE,
      changedBy: actor,
      changes: { name: source.name, type: source.type },
    });
    return source;
  }

  async update(id: string, dto: UpdateSourceDto, actor: string) {
    await this.get(id);
    const source = await this.prisma.source.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.enabled !== undefined
          ? { enabled: dto.enabled, status: dto.enabled ? 'ACTIVE' : 'DISABLED' }
          : {}),
        ...(dto.schedule !== undefined ? { schedule: dto.schedule } : {}),
        ...(dto.configJson !== undefined
          ? { configJson: dto.configJson as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.scheduler.syncSource(id);
    await this.audit.record({
      entityType: 'source',
      entityId: id,
      action: AuditAction.UPDATE,
      changedBy: actor,
      changes: dto as unknown as Record<string, unknown>,
    });
    return source;
  }

  async remove(id: string, actor: string) {
    const source = await this.get(id);
    const orderCount = await this.prisma.order.count({ where: { sourceId: id } });
    if (orderCount > 0) {
      throw new ConflictException(
        `Source has ${orderCount} imported orders — disable it instead of deleting`,
      );
    }
    await this.prisma.source.delete({ where: { id } });
    await this.scheduler.syncSource(id);
    await this.audit.record({
      entityType: 'source',
      entityId: id,
      action: AuditAction.DELETE,
      changedBy: actor,
      changes: { name: source.name },
    });
    return { deleted: true };
  }

  async testConnection(id: string) {
    const source = await this.get(id);
    const connector = this.orchestrator.connectors.get(source.type as SourceType);
    return connector.test(source.configJson as SourceConfig);
  }

  types() {
    return this.orchestrator.connectors.listTypes();
  }
}
