import { expect, it } from 'vitest';
import { tripDateRange } from '../../src/lib/utils';
it('formats compact trip dates without losing the month or year at boundaries', () => {
  expect(tripDateRange('2026-12-12', '2026-12-14')).toBe('12–14 Desember 2026');
  expect(tripDateRange('2026-12-31', '2027-01-01')).toBe('31 Desember 2026–1 Januari 2027');
  expect(tripDateRange('2027-01-31', '2027-02-01')).toBe('31 Januari–1 Februari 2027');
});
