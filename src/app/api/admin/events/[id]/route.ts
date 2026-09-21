import { NextResponse } from 'next/server';
import { actions } from '@/lib/validation';
import { bundle, errorResponse, ownedEvent, sameOrigin, HttpError } from '@/lib/server';
import { hashToken, newToken } from '@/lib/session';
import { z } from 'zod';
import { service } from '@/lib/supabase/server';
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_: Request, ctx: Ctx) {
  try {
    const { event } = await ownedEvent((await ctx.params).id);
    return NextResponse.json(await bundle(event, true));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request, ctx: Ctx) {
  try {
    sameOrigin(req);
    const { db, event } = await ownedEvent((await ctx.params).id);
    const body = z.object({ action: z.string(), data: z.unknown() }).parse(await req.json());
    if (!Object.hasOwn(actions, body.action) || body.action === 'create')
      throw new HttpError('Aksi tidak valid');
    const parsed = actions[body.action as keyof typeof actions].parse(body.data);
    let data: object = parsed;
    let access_url: string | undefined;
    let imagePath: string | undefined;
    if (body.action === 'delete_image') {
      const { data: image } = await db
        .from('villa_images')
        .select('storage_path')
        .eq('id', (parsed as { id: string }).id)
        .eq('event_id', event.id)
        .maybeSingle();
      imagePath = image?.storage_path;
    }
    if (body.action === 'rotate_token') {
      const token = newToken();
      data = { ...parsed, hash: hashToken(token) };
      access_url = `${process.env.NEXT_PUBLIC_APP_URL}/e/${event.slug}/p/${token}`;
    }
    const { data: result, error } = await db.rpc('admin_action', {
      p_event: event.id,
      p_action: body.action,
      p_data: data,
    });
    if (error) throw error;
    if (imagePath) await service().storage.from('villa-media').remove([imagePath]);
    return NextResponse.json({ id: result, access_url });
  } catch (e) {
    return errorResponse(e);
  }
}
