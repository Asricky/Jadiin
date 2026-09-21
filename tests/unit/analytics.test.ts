import { describe, expect, it } from 'vitest';
import { analytics } from '../../src/lib/planning';
import type { Bundle } from '../../src/types/domain';
const fixture = {
  dates: [
    { id: 'd1', date: '2027-01-31' },
    { id: 'd2', date: '2027-02-01' },
  ],
  villas: [
    { id: 'v1', active: true },
    { id: 'v2', active: true },
    { id: 'v3', active: false },
  ],
  availability: [
    { event_date_id: 'd1', participant_id: 'p1' },
    { event_date_id: 'd2', participant_id: 'p1' },
  ],
  votes: [{ villa_id: 'v1' }, { villa_id: 'v2' }, { villa_id: 'v3' }, { villa_id: 'v3' }],
} as Bundle;
describe('planning results', () => {
  it('intersects attendance across consecutive days, never adds daily vote totals', () => {
    const data = {
      ...fixture,
      dates: [
        { id: 'd1', date: '2027-02-01' },
        { id: 'd2', date: '2027-02-02' },
        { id: 'd3', date: '2027-02-04' },
      ],
      availability: [
        { event_date_id: 'd1', participant_id: 'a' },
        { event_date_id: 'd1', participant_id: 'b' },
        { event_date_id: 'd2', participant_id: 'c' },
        { event_date_id: 'd3', participant_id: 'c' },
      ],
    } as Bundle;
    const result = analytics(data);
    expect(result.datePairs).toHaveLength(1);
    expect(result.datePairs[0].count).toBe(0);
    expect(result.leadingPairs).toEqual([]);
  });
  it('retains tied two-day options in calendar order', () => {
    const data = {
      ...fixture,
      dates: [
        { id: 'd3', date: '2027-02-03' },
        { id: 'd1', date: '2027-02-01' },
        { id: 'd2', date: '2027-02-02' },
      ],
      availability: ['d1', 'd2', 'd3'].map((id) => ({ event_date_id: id, participant_id: 'a' })),
    } as Bundle;
    expect(analytics(data).leadingPairs.map((p) => p.start.date)).toEqual([
      '2027-02-01',
      '2027-02-02',
    ]);
  });
  it('shows every tied date and active villa without choosing randomly', () => {
    const result = analytics(fixture);
    expect(result.leadingDates.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(result.leadingVillas.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(result.maxVilla).toBe(1);
    expect(result.leadingPairs.map((p) => [p.start.date, p.end.date, p.count])).toEqual([
      ['2027-01-31', '2027-02-01', 1],
    ]);
  });
  it('has no winner when no responses exist', () => {
    const result = analytics({ ...fixture, availability: [], votes: [] });
    expect(result.leadingDates).toEqual([]);
    expect(result.leadingPairs).toEqual([]);
    expect(result.leadingVillas).toEqual([]);
  });
});
