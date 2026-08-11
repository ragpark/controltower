/**
 * Downstream provisioning failures, reported daily by the fulfilment system.
 * These explain *why* an order never reached the customer, and route the fix
 * to the team that owns it.
 */
export enum FailureCategory {
  TEP_ACCOUNT_MISSING = 'TEP_ACCOUNT_MISSING',
  INVALID_CUSTOMER_DATA = 'INVALID_CUSTOMER_DATA',
  DUPLICATE_ORG_MEMBERSHIP = 'DUPLICATE_ORG_MEMBERSHIP',
  LICENCE_CONFIG_ERROR = 'LICENCE_CONFIG_ERROR',
  INTEGRATION_FAULT = 'INTEGRATION_FAULT',
  UNCATEGORISED = 'UNCATEGORISED',
}

export const FAILURE_CATEGORY_LABELS: Record<FailureCategory, string> = {
  [FailureCategory.TEP_ACCOUNT_MISSING]: 'TEP account missing',
  [FailureCategory.INVALID_CUSTOMER_DATA]: 'Invalid customer data',
  [FailureCategory.DUPLICATE_ORG_MEMBERSHIP]: 'Duplicate organisation membership',
  [FailureCategory.LICENCE_CONFIG_ERROR]: 'Licence configuration error',
  [FailureCategory.INTEGRATION_FAULT]: 'Integration fault',
  [FailureCategory.UNCATEGORISED]: 'Uncategorised',
};

export interface FailureRouting {
  /** Team accountable for the next step. */
  owner: string;
  /** What that team should actually do. */
  suggestedAction: string;
}

/**
 * Default ownership routing. Applied at import time and stored on the failure,
 * so reassigning an individual failure never rewrites history — and changing
 * this table only affects newly imported failures.
 */
export const FAILURE_ROUTING: Record<FailureCategory, FailureRouting> = {
  [FailureCategory.TEP_ACCOUNT_MISSING]: {
    owner: 'Customer Data',
    suggestedAction:
      'Create or link the customer’s TEP account so CUSTOMER_ID/OrgId resolves, then retry provisioning.',
  },
  [FailureCategory.INVALID_CUSTOMER_DATA]: {
    owner: 'Customer Data',
    suggestedAction:
      'Correct the invalid characters on the customer record, then retry provisioning.',
  },
  [FailureCategory.DUPLICATE_ORG_MEMBERSHIP]: {
    owner: 'ActiveHub Support',
    suggestedAction:
      'Confirm which organisation the user should belong to; moving them may need customer agreement.',
  },
  [FailureCategory.LICENCE_CONFIG_ERROR]: {
    owner: 'Order Management',
    suggestedAction: 'Correct the licence/order configuration and resubmit the order.',
  },
  [FailureCategory.INTEGRATION_FAULT]: {
    owner: 'Platform Engineering',
    suggestedAction:
      'Middleware or downstream API fault — retry the order; escalate if it recurs across the batch.',
  },
  [FailureCategory.UNCATEGORISED]: {
    owner: 'Triage',
    suggestedAction:
      'Unrecognised error. Review the raw message, assign an owner, and add a matcher so it routes automatically next time.',
  },
};

export interface ProvisioningFailureDto {
  id: string;
  orderNumber: string;
  contractNumber: string;
  orderDate: string | null;
  rawMessage: string;
  category: FailureCategory;
  owner: string;
  suggestedAction: string;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  /** Order lines this failure matches, resolved by order number. */
  matchedOrders?: Array<{
    id: string;
    productCode: string;
    productName: string | null;
    customerName: string | null;
    classification: string | null;
    licenceOrderMatch: string | null;
  }>;
}

export interface FailureBreakdownItem {
  key: string;
  label: string;
  count: number;
}
