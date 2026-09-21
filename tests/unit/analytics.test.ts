import { describe, expect, it } from 'vitest';
import { analytics } from '../../src/lib/planning';
import type { Bundle } from '../../src/types/domain';
const fixture = {
  dates: [{ id: 'd1' }, { id: 'd2' }],
  villas: [
    { id: 'v1', active: true },
    { id: 'v2', active: true },
    { id: 'v3', active: false },
  ],
  availability: [{ event_date_id: 'd1' }, { event_date_id: 'd2' }],
  votes: [{ villa_id: 'v1' }, { villa_id: 'v2' }, { villa_id: 'v3' }, { villa_id: 'v3' }],
} as Bundle;
describe('planning results', () => {
  it('shows every tied date and active villa without choosing randomly', () => {
    const result = analytics(fixture);
    expect(result.leadingDates.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(result.leadingVillas.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(result.maxVilla).toBe(1);
  });
  it('has no winner when no responses exist', () => {
    const result = analytics({ ...fixture, availability: [], votes: [] });
    expect(result.leadingDates).toEqual([]);
    expect(result.leadingVillas).toEqual([]);
  });
});
