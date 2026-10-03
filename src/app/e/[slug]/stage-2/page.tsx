import { paymentMethods } from '@/lib/payment-methods';
import { VillaCard } from '@/components/villa-card';
import { appOrigin } from '@/lib/app-origin';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { publicEvent, bundle } from '@/lib/server';
import { session } from '@/lib/session';
import { service } from '@/lib/supabase/server';
import { prettyDate, rupiah, tripDateRange } from '@/lib/utils';
import { CopyButton } from '@/components/common';
import { PaymentUpload } from '@/components/payment-upload';
export default async function Stage2({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await publicEvent(slug);
  const p = await session(event.id);
  if (!p) redirect(`/e/${slug}`);
  if (!['STAGE_2_OPEN', 'COMPLETED'].includes(event.status)) redirect(`/e/${slug}/dashboard`);
  const [data, { data: payment }] = await Promise.all([
    bundle(event),
    service()
      .from('payments')
      .select('status,admin_note,amount,payment_method')
      .eq('participant_id', p.id)
      .eq('event_id', event.id)
      .maybeSingle(),
  ]);
  const villa = data.villas.find((v) => v.id === event.final_villa_id);
  const amount = payment && payment.status !== 'REJECTED' ? payment.amount : event.cost_per_person!;
  return (
    <main className="narrow section stack final-plan">
      <span className="eyebrow">{event.name}</span>
      <h1>{event.status === 'COMPLETED' ? 'Acara selesai' : 'Rencana final'}</h1>
      <p className="final-trip-line" aria-label="Tanggal dan tujuan perjalanan">
        <span>{tripDateRange(event.final_date!, event.final_end_date!)}</span>
        <span aria-hidden="true"> • </span>
        <strong title={villa?.name}>{villa?.name || 'Tujuan belum ditetapkan'}</strong>
      </p>
      {villa && (
        <section className="stack-sm" aria-label="Preview villa final">
          <VillaCard villa={villa} images={data.images} final previewOnly />
        </section>
      )}
      {slug === 'final-makrab-02' && (
        <section className="notice stack-sm" aria-label="Titik kumpul">
          <strong>Titik kumpul: Indomaret Podomoro</strong>
          <p>{prettyDate(event.final_date!)} pukul 13.00 WIB</p>
        </section>
      )}
      <section className="card stack" id="payment" aria-label="Pembayaran">
        <span className="eyebrow">PEMBAYARAN</span>
        <h2>
          {rupiah(amount)} <small className="muted">/ orang</small>
        </h2>
        <div className="divider" />
        {event.stage2_deadline && <p>Batas pembayaran: {prettyDate(event.stage2_deadline)}</p>}
        <p>{event.payment_note}</p>
      </section>
      {payment && (
        <div className="notice">
          <strong>
            {
              {
                PENDING: 'Bukti diterima, menunggu verifikasi',
                VERIFIED: 'Pembayaran terverifikasi ✓',
                REJECTED: 'Bukti perlu diperbaiki',
              }[payment.status as 'PENDING' | 'VERIFIED' | 'REJECTED']
            }
          </strong>
          {payment.status === 'REJECTED' && <p>{payment.admin_note}</p>}
          {payment.payment_method && <p>Tujuan transfer: {payment.payment_method}</p>}
          <br />
          <Link className="text-link" href={`/e/${slug}/thank-you`}>
            Lihat status pembayaran
          </Link>
        </div>
      )}
      {event.status === 'STAGE_2_OPEN' &&
        (!payment || payment.status === 'REJECTED') &&
        (!event.stage2_deadline || new Date(event.stage2_deadline) > new Date()) && (
          <section className="stack">
            <h2>Kirim bukti pembayaran</h2>
            <p>Bukti hanya bisa dilihat organizer, tersimpan secara private.</p>
            <PaymentUpload
              eventId={event.id}
              slug={slug}
              amount={amount}
              methods={paymentMethods(event)}
            />
          </section>
        )}
      <div>
        <CopyButton
          value={`${appOrigin()}/e/${slug}/p/${p.token}`}
          label="Simpan link akses pribadi"
        />
      </div>
    </main>
  );
}
