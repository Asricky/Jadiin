'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { ArrowLeft, Plus, Users, Car, Wallet, CalendarDays, ExternalLink } from 'lucide-react';
import type { Bundle, Participant, Status, Villa } from '@/types/domain';
import { statusLabel } from '@/types/domain';
import { api, prettyDate, rupiah, inputDateTime, mediaUrl } from '@/lib/utils';
import { Button } from './ui/button';
import { CopyButton, Notice, UploadField } from './common';
import { PlanningAnalytics } from './analytics';
import { DatesEditor, VillaEditor } from './editors';
import { Transport } from './transport';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
const tabs = [
  ['overview', 'Ringkasan'],
  ['participants', 'Peserta'],
  ['dates', 'Tanggal'],
  ['villas', 'Villa'],
  ['transport', 'Transport'],
  ['payments', 'Pembayaran'],
  ['settings', 'Pengaturan'],
];
export function EventManager({ data, tab, appUrl }: { data: Bundle; tab: string; appUrl: string }) {
  const router = useRouter();
  const event = data.event;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Villa | undefined>();
  const [addVilla, setAddVilla] = useState(false);
  const [access, setAccess] = useState('');
  const locked = ['COMPLETED', 'ARCHIVED'].includes(event.status);
  const eventUrl = `${appUrl}/e/${event.slug}`;
  useEffect(() => {
    QRCode.toDataURL(eventUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#245844', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => {});
  }, [eventUrl]);
  async function act(action: string, payload: object) {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const result = await api(`/api/admin/events/${event.id}`, { action, data: payload });
      setSuccess('Perubahan tersimpan.');
      router.refresh();
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function transition(status: Status) {
    const message =
      status === 'STAGE_1_CLOSED'
        ? 'Participant tidak dapat mengirim atau mengubah Stage 1 setelah ditutup. Lanjutkan?'
        : `Ubah status menjadi ${statusLabel[status]}?`;
    if (confirm(message)) await act('status', { status });
  }
  const paid = data.payments.filter((p) => p.status === 'VERIFIED').length;
  const next: Partial<Record<Status, [Status, string]>> = {
    DRAFT: ['STAGE_1_OPEN', 'Publish acara'],
    STAGE_1_OPEN: ['STAGE_1_CLOSED', 'Tutup Stage 1'],
    STAGE_1_CLOSED: ['STAGE_2_OPEN', 'Publish Stage 2'],
    STAGE_2_OPEN: ['COMPLETED', 'Selesaikan acara'],
    COMPLETED: ['ARCHIVED', 'Arsipkan acara'],
  };
  return (
    <main className="container section stack">
      <Link href="/admin/events" className="row muted" style={{ fontSize: 12 }}>
        <ArrowLeft size={14} />
        Semua acara
      </Link>
      <div className="row between">
        <div className="stack-sm">
          <span className={`badge badge-${event.status}`} style={{ alignSelf: 'start' }}>
            {statusLabel[event.status]}
          </span>
          <h1 style={{ fontSize: 'clamp(28px,4vw,42px)' }}>{event.name}</h1>
        </div>
        <div className="row">
          {event.status !== 'DRAFT' && event.status !== 'ARCHIVED' && (
            <CopyButton value={eventUrl} />
          )}
          {next[event.status] && (
            <Button disabled={busy} onClick={() => void transition(next[event.status]![0])}>
              {next[event.status]![1]}
            </Button>
          )}
        </div>
      </div>
      <div className="split-admin">
        <nav className="side-nav" aria-label="Menu acara">
          {tabs.map(([key, label]) => (
            <Link
              href={`/admin/events/${event.id}/${key}`}
              key={key}
              className={tab === key ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="stack">
          <Notice error>{error}</Notice>
          <Notice>{success}</Notice>
          {tab === 'overview' && (
            <>
              <div className="grid grid-3 stats-grid">
                {[
                  [Users, data.participants.length, 'Jawaban Stage 1'],
                  [
                    Car,
                    data.participants.filter((p) => p.vehicle_type === 'CAR').length,
                    'Mobil tersedia',
                  ],
                  [Wallet, `${paid}/${data.participants.length}`, 'Pembayaran terverifikasi'],
                ].map(([Icon, n, label]) => {
                  const I = Icon as typeof Users;
                  return (
                    <div className="card" key={String(label)}>
                      <I size={19} color="#859579" />
                      <div className="stat">{String(n)}</div>
                      <span className="stat-label">{String(label)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="card card-lime row between">
                <div className="stack-sm">
                  <h3>
                    {event.status === 'DRAFT'
                      ? 'Rencana kamu hampir siap.'
                      : 'Ajak teman ikut merencanakan.'}
                  </h3>
                  <p style={{ fontSize: 13 }}>
                    {event.status === 'DRAFT'
                      ? `${data.dates.length} kandidat tanggal · ${data.villas.filter((v) => v.active).length} villa aktif. Lengkapi keduanya lalu publish.`
                      : eventUrl}
                  </p>
                  {event.status !== 'DRAFT' && (
                    <div className="row">
                      <CopyButton value={eventUrl} />
                      <a
                        href={eventUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="button button-outline"
                      >
                        Preview <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                </div>
                {qr && event.status !== 'DRAFT' && (
                  <img src={qr} alt="QR link acara" width={112} height={112} />
                )}
              </div>
              {event.status === 'STAGE_1_CLOSED' && <Finalization data={data} act={act} />}
              <PlanningAnalytics data={data} admin />
            </>
          )}
          {tab === 'dates' && (
            <>
              {event.status === 'DRAFT' && (
                <DatesEditor
                  eventId={event.id}
                  dates={data.dates}
                  onDone={() => router.refresh()}
                />
              )}
              <PlanningAnalytics data={data} admin />
            </>
          )}
          {tab === 'villas' && (
            <>
              <div className="row between">
                <h2>Tempat untuk berkumpul</h2>
                {!locked && event.status !== 'STAGE_2_OPEN' && (
                  <Button
                    onClick={() => {
                      setEditing(undefined);
                      setAddVilla(!addVilla);
                    }}
                  >
                    <Plus size={16} />
                    Tambah villa
                  </Button>
                )}
              </div>
              {(addVilla || editing) && (
                <VillaEditor
                  key={editing?.id || 'new'}
                  eventId={event.id}
                  villa={editing}
                  onDone={() => {
                    setEditing(undefined);
                    setAddVilla(false);
                    router.refresh();
                  }}
                />
              )}
              {data.villas.map((v) => (
                <div className="card stack-sm" key={v.id}>
                  <div className="row between">
                    <h3>{v.name}</h3>
                    <span className="pill">
                      {v.active ? 'Aktif' : 'Nonaktif'} · urutan {v.sort_order}
                    </span>
                  </div>
                  <p>
                    {rupiah(v.price)} · {v.capacity} orang ·{' '}
                    {data.votes.filter((x) => x.villa_id === v.id).length} suara
                  </p>
                  <div className="gallery">
                    {data.images
                      .filter((image) => image.villa_id === v.id)
                      .map((image) => (
                        <div key={image.id} className="stack-sm" style={{ minWidth: 170 }}>
                          <img src={mediaUrl(image.storage_path)!} alt={v.name} loading="lazy" />
                          {!locked && event.status !== 'STAGE_2_OPEN' && (
                            <div className="row">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void act('cover_image', { id: image.id })}
                              >
                                Jadikan cover
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm('Hapus foto ini?'))
                                    void act('delete_image', { id: image.id });
                                }}
                              >
                                Hapus foto
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                  <p style={{ fontSize: 12 }}>
                    Pemilih:{' '}
                    {data.participants
                      .filter((p) =>
                        data.votes.some(
                          (vote) => vote.villa_id === v.id && vote.participant_id === p.id,
                        ),
                      )
                      .map((p) => p.name)
                      .join(', ') || 'Belum ada'}
                  </p>
                  {!locked && event.status !== 'STAGE_2_OPEN' && (
                    <div className="row">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(v);
                          setAddVilla(false);
                        }}
                      >
                        Edit & galeri
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void act('villa', { ...v, active: !v.active })}
                      >
                        {v.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (
                            confirm(
                              `Hapus ${v.name}? Villa yang sudah dipilih peserta tidak dapat dihapus.`,
                            )
                          )
                            void act('delete_villa', { id: v.id });
                        }}
                      >
                        Hapus
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {!data.villas.length && !addVilla && (
                <div className="empty">Belum ada villa. Tambahkan pilihan pertama.</div>
              )}
            </>
          )}
          {tab === 'transport' && (
            <>
              <Notice>
                {event.status !== 'STAGE_1_CLOSED'
                  ? 'Transport dapat diatur setelah Stage 1 ditutup.'
                  : ''}
              </Notice>
              <Transport data={data} act={act} locked={event.status !== 'STAGE_1_CLOSED'} />
            </>
          )}
          {tab === 'participants' && (
            <>
              <div className="row between">
                <h2>{data.participants.length} teman ikut</h2>
                <span className="pill">Semua sudah submit Stage 1</span>
              </div>
              <div className="grid grid-2">
                <input
                  className="input"
                  placeholder="Cari nama atau WhatsApp"
                  aria-label="Cari peserta"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  className="input"
                  aria-label="Filter peserta"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Semua peserta</option>
                  <option value="CAR">Mobil</option>
                  <option value="MOTORCYCLE">Motor</option>
                  <option value="NONE">Tidak ada kendaraan</option>
                  <option value="PENDING">Pembayaran pending</option>
                  <option value="VERIFIED">Pembayaran verified</option>
                  <option value="REJECTED">Pembayaran rejected</option>
                  <option value="NOT_SUBMITTED">Belum bayar</option>
                </select>
              </div>
              {access && (
                <div className="card stack-sm">
                  <p>Link baru sudah dibuat. Link lama langsung tidak berlaku.</p>
                  <CopyButton value={access} label="Salin link akses baru" />
                </div>
              )}
              <div className="card table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Peserta / WhatsApp</th>
                      <th>Kendaraan</th>
                      <th>Stage 2 / Payment</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.participants
                      .filter(
                        (p) =>
                          `${p.name} ${p.whatsapp}`.toLowerCase().includes(query.toLowerCase()) &&
                          (!filter ||
                            p.vehicle_type === filter ||
                            (data.payments.find((x) => x.participant_id === p.id)?.status ||
                              'NOT_SUBMITTED') === filter),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                            <br />
                            <a
                              className="text-link"
                              href={`https://wa.me/${p.whatsapp}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {p.whatsapp}
                            </a>
                          </td>
                          <td>
                            {
                              { CAR: 'Mobil', MOTORCYCLE: 'Motor', NONE: 'Tidak ada' }[
                                p.vehicle_type
                              ]
                            }
                          </td>
                          <td>
                            {p.stage2_submitted_at ? 'Sudah submit' : 'Belum submit'}
                            <br />
                            {data.payments.find((x) => x.participant_id === p.id)?.status ||
                              'Belum bayar'}
                          </td>
                          <td>
                            <div className="row">
                              {!locked && (
                                <>
                                  <ParticipantEdit p={p} act={act} />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      if (
                                        confirm('Buat link akses baru? Link lama akan dicabut.')
                                      ) {
                                        const r = await act('rotate_token', { id: p.id });
                                        if (r?.access_url) setAccess(r.access_url);
                                      }
                                    }}
                                  >
                                    Reset akses
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm(`Hapus jawaban ${p.name}?`))
                                        void act('delete_participant', { id: p.id });
                                    }}
                                  >
                                    Hapus
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!data.participants.length && (
                  <div className="empty">
                    Belum ada peserta. Bagikan link untuk mengumpulkan jawaban.
                  </div>
                )}
              </div>
            </>
          )}
          {tab === 'payments' && (
            <>
              <h2>Patungan, tercatat rapi.</h2>
              <div className="grid grid-3 stats-grid">
                {[
                  ['Terverifikasi', paid],
                  ['Menunggu', data.payments.filter((p) => p.status === 'PENDING').length],
                  ['Belum submit', data.participants.length - data.payments.length],
                ].map(([label, n]) => (
                  <div className="card" key={label}>
                    <div className="stat">{n}</div>
                    <span className="stat-label">{label}</span>
                  </div>
                ))}
              </div>
              {data.payments.map((p) => (
                <div className="card stack-sm" key={p.id}>
                  <div className="row between">
                    <h3>{data.participants.find((x) => x.id === p.participant_id)?.name}</h3>
                    <span className="pill">{p.status}</span>
                  </div>
                  <p>
                    {rupiah(p.amount)} · {prettyDate(p.submitted_at)}
                  </p>
                  {p.admin_note && <p>{p.admin_note}</p>}
                  <div className="row">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const r = await api(`/api/admin/payments/${p.id}`);
                          window.open(r.url, '_blank', 'noopener,noreferrer');
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Lihat / unduh bukti
                    </Button>
                    {event.status === 'STAGE_2_OPEN' && p.status === 'PENDING' && (
                      <>
                        <Button
                          onClick={() => {
                            if (confirm('Verifikasi pembayaran ini?'))
                              void act('payment_review', {
                                id: p.id,
                                status: 'VERIFIED',
                                admin_note: '',
                              });
                          }}
                        >
                          Verifikasi
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const note = prompt('Alasan penolakan:');
                            if (note)
                              void act('payment_review', {
                                id: p.id,
                                status: 'REJECTED',
                                admin_note: note,
                              });
                          }}
                        >
                          Tolak
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!data.payments.length && (
                <div className="empty">Belum ada bukti pembayaran yang masuk.</div>
              )}
            </>
          )}
          {tab === 'settings' && (
            <>
              <form
                className="card stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await act('settings', {
                    name: f.get('name'),
                    slug: f.get('slug'),
                    description: f.get('description'),
                    stage1_deadline: f.get('stage1_deadline'),
                    show_participant_list: f.get('show_participant_list') === 'on',
                    show_transport_groups: f.get('show_transport_groups') === 'on',
                  });
                }}
              >
                <h2>Detail acara</h2>
                {[
                  ['name', 'Nama acara'],
                  ['slug', 'Slug URL'],
                ].map(([n, l]) => (
                  <label key={n} className="field">
                    {l}
                    <input
                      disabled={locked}
                      name={n}
                      required
                      defaultValue={event[n as 'name' | 'slug']}
                    />
                  </label>
                ))}
                <label className="field">
                  Deskripsi
                  <textarea disabled={locked} name="description" defaultValue={event.description} />
                </label>
                <label className="field">
                  Deadline Stage 1 (WIB)
                  <input
                    disabled={locked}
                    type="datetime-local"
                    name="stage1_deadline"
                    defaultValue={inputDateTime(event.stage1_deadline)}
                  />
                </label>
                <label className="row">
                  <input
                    disabled={locked}
                    type="checkbox"
                    name="show_participant_list"
                    defaultChecked={event.show_participant_list}
                  />
                  Tampilkan daftar nama peserta
                </label>
                <label className="row">
                  <input
                    disabled={locked}
                    type="checkbox"
                    name="show_transport_groups"
                    defaultChecked={event.show_transport_groups}
                  />
                  Peserta dapat melihat semua kendaraan
                </label>
                <Button disabled={locked || busy}>Simpan pengaturan</Button>
              </form>
              {!locked && event.status !== 'STAGE_2_OPEN' && (
                <div className="card stack">
                  <h3>Cover acara</h3>
                  <UploadField eventId={event.id} kind="media" onDone={() => router.refresh()} />
                </div>
              )}
              <section className="card stack">
                <h3>Kontrol acara</h3>
                {event.status === 'STAGE_1_CLOSED' && (
                  <Button variant="outline" onClick={() => void transition('STAGE_1_OPEN')}>
                    Buka kembali Stage 1
                  </Button>
                )}
                {event.status === 'COMPLETED' && (
                  <Button variant="outline" onClick={() => void transition('STAGE_2_OPEN')}>
                    Buka kembali Stage 2
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const confirmation = prompt(
                      `Ketik nama acara untuk menghapus permanen: ${event.name}`,
                    );
                    if (confirmation === event.name) {
                      const result = await act('delete_event', { confirmation });
                      if (result) router.push('/admin/events');
                    }
                  }}
                >
                  Hapus event permanen
                </Button>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
function ParticipantEdit({
  p,
  act,
}: {
  p: Participant;
  act: (action: string, data: object) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">Edit peserta</DialogTitle>
        <DialogDescription>Perbarui identitas dan informasi kendaraan peserta.</DialogDescription>
        <form
          className="stack"
          style={{ marginTop: 20 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              await act('participant', {
                id: p.id,
                name: f.get('name'),
                whatsapp: f.get('whatsapp'),
                vehicle_type: f.get('vehicle_type'),
              })
            )
              setOpen(false);
          }}
        >
          <label className="field">
            Nama
            <input name="name" defaultValue={p.name} required />
          </label>
          <label className="field">
            WhatsApp
            <input name="whatsapp" defaultValue={p.whatsapp} required />
          </label>
          <label className="field">
            Kendaraan
            <select name="vehicle_type" defaultValue={p.vehicle_type}>
              <option value="CAR">Mobil</option>
              <option value="MOTORCYCLE">Motor</option>
              <option value="NONE">Tidak ada</option>
            </select>
          </label>
          <Button>Simpan peserta</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Finalization({
  data,
  act,
}: {
  data: Bundle;
  act: (action: string, data: object) => Promise<unknown>;
}) {
  const [step, setStep] = useState(0);
  const event = data.event;
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (!confirm('Simpan keputusan final villa, tanggal, dan pembayaran?')) return;
        await act('finalize', Object.fromEntries(f));
      }}
    >
      <span className="eyebrow">FINALISASI RENCANA</span>
      <h2>Saatnya bikin keputusan.</h2>
      <div className="stepper">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`step ${i <= step ? 'done' : ''}`} />
        ))}
      </div>
      <p style={{ fontSize: 12 }}>
        Langkah {step + 1}:{' '}
        {['Villa final', 'Tanggal final', 'Transport', 'Pembayaran', 'Review & simpan'][step]}
      </p>
      <div style={{ display: step === 0 ? 'block' : 'none' }}>
        <label className="field">
          Villa final
          <select
            name="final_villa_id"
            defaultValue={event.final_villa_id || data.villas.find((v) => v.active)?.id}
          >
            {data.villas
              .filter((v) => v.active)
              .map((v) => (
                <option value={v.id} key={v.id}>
                  {v.name} — {data.votes.filter((x) => x.villa_id === v.id).length} suara
                </option>
              ))}
          </select>
        </label>
      </div>
      <div style={{ display: step === 1 ? 'block' : 'none' }}>
        <label className="field">
          Tanggal final
          <select name="final_date" defaultValue={event.final_date || data.dates[0]?.date}>
            {data.dates.map((d) => (
              <option value={d.date} key={d.id}>
                {prettyDate(d.date)} —{' '}
                {data.availability.filter((x) => x.event_date_id === d.id).length} bisa
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: step === 2 ? 'block' : 'none' }}>
        <p>
          {data.members.length} dari {data.participants.length} peserta mendapat transport.
        </p>
        <Link className="text-link" href={`/admin/events/${event.id}/transport`}>
          Susun kendaraan dan transport mandiri
        </Link>
      </div>
      <div className="stack-sm" style={{ display: step === 3 ? 'flex' : 'none' }}>
        {[
          ['cost_per_person', 'Biaya per orang (Rp)', 'number'],
          ['bank_name', 'Nama bank', 'text'],
          ['bank_account_number', 'Nomor rekening', 'text'],
          ['bank_account_holder', 'Nama pemilik rekening', 'text'],
          ['stage2_deadline', 'Deadline pembayaran (WIB, opsional)', 'datetime-local'],
        ].map(([name, label, type]) => (
          <label className="field" key={name}>
            {label}
            <input
              name={name}
              type={type}
              defaultValue={
                name === 'stage2_deadline'
                  ? inputDateTime(event.stage2_deadline)
                  : String(event[name as keyof typeof event] ?? '')
              }
            />
          </label>
        ))}
        <label className="field">
          Catatan pembayaran
          <textarea name="payment_note" defaultValue={event.payment_note || ''} />
        </label>
      </div>
      {step === 4 && (
        <div className="notice">
          Simpan keputusan final, lalu klik “Publish Stage 2” di atas. Semua peserta harus mendapat
          transport terlebih dahulu.
        </div>
      )}
      <div className="row between">
        <Button variant="ghost" type="button" disabled={!step} onClick={() => setStep(step - 1)}>
          Kembali
        </Button>
        {step < 4 ? (
          <Button key="next-step" type="button" onClick={() => setStep(step + 1)}>
            Lanjut
          </Button>
        ) : (
          <Button key="save-final" type="submit">
            <CalendarDays size={16} />
            Simpan keputusan final
          </Button>
        )}
      </div>
    </form>
  );
}
