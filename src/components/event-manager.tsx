'use client';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Plus,
  Users,
  Car,
  Wallet,
  CalendarDays,
  ExternalLink,
  LayoutGrid,
  Settings2,
  House,
} from 'lucide-react';
import type { Bundle, Participant, Status, Villa } from '@/types/domain';
import { PhaseTimeline, phases } from './phase-timeline';
import { analytics } from '@/lib/planning';
import { statusLabel } from '@/types/domain';
import { api, prettyDate, rupiah, inputDateTime } from '@/lib/utils';
import { Button } from './ui/button';
import { CopyButton, Notice, UploadField } from './common';
import { PlanningAnalytics } from './analytics';
import { DatesEditor, VillaEditor } from './editors';
import { VillaCard } from './villa-card';
import { PaymentsPanel } from './payments-panel';
import { TransportRoster } from './transport-roster';
import { Transport } from './transport';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
const tabs: [string, string, typeof Users][] = [
  ['overview', 'Ringkasan', LayoutGrid],
  ['participants', 'Peserta', Users],
  ['dates', 'Tanggal', CalendarDays],
  ['villas', 'Villa', House],
  ['transport', 'Transport', Car],
  ['payments', 'Pembayaran', Wallet],
  ['settings', 'Pengaturan', Settings2],
];
export function EventManager({ data, tab, appUrl }: { data: Bundle; tab: string; appUrl: string }) {
  const router = useRouter();
  const event = data.event;
  useEffect(() => {
    if (event.status !== 'STAGE_2_OPEN') return;
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [router, event.status]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Villa | undefined>();
  const [addVilla, setAddVilla] = useState(false);
  const [access, setAccess] = useState('');
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const locked = ['COMPLETED', 'ARCHIVED'].includes(event.status);
  const eventUrl = `${appUrl}/e/${event.slug}`;
  useEffect(() => {
    QRCode.toDataURL(eventUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#23483f', light: '#ffffff' },
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
  function transition(status: Status) {
    setPendingStatus(status);
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
      <div className="row between event-heading">
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
      <PhaseTimeline status={event.status} onBack={transition} disabled={busy} />
      <Dialog
        open={!!pendingStatus}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
      >
        <DialogContent>
          <div className="stack">
            <DialogTitle className="text-xl font-semibold">Ubah fase acara?</DialogTitle>
            <DialogDescription>
              {pendingStatus &&
              phases.findIndex((p) => p.status === pendingStatus) <
                phases.findIndex((p) => p.status === event.status)
                ? 'Acara kembali ke fase sebelumnya. Jawaban, transport, dan pembayaran tetap tersimpan. Peserta mengikuti akses fase yang dibuka. Deadline voting yang sudah lewat akan dikosongkan saat voting dibuka kembali.'
                : 'Pastikan pengaturan sudah sesuai sebelum melanjutkan. Setelah voting ditutup, peserta tidak bisa mengubah jawaban.'}
            </DialogDescription>
            <p>
              Fase tujuan: <strong>{pendingStatus ? statusLabel[pendingStatus] : ''}</strong>
            </p>
            <div className="row">
              <Button variant="outline" onClick={() => setPendingStatus(null)}>
                Batal
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (pendingStatus && (await act('status', { status: pendingStatus })))
                    setPendingStatus(null);
                }}
              >
                Ya, ubah fase
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <div className="split-admin">
        <nav className="side-nav" aria-label="Menu acara">
          {tabs.map(([key, label, Icon]) => (
            <Link
              href={`/admin/events/${event.id}/${key}`}
              key={key}
              className={tab === key ? 'active' : ''}
            >
              <Icon size={17} />
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
                    ['STAGE_1_CLOSED', 'STAGE_2_OPEN', 'COMPLETED'].includes(event.status)
                      ? data.groups.filter((g) => g.type !== 'INDEPENDENT').length
                      : data.participants.filter((p) => p.vehicle_type !== 'NONE').length,
                    ['STAGE_1_CLOSED', 'STAGE_2_OPEN', 'COMPLETED'].includes(event.status)
                      ? 'Kendaraan disiapkan'
                      : 'Usulan kendaraan',
                  ],
                  [Wallet, `${paid}/${data.participants.length}`, 'Pembayaran terverifikasi'],
                ].map(([Icon, n, label]) => {
                  const I = Icon as typeof Users;
                  return (
                    <div className="card" key={String(label)}>
                      <I size={20} className="stat-icon" />
                      <div className="stat">{String(n)}</div>
                      <span className="stat-label">{String(label)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="card card-lime row between">
                <div className="stack-sm">
                  <h3>{event.status === 'DRAFT' ? 'Persiapan acara' : 'Link peserta'}</h3>
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
              <PlanningAnalytics data={data} admin details={false} />
              {['STAGE_1_CLOSED', 'STAGE_2_OPEN', 'COMPLETED'].includes(event.status) && (
                <TransportRoster data={data} />
              )}
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
                <h2>Pilihan villa</h2>
                {!locked && event.status !== 'STAGE_2_OPEN' && !addVilla && !editing && (
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
                  images={data.images}
                  onDone={() => {
                    setEditing(undefined);
                    setAddVilla(false);
                    router.refresh();
                  }}
                />
              )}
              {!addVilla &&
                !editing &&
                data.villas.map((v) => (
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
                    <VillaCard villa={v} images={data.images} />
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
                {!['STAGE_1_CLOSED', 'STAGE_2_OPEN'].includes(event.status)
                  ? 'Transport dapat diatur setelah Stage 1 ditutup.'
                  : ''}
              </Notice>
              <Transport
                data={data}
                act={act}
                locked={!['STAGE_1_CLOSED', 'STAGE_2_OPEN'].includes(event.status)}
              />
            </>
          )}
          {tab === 'participants' && (
            <>
              <div className="row between">
                <h2>{data.participants.length} teman ikut</h2>
                <span className="pill">Semua sudah submit Stage 1</span>
              </div>
              <div className="grid grid-2">
                <Input
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
          {tab === 'payments' && <PaymentsPanel data={data} act={act} locked={locked} />}
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
                    show_transport_groups: true,
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
                    <Input
                      disabled={locked}
                      name={n}
                      required
                      defaultValue={event[n as 'name' | 'slug']}
                    />
                  </label>
                ))}
                <label className="field">
                  Deskripsi
                  <Textarea disabled={locked} name="description" defaultValue={event.description} />
                </label>
                <label className="field">
                  Deadline Stage 1 (WIB)
                  <Input
                    disabled={locked}
                    type="datetime-local"
                    name="stage1_deadline"
                    defaultValue={inputDateTime(event.stage1_deadline)}
                  />
                </label>
                <label className="row">
                  <Input
                    disabled={locked}
                    type="checkbox"
                    name="show_participant_list"
                    defaultChecked={event.show_participant_list}
                  />
                  Tampilkan daftar nama peserta
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
            <Input name="name" defaultValue={p.name} required />
          </label>
          <label className="field">
            WhatsApp
            <Input name="whatsapp" defaultValue={p.whatsapp} required />
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
  const [saving, setSaving] = useState(false);
  const event = data.event;
  const pairs = analytics(data).datePairs;
  return (
    <section className="finalization-panel stack">
      <div>
        <span className="eyebrow">SEBELUM STAGE 2</span>
        <h2>Siapkan rencana keberangkatan</h2>
        <p>Lengkapi tiga bagian ini. Peserta memilih sendiri kursinya setelah Stage 2 dibuka.</p>
      </div>
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setSaving(true);
          try {
            await act('finalize', Object.fromEntries(f));
          } finally {
            setSaving(false);
          }
        }}
      >
        <h3>1. Tetapkan villa & tanggal</h3>
        <div className="grid grid-2">
          <label className="field">
            Villa final
            <select
              name="final_villa_id"
              defaultValue={event.final_villa_id || data.villas.find((v) => v.active)?.id}
              required
            >
              {data.villas
                .filter((v) => v.active)
                .map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Tanggal final
            <select
              name="final_date"
              defaultValue={event.final_date || pairs[0]?.start.date}
              required
            >
              {pairs.map((pair) => (
                <option value={pair.start.date} key={pair.start.id}>
                  {prettyDate(pair.start.date)} - {prettyDate(pair.end.date)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button disabled={saving || !pairs.length}>
          <CalendarDays size={16} />
          {saving ? 'Menyimpan...' : 'Simpan keputusan final'}
        </Button>
      </form>
      <div className="grid grid-2">
        <Link className="setup-link" href={`/admin/events/${event.id}/transport`}>
          <Car size={22} />
          <h3>2. Siapkan kendaraan</h3>
          <p>
            {data.groups.filter((g) => g.type !== 'INDEPENDENT').length} kendaraan tersedia.
            Tetapkan driver dan kapasitas; kursi penumpang dipilih peserta.
          </p>
          <span>
            Kelola transport <ExternalLink size={14} />
          </span>
        </Link>
        <Link className="setup-link" href={`/admin/events/${event.id}/payments`}>
          <Wallet size={22} />
          <h3>3. Biaya & rekening</h3>
          <p>
            {event.cost_per_person === null
              ? 'Nominal belum diatur.'
              : `${rupiah(event.cost_per_person)} per orang.`}{' '}
            {event.bank_name || 'Tambahkan rekening tujuan.'}
          </p>
          <span>
            Atur pembayaran <ExternalLink size={14} />
          </span>
        </Link>
      </div>
    </section>
  );
}
