import { appOrigin } from '@/lib/app-origin';
import { NextResponse } from 'next/server';
import { stage1Schema } from '@/lib/validation';
import { errorResponse, publicEvent, sameOrigin, rate } from '@/lib/server';
import { service } from '@/lib/supabase/server';
import { hashToken, newToken, session, setSession } from '@/lib/session';
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    sameOrigin(req);
    const event = await publicEvent((await params).slug);
    await rate(req, `join:${event.id}`, 20);
    const data = stage1Schema.parse(await req.json());
    const current = await session(event.id);
    const token = current?.token || newToken();
    const { error } = await service().rpc('submit_stage1', {
      p_event: event.id,
      p_hash: hashToken(token),
      p_existing_hash: current?.hash ?? null,
      p_data: data,
    });
    if (error) throw error;
    await setSession(event.id, token);
    return NextResponse.json({
      url: `/e/${event.slug}/dashboard`,
      access_url: `${appOrigin()}/e/${event.slug}/p/${token}`,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
