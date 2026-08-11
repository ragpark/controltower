import { Classification } from '@control-tower/shared-types';
import { createDefaultRegistry, EngineRule, RuleEngine } from '@control-tower/classification';
import {
  CLASSIFICATION_RULES,
  isLegacyMapping,
  SUPERSEDED_RULE_NAMES,
} from '../../prisma/seed-data';

const NOW = new Date('2026-08-11T12:00:00Z');
const engine = new RuleEngine(createDefaultRegistry(() => NOW));

const rules: EngineRule[] = CLASSIFICATION_RULES.map((r) => ({
  id: r.name,
  name: r.name,
  priority: r.priority,
  enabled: true,
  strategy: r.strategy,
  ruleDefinition: r.ruleDefinition as never,
  outcome: r.outcome as unknown as Classification,
}));

function order(partial: Record<string, unknown>) {
  return {
    orderNumber: '136',
    productCode: '9781410000001',
    orderSource: 'Big Commerce',
    customerName: 'Alexa Foley',
    customerEmail: 'alexa@yopmail.com',
    orderStatus: 'Complete',
    orderState: 'Order Complete',
    licenceOrderMatch: 'Match',
    licenceIsbnMatch: 'Match',
    orderDate: '2026-08-10T00:00:00Z',
    ...partial,
  };
}

const classify = (partial: Record<string, unknown>) =>
  engine.evaluate(order(partial), rules);

describe('seeded ActiveHub rule set', () => {
  it('complete + both licence flags matched → Completed', () => {
    const result = classify({});
    expect(result.classification).toBe(Classification.COMPLETED);
    expect(result.matchedRule?.name).toBe('Completed and fully reconciled');
  });

  it('complete but no licence order match → Customer Impacted (paid, no access)', () => {
    const result = classify({ licenceOrderMatch: 'Not Match', licenceIsbnMatch: 'Not Match' });
    expect(result.classification).toBe(Classification.CUSTOMER_IMPACTED);
    expect(result.matchedRule?.name).toBe('Paid but no licence provisioned');
  });

  it('order matched but ISBN did not → Investigate (wrong product licensed)', () => {
    const result = classify({ licenceIsbnMatch: 'Not Match' });
    expect(result.classification).toBe(Classification.INVESTIGATE_REQUIRED);
    expect(result.matchedRule?.name).toBe('Wrong product licensed');
  });

  // An unverified ISBN is not "fully reconciled" — it must not read as Completed.
  it.each([['', 'empty'], ['Unknown', 'unrecognised']])(
    'complete with %s ISBN flag (%s) is not marked Completed',
    (licenceIsbnMatch) => {
      const result = classify({ licenceIsbnMatch });
      expect(result.classification).toBe(Classification.INVESTIGATE_REQUIRED);
      expect(result.matchedRule?.name).toBe('Catch-all — investigate');
    },
  );

  it('cancelled, refunded and declined orders → Cancelled', () => {
    for (const orderStatus of ['Cancelled', 'Refunded', 'Declined']) {
      expect(classify({ orderStatus }).classification).toBe(Classification.CANCELLED);
    }
  });

  it('cancellation outranks an unprovisioned licence', () => {
    const result = classify({ orderStatus: 'Cancelled', licenceOrderMatch: 'Not Match' });
    expect(result.classification).toBe(Classification.CANCELLED);
  });

  it('no name and no email → Exception', () => {
    const result = classify({
      customerName: '',
      customerEmail: '',
      licenceOrderMatch: 'Match',
      licenceIsbnMatch: 'Unknown',
    });
    expect(result.classification).toBe(Classification.EXCEPTION);
  });

  it('a customer with only an email is not a data-quality exception', () => {
    const result = classify({ customerName: '', orderStatus: 'Incomplete' });
    expect(result.classification).not.toBe(Classification.EXCEPTION);
  });

  it('recent incomplete order → Pending; stale one → Investigate', () => {
    expect(
      classify({ orderStatus: 'Incomplete', licenceOrderMatch: 'Not Match' }).classification,
    ).toBe(Classification.PENDING);

    const stale = classify({
      orderStatus: 'Incomplete',
      licenceOrderMatch: 'Not Match',
      orderDate: '2026-06-20T00:00:00Z',
    });
    expect(stale.classification).toBe(Classification.INVESTIGATE_REQUIRED);
    expect(stale.matchedRule?.name).toBe('Stale incomplete order');
  });

  it('in-fulfilment statuses → Placed', () => {
    for (const orderStatus of ['Awaiting Fulfillment', 'Processing', 'Dispatched']) {
      expect(
        classify({ orderStatus, licenceOrderMatch: 'Unknown', licenceIsbnMatch: 'Unknown' })
          .classification,
      ).toBe(Classification.PLACED);
    }
  });

  it('an unrecognised status falls through to the catch-all', () => {
    const result = classify({
      orderStatus: 'Some New Status',
      orderState: 'Unknown',
      licenceOrderMatch: 'Unknown',
      licenceIsbnMatch: 'Unknown',
    });
    expect(result.classification).toBe(Classification.INVESTIGATE_REQUIRED);
    expect(result.matchedRule?.name).toBe('Catch-all — investigate');
  });

  it('priorities are unique, so evaluation order never depends on the name tie-break', () => {
    const priorities = CLASSIFICATION_RULES.map((r) => r.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('no superseded rule name is still part of the active set', () => {
    const active = new Set(CLASSIFICATION_RULES.map((r) => r.name));
    for (const name of SUPERSEDED_RULE_NAMES) {
      expect(active.has(name)).toBe(false);
    }
  });
});

describe('isLegacyMapping', () => {
  it('matches only the exact pre-alignment template', () => {
    expect(isLegacyMapping({ orderNumber: 'Order Number', productCode: 'Product Code' })).toBe(
      true,
    );
  });

  it('leaves legitimate custom mappings alone', () => {
    // shares one header name but is a real custom mapping — must not be rewritten
    expect(isLegacyMapping({ orderNumber: 'Order Number', productCode: 'SKU' })).toBe(false);
    expect(isLegacyMapping({ orderNumber: 'order_id', productCode: 'Product Code' })).toBe(false);
    expect(isLegacyMapping({ orderNumber: 'order_id', productCode: 'productcode' })).toBe(false);
    expect(isLegacyMapping(undefined)).toBe(false);
    expect(isLegacyMapping({})).toBe(false);
  });
});
