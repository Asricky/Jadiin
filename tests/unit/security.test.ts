import { describe, it, expect } from 'vitest';
import {
  actions,
  detectImage,
  normalizePhone,
  stage1Schema,
  uploadSchema,
} from '../../src/lib/validation';
describe('participant input boundary', () => {
  it('normalizes Indonesian WhatsApp without accepting arbitrary phones', () => {
    expect(normalizePhone('0812-3456 7890')).toBe('6281234567890');
    expect(
      stage1Schema.safeParse({
        name: 'Andi',
        whatsapp: '081234567890',
        vehicle_type: 'NONE',
        dates: [],
        villa_id: 'b6f85a88-654c-4223-9412-6f9c870b8b80',
      }).success,
    ).toBe(true);
    expect(
      stage1Schema.safeParse({ name: 'A', whatsapp: '123', vehicle_type: 'BOAT' }).success,
    ).toBe(false);
  });
  it('requires a UUID villa and bounded dates', () => {
    expect(
      stage1Schema.safeParse({
        name: 'Andi',
        whatsapp: '081234567890',
        vehicle_type: 'NONE',
        dates: [],
        villa_id: 'other-event',
      }).success,
    ).toBe(false);
  });
  it('validates real calendar dates and uniqueness', () => {
    expect(actions.dates.safeParse({ dates: ['2026-02-30'] }).success).toBe(false);
    expect(actions.dates.safeParse({ dates: ['2026-10-01', '2026-10-01'] }).success).toBe(false);
  });
});
describe('file validation', () => {
  it('rejects oversized files and unsafe formats', () => {
    const base = {
      kind: 'payment',
      event_id: 'b6f85a88-654c-4223-9412-6f9c870b8b80',
      mime: 'image/png',
      size: 5242880,
    };
    expect(uploadSchema.safeParse(base).success).toBe(true);
    expect(uploadSchema.safeParse({ ...base, size: 5242881 }).success).toBe(false);
    expect(uploadSchema.safeParse({ ...base, mime: 'image/svg+xml' }).success).toBe(false);
  });
  it('checks actual signature instead of trusting claimed MIME', () => {
    expect(detectImage(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
    expect(detectImage(new Uint8Array([255, 216, 255, 0]))).toBe('image/jpeg');
    expect(detectImage(new TextEncoder().encode('<script>alert(1)</script>'))).toBe(null);
  });
});
describe('organizer validation', () => {
  it('limits motorcycle capacity and independent transport', () => {
    const group = {
      type: 'MOTORCYCLE',
      label: 'Motor Andi',
      capacity: 3,
      owner_participant_id: '',
      driver_participant_id: 'b6f85a88-654c-4223-9412-6f9c870b8b80',
    };
    expect(actions.group.safeParse(group).success).toBe(false);
    expect(actions.group.safeParse({ ...group, capacity: 2 }).success).toBe(true);
    expect(actions.group.safeParse({ ...group, type: 'INDEPENDENT', capacity: 2 }).success).toBe(
      false,
    );
  });
  it('requires rejection explanation', () => {
    expect(
      actions.payment_review.safeParse({
        id: 'b6f85a88-654c-4223-9412-6f9c870b8b80',
        status: 'REJECTED',
        admin_note: '',
      }).success,
    ).toBe(false);
  });
  it('rejects script and non-Google map URLs', () => {
    const villa = { name: 'Villa', price: 1, capacity: 1 };
    expect(
      actions.villa.safeParse({ ...villa, google_maps_url: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(
      actions.villa.safeParse({ ...villa, google_maps_url: 'https://evil.test/maps' }).success,
    ).toBe(false);
    expect(
      actions.villa.safeParse({ ...villa, google_maps_url: 'https://maps.app.goo.gl/example' })
        .success,
    ).toBe(true);
  });
});
