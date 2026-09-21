import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { uploadSchema, detectImage } from '@/lib/validation';
import { service } from '@/lib/supabase/server';
import { errorResponse, ownedEvent, sameOrigin, rate, HttpError } from '@/lib/server';
import { session } from '@/lib/session';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await rate(req, 'upload', 150);
    const raw = await req.json();
    const db = service();
    if (raw.action === 'sign') {
      const input = uploadSchema.parse(raw);
      let participantId: string | null = null;
      if (input.kind === 'media') {
        const { event } = await ownedEvent(input.event_id);
        if (!['DRAFT', 'STAGE_1_OPEN', 'STAGE_1_CLOSED'].includes(event.status))
          throw new HttpError('Media sudah dikunci');
      } else {
        const p = await session(input.event_id);
        if (!p) throw new HttpError('Sesi tidak valid', 401);
        participantId = p.id;
        const { data: e } = await db
          .from('events')
          .select('status,stage2_deadline')
          .eq('id', input.event_id)
          .single();
        if (
          e?.status !== 'STAGE_2_OPEN' ||
          (e.stage2_deadline && new Date(e.stage2_deadline) < new Date())
        )
          throw new HttpError('Pembayaran ditutup');
        const { data: pay } = await db
          .from('payments')
          .select('status')
          .eq('participant_id', p.id)
          .maybeSingle();
        if (pay && pay.status !== 'REJECTED') throw new HttpError('Pembayaran sudah diterima');
      }
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[input.mime];
      const path = `${input.event_id}/${participantId || 'media'}/${randomUUID()}.${ext}`;
      const bucket = input.kind === 'payment' ? 'payment-proofs' : 'villa-media';
      const { data: intent, error } = await db
        .from('upload_intents')
        .insert({
          event_id: input.event_id,
          participant_id: participantId,
          path,
          mime: input.mime,
          size: input.size,
          kind: input.kind,
        })
        .select('id')
        .single();
      if (error) throw error;
      const { data: signed, error: signError } = await db.storage
        .from(bucket)
        .createSignedUploadUrl(path, { upsert: false });
      if (signError) throw signError;
      return NextResponse.json({ intent: intent.id, path, token: signed.token, bucket });
    }
    const { intent, villa_id } = z
      .object({ intent: z.string().uuid(), villa_id: z.string().uuid().optional() })
      .parse(raw);
    const { data: u } = await db.from('upload_intents').select('*').eq('id', intent).single();
    if (!u || u.used || new Date(u.expires_at) < new Date())
      throw new HttpError('Upload tidak valid');
    const actor = u.kind === 'media' ? await ownedEvent(u.event_id) : null;
    const p = u.kind === 'payment' ? await session(u.event_id) : null;
    if (u.kind === 'payment' && p?.id !== u.participant_id)
      throw new HttpError('Sesi tidak valid', 401);
    const bucket = u.kind === 'payment' ? 'payment-proofs' : 'villa-media';
    const { data: file, error } = await db.storage.from(bucket).download(u.path);
    if (error || !file) throw new HttpError('File belum terunggah');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length !== u.size || bytes.length > 5242880 || detectImage(bytes) !== u.mime) {
      await db.storage.from(bucket).remove([u.path]);
      throw new HttpError('Isi, tipe, atau ukuran file tidak sesuai');
    }
    const { error: commitError } = await db.rpc('commit_upload', {
      p_intent: intent,
      p_hash: p?.hash ?? null,
      p_villa: villa_id ?? null,
      p_owner: actor?.event.owner_id ?? null,
    });
    if (commitError) throw commitError;
    if (u.kind === 'media' && villa_id) {
      const [{ data: image }, { data: villa }] = await Promise.all([
        db
          .from('villa_images')
          .select('id,villa_id,storage_path')
          .eq('event_id', u.event_id)
          .eq('storage_path', u.path)
          .single(),
        db
          .from('villas')
          .select('cover_path')
          .eq('id', villa_id)
          .eq('event_id', u.event_id)
          .single(),
      ]);
      return NextResponse.json({ ok: true, image, cover: villa?.cover_path });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
