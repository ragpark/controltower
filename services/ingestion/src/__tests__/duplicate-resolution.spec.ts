import {
  planDuplicateResolution,
  supersededCount,
  DuplicateCandidate,
} from '../duplicate-resolution';

const at = (iso: string) => new Date(iso);

const row = (
  id: string,
  orderNumber: string,
  productCode: string,
  importedAt: string,
  createdAt = importedAt,
): DuplicateCandidate => ({
  id,
  orderNumber,
  productCode,
  importedAt: at(importedAt),
  createdAt: at(createdAt),
});

describe('planDuplicateResolution', () => {
  it('groups rows whose keys differ only by case', () => {
    const plans = planDuplicateResolution([
      row('a', 'ORD-1', '9780141036144', '2026-08-10T00:00:00Z'),
      row('b', 'ord-1', '9780141036144', '2026-08-11T00:00:00Z'),
    ]);

    expect(plans).toHaveLength(1);
    expect(plans[0].survivor.id).toBe('b');
    expect(plans[0].superseded.map((r) => r.id)).toEqual(['a']);
  });

  it('keeps the most recently imported row', () => {
    const plans = planDuplicateResolution([
      row('old', 'ORD-1', 'ISBN-1', '2026-08-01T00:00:00Z'),
      row('newest', 'ord-1', 'isbn-1', '2026-08-14T00:00:00Z'),
      row('middle', 'Ord-1', 'Isbn-1', '2026-08-07T00:00:00Z'),
    ]);

    expect(plans[0].survivor.id).toBe('newest');
    expect(plans[0].superseded.map((r) => r.id)).toEqual(['middle', 'old']);
  });

  it('never groups a multi-line order — same order number, different products', () => {
    const plans = planDuplicateResolution([
      row('a', 'ORD-1', 'ISBN-1', '2026-08-10T00:00:00Z'),
      row('b', 'ORD-1', 'ISBN-2', '2026-08-11T00:00:00Z'),
      row('c', 'ORD-1', 'ISBN-3', '2026-08-12T00:00:00Z'),
    ]);

    expect(plans).toEqual([]);
  });

  it('ignores rows that have no duplicate', () => {
    const plans = planDuplicateResolution([
      row('solo', 'ORD-9', 'ISBN-9', '2026-08-10T00:00:00Z'),
      row('a', 'ORD-1', 'ISBN-1', '2026-08-10T00:00:00Z'),
      row('b', 'ord-1', 'ISBN-1', '2026-08-11T00:00:00Z'),
    ]);

    expect(plans).toHaveLength(1);
    expect(plans[0].key).toContain('ord-1');
  });

  it('breaks an importedAt tie deterministically rather than arbitrarily', () => {
    const sameImport = '2026-08-14T00:00:00Z';
    const build = () => [
      row('id-b', 'ORD-1', 'ISBN-1', sameImport, '2026-08-02T00:00:00Z'),
      row('id-a', 'ord-1', 'isbn-1', sameImport, '2026-08-03T00:00:00Z'),
    ];

    const first = planDuplicateResolution(build());
    const reversed = planDuplicateResolution(build().reverse());

    // Later createdAt wins, and input order must not change the outcome —
    // otherwise a dry run would not predict the real run.
    expect(first[0].survivor.id).toBe('id-a');
    expect(reversed[0].survivor.id).toBe('id-a');
  });

  it('falls back to id when importedAt and createdAt are both equal', () => {
    const t = '2026-08-14T00:00:00Z';
    const plans = planDuplicateResolution([
      row('zzz', 'ORD-1', 'ISBN-1', t, t),
      row('aaa', 'ord-1', 'ISBN-1', t, t),
    ]);

    expect(plans[0].survivor.id).toBe('aaa');
    expect(planDuplicateResolution([
      row('aaa', 'ord-1', 'ISBN-1', t, t),
      row('zzz', 'ORD-1', 'ISBN-1', t, t),
    ])[0].survivor.id).toBe('aaa');
  });

  it('trims surrounding whitespace as dedupKey does', () => {
    const plans = planDuplicateResolution([
      row('a', ' ORD-1 ', 'ISBN-1', '2026-08-10T00:00:00Z'),
      row('b', 'ORD-1', ' ISBN-1', '2026-08-11T00:00:00Z'),
    ]);

    expect(plans).toHaveLength(1);
    expect(plans[0].survivor.id).toBe('b');
  });

  it('returns groups in a stable order', () => {
    const plans = planDuplicateResolution([
      row('a1', 'ORD-2', 'ISBN-1', '2026-08-10T00:00:00Z'),
      row('a2', 'ord-2', 'ISBN-1', '2026-08-11T00:00:00Z'),
      row('b1', 'ORD-1', 'ISBN-1', '2026-08-10T00:00:00Z'),
      row('b2', 'ord-1', 'ISBN-1', '2026-08-11T00:00:00Z'),
    ]);

    expect(plans.map((p) => p.key)).toEqual([...plans.map((p) => p.key)].sort());
  });

  it('counts every row that would be removed', () => {
    const plans = planDuplicateResolution([
      row('a', 'ORD-1', 'ISBN-1', '2026-08-10T00:00:00Z'),
      row('b', 'ord-1', 'ISBN-1', '2026-08-11T00:00:00Z'),
      row('c', 'Ord-1', 'ISBN-1', '2026-08-12T00:00:00Z'),
      row('d', 'ORD-2', 'ISBN-2', '2026-08-10T00:00:00Z'),
      row('e', 'ord-2', 'ISBN-2', '2026-08-11T00:00:00Z'),
    ]);

    expect(supersededCount(plans)).toBe(3);
  });

  it('handles an empty estate', () => {
    expect(planDuplicateResolution([])).toEqual([]);
    expect(supersededCount([])).toBe(0);
  });
});
