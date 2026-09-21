import { NextResponse } from 'next/server';
import { admin, errorResponse, HttpError } from '@/lib/server';
import { service } from '@/lib/supabase/server';
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await admin();
    const { data } = await db
      .from('payments')
      .select('proof_storage_path')
      .eq('id', (await params).id)
      .maybeSingle();
    if (!data) throw new HttpError('Bukti tidak ditemukan', 404);
    const { data: signed, error } = await service()
      .storage.from('payment-proofs')
      .createSignedUrl(data.proof_storage_path, 60);
    if (error) throw error;
    return NextResponse.json(
      { url: signed.signedUrl },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
