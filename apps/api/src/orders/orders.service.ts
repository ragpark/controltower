import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, Classification, EVENTS } from '@control-tower/shared-types';
import { Prisma } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationService } from '../rules/classification.service';
import { BulkOrdersDto, ListOrdersQuery } from './dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly classification: ClassificationService,
    private readonly events: EventEmitter2,
  ) {}

  private buildWhere(query: ListOrdersQuery): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    if (query.classification) where.classification = query.classification;
    if (query.sourceId) where.sourceId = query.sourceId;
    if (query.customerName)
      where.customerName = { contains: query.customerName, mode: 'insensitive' };
    if (query.productCode)
      where.productCode = { contains: query.productCode, mode: 'insensitive' };
    if (query.orderState) where.orderState = { contains: query.orderState, mode: 'insensitive' };
    if (query.orderSource) where.orderSource = query.orderSource;
    if (query.licenceOrderMatch) where.licenceOrderMatch = query.licenceOrderMatch;
    if (query.licenceIsbnMatch) where.licenceIsbnMatch = query.licenceIsbnMatch;
    if (query.dateFrom || query.dateTo) {
      where.orderDate = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerEmail: { contains: query.search, mode: 'insensitive' } },
        { customerId: { contains: query.search, mode: 'insensitive' } },
        { productCode: { contains: query.search, mode: 'insensitive' } },
        { productName: { contains: query.search, mode: 'insensitive' } },
        { sourceOrderId: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async list(query: ListOrdersQuery) {
    const where = this.buildWhere(query);
    const orderBy = { [query.sortBy ?? 'importedAt']: query.sortDir ?? 'desc' };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { source: { select: { name: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: items.map(({ source, ...order }) => ({
        ...order,
        sourceName: source?.name ?? null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async exportCsv(query: ListOrdersQuery, actor: string): Promise<string> {
    const where = this.buildWhere(query);
    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { [query.sortBy ?? 'importedAt']: query.sortDir ?? 'desc' },
      take: 50_000,
      include: { source: { select: { name: true } } },
    });
    await this.audit.record({
      entityType: 'order',
      entityId: 'export',
      action: AuditAction.EXPORT,
      changedBy: actor,
      changes: { count: orders.length, filters: query as unknown as Record<string, unknown> },
    });
    return stringify(
      orders.map((o) => ({
        'Order Number': o.orderNumber,
        'Order Source': o.orderSource,
        'Product Code': o.productCode,
        'Product Name': o.productName,
        'Account Number': o.customerId,
        'Customer Name': o.customerName,
        Email: o.customerEmail,
        'Order Status': o.orderStatus,
        'Custom Status': o.orderState,
        'Licence Order Match': o.licenceOrderMatch,
        'Licence ISBN Match': o.licenceIsbnMatch,
        Classification: o.classification,
        'Classification Reason': o.classificationReason,
        Quantity: o.quantity,
        Value: o.value?.toString() ?? '',
        'Order Date': o.orderDate?.toISOString() ?? '',
        'Imported At': o.importedAt.toISOString(),
        Source: o.source?.name ?? '',
        'Source File': o.sourceFile ?? '',
      })),
      { header: true },
    );
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, name: true, type: true } },
        importRun: {
          select: { id: true, filename: true, startTime: true, status: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Latest evaluation trace, grouped by evaluationId. */
  async trace(id: string) {
    await this.get(id);
    const latest = await this.prisma.ruleExecution.findFirst({
      where: { orderId: id },
      orderBy: { evaluatedAt: 'desc' },
      select: { evaluationId: true },
    });
    if (!latest) return [];
    return this.prisma.ruleExecution.findMany({
      where: { orderId: id, evaluationId: latest.evaluationId },
      orderBy: { priority: 'asc' },
    });
  }

  async history(id: string) {
    await this.get(id);
    return this.prisma.orderHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Orders sharing the order number (other lines) or the same customer. */
  async related(id: string) {
    const order = await this.get(id);
    return this.prisma.order.findMany({
      where: {
        id: { not: id },
        OR: [
          { orderNumber: order.orderNumber },
          ...(order.customerId ? [{ customerId: order.customerId }] : []),
        ],
      },
      orderBy: { importedAt: 'desc' },
      take: 20,
    });
  }

  auditTrail(id: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType: 'order', entityId: id },
      orderBy: { timestamp: 'desc' },
    });
  }

  async bulk(dto: BulkOrdersDto, actor: string) {
    if (dto.action === 'rerun-rules') {
      const count = await this.classification.reapply(dto.ids, actor);
      return { affected: count };
    }

    // manual reclassification
    if (!dto.classification) {
      throw new BadRequestException('classification is required for reclassify');
    }
    const orders = await this.prisma.order.findMany({ where: { id: { in: dto.ids } } });
    if (orders.length === 0) throw new NotFoundException('No matching orders');

    const reason = `Manually reclassified by ${actor}${dto.reason ? `: ${dto.reason}` : ''}`;
    await this.prisma.order.updateMany({
      where: { id: { in: dto.ids } },
      data: {
        classification: dto.classification,
        classificationReason: reason,
        classifiedAt: new Date(),
      },
    });
    for (const order of orders) {
      this.events.emit(EVENTS.ORDER_RECLASSIFIED, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        productCode: order.productCode,
        classification: dto.classification,
        previousClassification: (order.classification as Classification | null) ?? null,
        ruleName: null,
        evaluationId: 'manual',
        actor,
      });
    }
    await this.audit.record({
      entityType: 'order',
      entityId: 'bulk',
      action: AuditAction.BULK_UPDATE,
      changedBy: actor,
      changes: { ids: dto.ids, classification: dto.classification, reason: dto.reason },
    });
    return { affected: orders.length };
  }
}
