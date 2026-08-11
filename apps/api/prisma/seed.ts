/* eslint-disable no-console */
import { PrismaClient, Classification, SourceType } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_MAPPING = {
  sourceOrderId: 'Source Order Id',
  orderNumber: 'Order Number',
  customerId: 'Customer Id',
  customerName: 'Customer Name',
  productCode: 'Product Code',
  productName: 'Product Name',
  orderStatus: 'Order Status',
  orderState: 'Order State',
  quantity: 'Quantity',
  value: 'Value',
  orderDate: 'Order Date',
};

async function seedRules() {
  const rules = [
    {
      name: 'Cancelled orders',
      description: 'Raw status indicates cancellation',
      priority: 10,
      strategy: 'field-match',
      ruleDefinition: {
        match: 'any',
        conditions: [
          { field: 'orderStatus', operator: 'in', value: ['Cancelled', 'Canceled', 'Void'] },
          { field: 'orderState', operator: 'contains', value: 'cancel' },
        ],
      },
      outcome: Classification.CANCELLED,
    },
    {
      name: 'Customer impacted — failed delivery',
      description: 'Delivery failures and returns impact the customer',
      priority: 20,
      strategy: 'field-match',
      ruleDefinition: {
        match: 'any',
        conditions: [
          { field: 'orderStatus', operator: 'in', value: ['Delivery Failed', 'Returned', 'On Hold - Customer'] },
          { field: 'orderState', operator: 'contains', value: 'impact' },
        ],
      },
      outcome: Classification.CUSTOMER_IMPACTED,
    },
    {
      name: 'Completed orders',
      description: 'Delivered / fulfilled orders',
      priority: 30,
      strategy: 'field-match',
      ruleDefinition: {
        match: 'any',
        conditions: [
          { field: 'orderStatus', operator: 'in', value: ['Delivered', 'Completed', 'Fulfilled', 'Closed'] },
        ],
      },
      outcome: Classification.COMPLETED,
    },
    {
      name: 'Data quality exception',
      description: 'Orders missing a customer cannot be processed',
      priority: 40,
      strategy: 'field-match',
      ruleDefinition: {
        conditions: [{ field: 'customerName', operator: 'isEmpty' }],
      },
      outcome: Classification.EXCEPTION,
    },
    {
      name: 'Stale open order',
      description: 'Placed over 21 days ago and still not completed',
      priority: 50,
      strategy: 'order-age',
      ruleDefinition: {
        olderThanDays: 21,
        dateField: 'orderDate',
        whenStatusIn: ['Placed', 'Processing', 'Picked', 'Shipped'],
      },
      outcome: Classification.INVESTIGATE_REQUIRED,
    },
    {
      name: 'Placed orders',
      description: 'Order accepted and in fulfilment',
      priority: 60,
      strategy: 'field-match',
      ruleDefinition: {
        match: 'any',
        conditions: [
          { field: 'orderStatus', operator: 'in', value: ['Placed', 'Processing', 'Picked', 'Shipped'] },
        ],
      },
      outcome: Classification.PLACED,
    },
    {
      name: 'Pending orders',
      description: 'Awaiting confirmation or payment',
      priority: 70,
      strategy: 'field-match',
      ruleDefinition: {
        match: 'any',
        conditions: [
          { field: 'orderStatus', operator: 'in', value: ['Pending', 'Awaiting Payment', 'Draft', 'New'] },
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
    where: { name: 'Manual CSV upload' },
    create: {
      name: 'Manual CSV upload',
      type: SourceType.CSV_UPLOAD,
      enabled: true,
      configJson: { mapping: DEFAULT_MAPPING, delimiter: ',' },
    },
    update: {},
  });
  await prisma.source.upsert({
    where: { name: 'Warehouse file drop' },
    create: {
      name: 'Warehouse file drop',
      type: SourceType.CSV_FILE,
      enabled: true,
      schedule: '*/15 * * * *',
      configJson: {
        connector: { directory: '.', pattern: 'orders' },
        mapping: DEFAULT_MAPPING,
        delimiter: ',',
      },
    },
    update: {},
  });
  console.log('Seeded default sources');
}

async function main() {
  await seedRules();
  await seedSources();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
