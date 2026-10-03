import { NextResponse } from 'next/server';
import { paymentParticipantSchema } from '@/lib/validation';
import { errorResponse, publicEvent, sameOrigin, rate } from '@/lib/server';
import { service } from '@/lib/supabase/server';
import { hashToken, newToken, session, setSession } from '@/lib/session';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    sameOrigin(req);
    const event = await publicEvent((await params).slug);
    await rate(req, `payment-participant:${event.id}`, 20);
    const data = paymentParticipantSchema.parse(await req.json());
    const current = await session(event.id);
    const token = current?.token || newToken();
    const { error } = await service().rpc('confirm_payment_participant', {
      p_event: event.id,
      p_hash: hashToken(token),
      p_existing_hash: current?.hash ?? null,
      p_data: data,
    });
    if (error) throw error;
    await setSession(event.id, token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
