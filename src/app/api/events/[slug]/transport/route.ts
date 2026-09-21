import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publicEvent, bundle, errorResponse, sameOrigin, rate, HttpError } from '@/lib/server';
import { session } from '@/lib/session';
import { service } from '@/lib/supabase/server';
type Context = { params: Promise<{ slug: string }> };
async function actor(ctx: Context) {
  const event = await publicEvent((await ctx.params).slug);
  const participant = await session(event.id);
  if (!participant) throw new HttpError('Sesi tidak valid', 401);
  if (!['STAGE_2_OPEN', 'COMPLETED'].includes(event.status))
    throw new HttpError('Pemilihan transport belum dibuka');
  return { event, participant };
}
export async function GET(_: Request, ctx: Context) {
  try {
    const { event, participant } = await actor(ctx);
    const data = await bundle(event);
    return NextResponse.json(
      {
        groups: data.groups.filter(
          (g) =>
            g.type !== 'INDEPENDENT' || data.members.some((m) => m.transport_group_id === g.id),
        ),
        members: data.members,
        participants: data.participants,
        participantId: participant.id,
        open: event.status === 'STAGE_2_OPEN',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    await rate(req, 'choose-transport', 60);
    const { event, participant } = await actor(ctx);
    const input = z
      .object({ group_id: z.string().uuid().nullable(), independent: z.boolean().default(false) })
      .parse(await req.json());
    const { data, error } = await service().rpc('choose_transport', {
      p_event: event.id,
      p_hash: participant.hash,
      p_group: input.group_id,
      p_independent: input.independent,
    });
    if (error) throw error;
    return NextResponse.json({ group_id: data });
  } catch (e) {
    return errorResponse(e);
  }
}
