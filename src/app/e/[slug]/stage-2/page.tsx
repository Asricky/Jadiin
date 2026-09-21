import { TransportPicker } from '@/components/transport-picker';
import { appOrigin } from '@/lib/app-origin';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { publicEvent, bundle } from '@/lib/server';
import { session } from '@/lib/session';
import { service } from '@/lib/supabase/server';
import { prettyDate, rupiah } from '@/lib/utils';
import { CopyButton } from '@/components/common';
import { VillaCard } from '@/components/villa-card';
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
      .select('status,admin_note,amount')
      .eq('participant_id', p.id)
      .eq('event_id', event.id)
      .maybeSingle(),
  ]);
  const villa = data.villas.find((v) => v.id === event.final_villa_id);
  const amount = payment && payment.status !== 'REJECTED' ? payment.amount : event.cost_per_person!;
  return (
    <main className="narrow section stack">
      <span className="eyebrow">{event.name}</span>
      <h1>{event.status === 'COMPLETED' ? 'Acara selesai' : 'Rencana final'}</h1>
      <p>{p.name}, berikut tanggal, tempat, transport, dan biaya acara.</p>
      <section className="card card-lime">
        <small className="eyebrow">CATAT TANGGALNYA</small>
        <h2 style={{ marginTop: 12 }}>
          {prettyDate(event.final_date!)} - {prettyDate(event.final_end_date!)}
        </h2>
      </section>
      {villa && <VillaCard villa={villa} images={data.images} />}
      <TransportPicker
        slug={slug}
        initial={{
          groups: data.groups,
          members: data.members,
          participants: data.participants.map((p) => ({ id: p.id, name: p.name })),
          participantId: p.id,
          open: event.status === 'STAGE_2_OPEN',
        }}
      />
      <section className="card stack">
        <span className="eyebrow">02 / PEMBAYARAN</span>
        <h2>
          {rupiah(amount)} <small className="muted">/ orang</small>
        </h2>
        <div className="divider" />
        <div>
          <h3>{event.bank_name}</h3>
          <p style={{ fontSize: 23, letterSpacing: 1 }}>{event.bank_account_number}</p>
          <p>a.n. {event.bank_account_holder}</p>
        </div>
        <div>
          <CopyButton value={event.bank_account_number!} label="Salin nomor rekening" />
        </div>
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
            <PaymentUpload eventId={event.id} slug={slug} amount={amount} />
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
