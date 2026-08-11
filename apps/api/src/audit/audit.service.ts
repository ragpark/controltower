import { Injectable } from '@nestjs/common';
import { AuditAction } from '@control-tower/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    entityType: string;
    entityId: string;
    action: AuditAction | string;
    changedBy: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: String(entry.action),
        changedBy: entry.changedBy,
        changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(params: {
    entityType?: string;
    entityId?: string;
    action?: string;
    page: number;
    pageSize: number;
  }) {
    const where = {
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.action ? { action: params.action } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize };
  }
}
