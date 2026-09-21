import { NextResponse } from 'next/server';
import { actions } from '@/lib/validation';
import { admin, errorResponse, sameOrigin } from '@/lib/server';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { db } = await admin();
    const body = actions.create.parse(await req.json());
    const { data, error } = await db.rpc('admin_action', {
      p_event: null,
      p_action: 'create',
      p_data: body,
    });
    if (error) throw error;
    return NextResponse.json({ id: data });
  } catch (e) {
    return errorResponse(e);
  }
}
