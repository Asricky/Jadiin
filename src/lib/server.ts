import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { service, supabase } from './supabase/server';
import type { Bundle, Event } from '@/types/domain';
import { hashToken } from './session';
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function admin() {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new HttpError('Silakan login', 401);
  return { db, user };
}
export async function ownedEvent(id: string) {
  const { db, user } = await admin();
  const { data } = await db
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!data) throw new HttpError('Event tidak ditemukan', 404);
  return { db, event: data as Event };
}
export async function publicEvent(slug: string) {
  const { data, error } = await service()
    .from('events')
    .select('*')
    .eq('slug', slug)
    .not('status', 'in', '(DRAFT,ARCHIVED)')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError('Acara tidak ditemukan', 404);
  return data as Event;
}
export async function bundle(event: Event, owner = false): Promise<Bundle> {
  const db = owner ? (await admin()).db : service();
  const tables = [
    'event_dates',
    'villas',
    'villa_images',
    'participants',
    'participant_availability',
    'villa_votes',
    'transport_groups',
    'transport_members',
    'payments',
  ];
  const fields = [
    '*',
    '*',
    'id,villa_id,storage_path',
    owner
      ? 'id,event_id,name,whatsapp,vehicle_type,stage1_submitted_at,stage2_submitted_at'
      : 'id,name',
    'participant_id,event_date_id',
    'participant_id,villa_id',
    '*',
    'participant_id,transport_group_id,role',
    owner ? 'id,participant_id,amount,status,admin_note,submitted_at' : 'id',
  ];
  // PostgREST defaults to 1,000 rows. Page child records so larger calendars do not
  // silently undercount availability (e.g. 30 participants x 60 selected dates).
  const result = await Promise.all(
    tables.map(async (table, i) => {
      if (table === 'payments' && !owner) return { data: [] };
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        const order = ['participant_availability', 'villa_votes'].includes(table)
          ? 'participant_id'
          : 'id';
        let query = db.from(table).select(fields[i]).eq('event_id', event.id).order(order);
        if (table === 'participant_availability') query = query.order('event_date_id');
        const { data, error } = await query.range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      return { data: rows };
    }),
  );
  return {
    event,
    dates: result[0].data,
    villas: result[1].data,
    images: result[2].data,
    participants: result[3].data,
    availability: result[4].data,
    votes: result[5].data,
    groups: result[6].data,
    members: result[7].data,
    payments: owner ? result[8].data : [],
  } as unknown as Bundle;
}
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') },
      { status: 400 },
    );
  if (error instanceof HttpError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  const e = error as { code?: string; message?: string };
  if (e.code === '23505')
    return NextResponse.json(
      {
        error:
          'Nama atau slug sudah digunakan. Gunakan link akses sebelumnya untuk mengubah jawaban.',
      },
      { status: 409 },
    );
  if (e.code === '23503')
    return NextResponse.json(
      { error: 'Data masih digunakan atau berasal dari event lain.' },
      { status: 409 },
    );
  if (e.code === 'P0001' || e.code === '23514')
    return NextResponse.json({ error: e.message }, { status: 400 });
  console.error('Request failed', e.code || 'internal');
  return NextResponse.json({ error: 'Terjadi gangguan. Silakan coba lagi.' }, { status: 500 });
}
export function sameOrigin(req: Request) {
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || req.url).origin;
  if (req.headers.get('origin') !== expected) throw new HttpError('Origin tidak diizinkan', 403);
}
export async function rate(req: Request, scope: string, limit = 30) {
  const ip =
    req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'local';
  const key = hashToken(`${scope}:${ip.split(',')[0]}`);
  const { data, error } = await service().rpc('check_rate', { p_key: key, p_limit: limit });
  if (error) throw error;
  if (!data) throw new HttpError('Terlalu banyak permintaan. Coba satu menit lagi.', 429);
}
