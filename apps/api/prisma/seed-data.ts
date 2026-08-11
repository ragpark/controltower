import { Classification, Prisma } from '@prisma/client';

/** Mirrors the ActiveHub orders export headers. */
export const DEFAULT_MAPPING = {
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

export interface SeedRule {
  name: string;
  description: string;
  priority: number;
  strategy: string;
  ruleDefinition: Prisma.InputJsonObject;
  outcome: Classification;
}

/**
 * The canonical rule set. Evaluated in ascending priority; first match wins.
 * The Licence Manager flags carry the operational meaning: a store order that
 * completed but has no matching licence means the customer has paid and cannot
 * access the product.
 */
export const CLASSIFICATION_RULES: SeedRule[] = [
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
    name: 'Provisioning failed downstream',
    description:
      'The fulfilment system reported a provisioning failure for this order — the ' +
      'customer cannot access the product and a named team owns the next step',
    priority: 15,
    strategy: 'field-match',
    ruleDefinition: {
      conditions: [{ field: 'provisioningCategory', operator: 'notEmpty' }],
    },
    outcome: Classification.CUSTOMER_IMPACTED,
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
        // Both flags must be positive — an unknown or missing ISBN result is not
        // reconciled and must fall through to the catch-all for a human to check.
        { field: 'licenceIsbnMatch', operator: 'eq', value: 'Match' },
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

/**
 * Rules seeded by earlier releases that the ActiveHub rule set replaces. The
 * upsert is keyed on name, so without retiring these explicitly they survive as
 * orphans — and several share a priority with a new rule, where the engine's
 * alphabetical tie-break can let the obsolete rule win. They are disabled
 * rather than deleted so existing execution traces stay meaningful.
 */
export const SUPERSEDED_RULE_NAMES = [
  'Customer impacted — failed delivery',
  'Completed orders',
  'Stale open order',
  'Placed orders',
];

/** Sources seeded by earlier releases, replaced by the ActiveHub pair. */
export const SUPERSEDED_SOURCE_NAMES = ['Manual CSV upload', 'Warehouse file drop'];

/**
 * The exact mapping template shipped before the ActiveHub alignment (and
 * pre-filled by the old "Add source" dialog). Both fields must match: a source
 * that merely happens to use one of these common header names is a legitimate
 * custom mapping and must be left alone.
 */
export function isLegacyMapping(mapping?: Record<string, unknown>): boolean {
  return (
    mapping?.orderNumber === 'Order Number' && mapping?.productCode === 'Product Code'
  );
}
