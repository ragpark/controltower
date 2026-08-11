/* eslint-disable no-console */
import { PrismaClient, Classification, SourceType } from '@prisma/client';

const prisma = new PrismaClient();

/** Mirrors the ActiveHub orders export headers. */
const DEFAULT_MAPPING = {
  orderSource: 'order_source',
  orderNumber: 'order_id',
  orderState: 'Custom Status',
  orderStatus: 'order_status',
  orderDate: 'order_created_date_time',
  customerName: 'full_name',
  customerEmail: 'email',
  customerId: 'TEPAccountNumber',
  productCode: 'productcode',
  productName: 'productlongname',
  licenceOrderMatch: 'LicenceManagerOrderMatch',
  licenceIsbnMatch: 'LicenceManagerISBNMatch',
};

async function seedRules() {
  const rules = [
    {
      name: 'Cancelled orders',
      description: 'Order cancelled, refunded or declined',
      priority: 10,
      strategy: 'field-match',
      ruleDefinition: {
        match: 'any',
        conditions: [
          {
            field: 'orderStatus',
            operator: 'in',
            value: ['Cancelled', 'Canceled', 'Refunded', 'Declined', 'Void'],
          },
          { field: 'orderState', operator: 'contains', value: 'cancel' },
        ],
      },
      outcome: Classification.CANCELLED,
    },
    {
      name: 'Paid but no licence provisioned',
      description:
        'Order completed in the store but Licence Manager has no matching order — ' +
        'the customer has paid and cannot access the product',
      priority: 20,
      strategy: 'field-match',
      ruleDefinition: {
        conditions: [
          { field: 'orderStatus', operator: 'in', value: ['Complete', 'Completed', 'Shipped'] },
          { field: 'licenceOrderMatch', operator: 'eq', value: 'Not Match' },
        ],
      },
      outcome: Classification.CUSTOMER_IMPACTED,
    },
    {
      name: 'Wrong product licensed',
      description:
        'Licence Manager matched the order but not the ISBN — the customer may have ' +
        'access to the wrong product',
      priority: 30,
      strategy: 'field-match',
      ruleDefinition: {
        conditions: [
          { field: 'licenceOrderMatch', operator: 'eq', value: 'Match' },
          { field: 'licenceIsbnMatch', operator: 'eq', value: 'Not Match' },
        ],
      },
      outcome: Classification.INVESTIGATE_REQUIRED,
    },
    {
      name: 'Data quality exception',
      description: 'Orders with no identifiable customer cannot be reconciled',
      priority: 40,
      strategy: 'field-match',
      ruleDefinition: {
        conditions: [
          { field: 'customerName', operator: 'isEmpty' },
          { field: 'customerEmail', operator: 'isEmpty' },
        ],
      },
      outcome: Classification.EXCEPTION,
    },
    {
      name: 'Completed and fully reconciled',
      description: 'Store order complete and Licence Manager matches on both order and ISBN',
      priority: 50,
      strategy: 'field-match',
      ruleDefinition: {
        conditions: [
          { field: 'orderStatus', operator: 'in', value: ['Complete', 'Completed'] },
          { field: 'licenceOrderMatch', operator: 'eq', value: 'Match' },
        ],
      },
      outcome: Classification.COMPLETED,
    },
    {
      name: 'Stale incomplete order',
      description: 'Still incomplete more than 7 days after it was created',
      priority: 60,
      strategy: 'order-age',
      ruleDefinition: {
        olderThanDays: 7,
        dateField: 'orderDate',
        whenStatusIn: ['Incomplete', 'Pending', 'Awaiting Payment'],
      },
      outcome: Classification.INVESTIGATE_REQUIRED,
    },
    {
      name: 'In fulfilment',
      description: 'Payment taken and the order is progressing',
      priority: 70,
      strategy: 'field-match',
      ruleDefinition: {
        match: 'any',
        conditions: [
          {
            field: 'orderStatus',
            operator: 'in',
            value: ['Awaiting Fulfillment', 'Awaiting Shipment', 'Processing', 'Shipped', 'Dispatched'],
          },
        ],
      },
      outcome: Classification.PLACED,
    },
    {
      name: 'Pending orders',
      description: 'Incomplete baskets and orders awaiting payment',
      priority: 80,
      strategy: 'field-match',
      ruleDefinition: {
        match: 'any',
        conditions: [
          {
            field: 'orderStatus',
            operator: 'in',
            value: ['Incomplete', 'Pending', 'Awaiting Payment', 'Draft'],
          },
          { field: 'orderState', operator: 'contains', value: 'pending' },
        ],
      },
      outcome: Classification.PENDING,
    },
    {
      name: 'Catch-all — investigate',
      description: 'Anything unrecognised needs a human eye',
      priority: 1000,
      strategy: 'always',
      ruleDefinition: {},
      outcome: Classification.INVESTIGATE_REQUIRED,
    },
  ];

  for (const rule of rules) {
    await prisma.classificationRule.upsert({
      where: { name: rule.name },
      create: rule,
      update: {
        description: rule.description,
        priority: rule.priority,
        strategy: rule.strategy,
        ruleDefinition: rule.ruleDefinition,
        outcome: rule.outcome,
      },
    });
  }
  console.log(`Seeded ${rules.length} classification rules`);
}

async function seedSources() {
  await prisma.source.upsert({
    where: { name: 'ActiveHub manual upload' },
    create: {
      name: 'ActiveHub manual upload',
      type: SourceType.CSV_UPLOAD,
      enabled: true,
      configJson: { mapping: DEFAULT_MAPPING, delimiter: ',' },
    },
    update: { configJson: { mapping: DEFAULT_MAPPING, delimiter: ',' } },
  });
  await prisma.source.upsert({
    where: { name: 'ActiveHub scheduled export' },
    create: {
      name: 'ActiveHub scheduled export',
      type: SourceType.CSV_FILE,
      enabled: true,
      schedule: '*/15 * * * *',
      configJson: {
        connector: { directory: '.', pattern: 'activehub' },
        mapping: DEFAULT_MAPPING,
        delimiter: ',',
      },
    },
    update: {},
  });
  console.log('Seeded default sources');
}

/**
 * Sources created before the ActiveHub alignment (and any created from the old
 * "Add source" template) carry a mapping built for the placeholder headers
 * "Order Number" / "Product Code". Applied to a real ActiveHub export that
 * mapping matches nothing, so every row fails validation. Repoint them at the
 * ActiveHub headers rather than leaving broken sources behind.
 */
async function migrateLegacyMappings() {
  const sources = await prisma.source.findMany();
  let migrated = 0;

  for (const source of sources) {
    const config = (source.configJson ?? {}) as {
      mapping?: Record<string, string>;
      [key: string]: unknown;
    };
    const mapping = config.mapping;
    const isLegacy =
      mapping?.orderNumber === 'Order Number' || mapping?.productCode === 'Product Code';
    if (!isLegacy) continue;

    await prisma.source.update({
      where: { id: source.id },
      data: { configJson: { ...config, mapping: DEFAULT_MAPPING } },
    });
    migrated += 1;
    console.log(`Migrated legacy column mapping on source "${source.name}"`);
  }

  if (migrated > 0) {
    console.log(`Migrated ${migrated} source(s) to the ActiveHub column mapping`);
  }
}

async function main() {
  await seedRules();
  await seedSources();
  await migrateLegacyMappings();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
