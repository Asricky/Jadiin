import { z } from 'zod';
export const normalizePhone = (s: string) => s.replace(/[\s()+-]/g, '').replace(/^0/, '62');
export const phone = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^628\d{7,12}$/, 'Nomor WhatsApp Indonesia tidak valid'));
export const identity = z.object({
  name: z.string().trim().min(2).max(80),
  whatsapp: phone,
  vehicle_type: z.enum(['CAR', 'MOTORCYCLE', 'NONE']),
});
export const stage1Schema = identity
  .extend({
    dates: z.array(z.string().uuid()).max(90),
    villa_id: z.string().uuid(),
    vehicle_owner: z.string().trim().max(80).default(''),
    vehicle_driver: z.string().trim().max(80).default(''),
    vehicle_capacity: z.coerce.number().int().min(1).max(50).default(5),
  })
  .refine((v) => v.vehicle_type !== 'MOTORCYCLE' || v.vehicle_capacity <= 2, {
    path: ['vehicle_capacity'],
    message: 'Motor maksimal 2 orang termasuk driver',
  });
// The product uses one explicit event timezone (WIB) rather than interpreting
// datetime-local differently in the organizer browser and Vercel's UTC runtime.
const deadline = z
  .string()
  .max(40)
  .default('')
  .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Tanggal tidak valid')
  .transform((s) => (s && !/(Z|[+-]\d{2}:\d{2})$/.test(s) ? `${s}+07:00` : s));
export const eventSchema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().max(3000).default(''),
  stage1_deadline: deadline,
});
const maps = z
  .string()
  .max(1000)
  .refine((s) => {
    if (!s) return true;
    try {
      const u = new URL(s);
      return (
        u.protocol === 'https:' &&
        ['maps.google.com', 'www.google.com', 'google.com', 'maps.app.goo.gl', 'goo.gl'].includes(
          u.hostname,
        )
      );
    } catch {
      return false;
    }
  }, 'Gunakan URL HTTPS Google Maps');
export const villaSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(3000).default(''),
  price: z.coerce.number().min(0).max(999999999),
  capacity: z.coerce.number().int().min(1).max(10000),
  address: z.string().max(1000).default(''),
  google_maps_url: maps.default(''),
  facilities: z.array(z.string().max(100)).max(30).default([]),
  notes: z.string().max(1000).default(''),
  active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
export const actions = {
  create: eventSchema,
  settings: eventSchema.extend({
    show_transport_groups: z.boolean(),
    show_participant_list: z.boolean(),
  }),
  dates: z.object({
    dates: z
      .array(date)
      .min(1)
      .max(90)
      .refine((a) => new Set(a).size === a.length),
  }),
  villa: villaSchema,
  delete_villa: z.object({ id: z.string().uuid() }),
  delete_image: z.object({ id: z.string().uuid() }),
  cover_image: z.object({ id: z.string().uuid() }),
  status: z.object({
    status: z.enum([
      'DRAFT',
      'STAGE_1_OPEN',
      'STAGE_1_CLOSED',
      'STAGE_2_OPEN',
      'COMPLETED',
      'ARCHIVED',
    ]),
  }),
  finalize: z.object({
    final_villa_id: z.string().uuid(),
    final_date: date,
    cost_per_person: z.coerce.number().min(0).max(999999999),
    bank_name: z.string().trim().min(1).max(100),
    bank_account_number: z.string().regex(/^\d{5,30}$/),
    bank_account_holder: z.string().trim().min(2).max(120),
    payment_note: z.string().max(1000).default(''),
    stage2_deadline: deadline,
  }),
  group: z
    .object({
      type: z.enum(['CAR', 'MOTORCYCLE', 'INDEPENDENT']),
      label: z.string().trim().min(2).max(100),
      capacity: z.coerce.number().int().min(1).max(50),
      owner_participant_id: z.union([z.string().uuid(), z.literal('')]),
      driver_participant_id: z.union([z.string().uuid(), z.literal('')]),
    })
    .refine((x) => x.type !== 'MOTORCYCLE' || x.capacity <= 2, 'Motor maksimal dua orang')
    .refine((x) => x.type !== 'INDEPENDENT' || x.capacity === 1),
  delete_group: z.object({ id: z.string().uuid() }),
  assign: z.object({
    participant_id: z.string().uuid(),
    group_id: z.union([z.string().uuid(), z.literal('')]),
  }),
  rotate_token: z.object({ id: z.string().uuid() }),
  participant: identity.extend({ id: z.string().uuid() }),
  delete_participant: z.object({ id: z.string().uuid() }),
  payment_review: z
    .object({
      id: z.string().uuid(),
      status: z.enum(['VERIFIED', 'REJECTED']),
      admin_note: z.string().max(1000).default(''),
    })
    .refine(
      (x) => x.status !== 'REJECTED' || x.admin_note.trim().length > 0,
      'Isi alasan penolakan',
    ),
  delete_event: z.object({ confirmation: z.string() }),
};
export const uploadSchema = z.object({
  kind: z.enum(['payment', 'media']),
  event_id: z.string().uuid(),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});
export function detectImage(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'image/png';
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
