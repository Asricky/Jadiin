import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, HttpError, publicEvent, rate, sameOrigin } from '@/lib/server';
import { service } from '@/lib/supabase/server';
import { session } from '@/lib/session';
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    sameOrigin(req);
    const event = await publicEvent((await params).slug);
    await rate(req, `identity:${event.id}`, 20);
    if (
      event.status !== 'STAGE_1_OPEN' ||
      (event.stage1_deadline && new Date(event.stage1_deadline) < new Date())
    )
      throw new HttpError('Pendaftaran sudah ditutup');
    const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(await req.json());
    const [{ data, error }, current] = await Promise.all([
      service()
        .from('participants')
        .select('id')
        .eq('event_id', event.id)
        .eq('normalized_name', name.replace(/\s+/g, ' ').toLowerCase())
        .maybeSingle(),
      session(event.id),
    ]);
    if (error) throw error;
    if (data && data.id !== current?.id)
      throw new HttpError(
        'Nama ini sudah terdaftar di acara ini. Gunakan link akses sebelumnya atau hubungi organizer untuk mengubah jawaban.',
        409,
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
