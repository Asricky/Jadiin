import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { publicEvent } from '@/lib/server';
import { session } from '@/lib/session';
import { service } from '@/lib/supabase/server';
export default async function ThankYou({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await publicEvent(slug);
  const p = await session(event.id);
  if (!p) redirect(`/e/${slug}`);
  const { data: payment } = await service()
    .from('payments')
    .select('status,admin_note')
    .eq('participant_id', p.id)
    .eq('event_id', event.id)
    .maybeSingle();
  if (!payment) redirect(`/e/${slug}/stage-2`);
  return (
    <main className="narrow section stack" style={{ textAlign: 'center', paddingTop: 70 }}>
      <CheckCircle2 size={70} strokeWidth={1.2} style={{ margin: 'auto', color: '#2563eb' }} />

      <h1>Terima kasih, {p.name}.</h1>
      <p>
        {payment.status === 'REJECTED'
          ? 'Organizer meminta perbaikan bukti pembayaran.'
          : payment.status === 'VERIFIED'
            ? 'Pembayaranmu sudah diverifikasi. Sampai ketemu di acaranya!'
            : 'Data dan bukti pembayaran kamu sudah kami terima. Organizer akan memverifikasi pembayaranmu.'}
      </p>
      <div className="notice">
        Status:{' '}
        {
          {
            PENDING: 'Menunggu verifikasi',
            VERIFIED: 'Terverifikasi',
            REJECTED: 'Perlu perbaikan',
          }[payment.status as 'PENDING' | 'VERIFIED' | 'REJECTED']
        }
        {payment.status === 'REJECTED' && <p>{payment.admin_note}</p>}
      </div>
      <Link className="button" href={`/e/${slug}/stage-2`}>
        Kembali ke detail acara
      </Link>
    </main>
  );
}
