'use client';
import { useState } from 'react';
import { Wallet, ArrowDownLeft, Clock3, SlidersHorizontal, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { MoneyInput, parseMoney } from './money-input';
import { Notice } from './common';
import { paymentSummary } from '@/lib/billing';
import { api, rupiah, inputDateTime } from '@/lib/utils';
import type { Bundle } from '@/types/domain';
type Act = (action: string, data: object) => Promise<unknown>;
export function PaymentsPanel({ data, act, locked }: { data: Bundle; act: Act; locked: boolean }) {
  const summary = paymentSummary(data);
  const [editing, setEditing] = useState(
    data.event.cost_per_person === null || !data.event.bank_name,
  );
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const labels: Record<string, string> = {
    VERIFIED: 'Lunas',
    PENDING: 'Menunggu verifikasi',
    REJECTED: 'Perlu perbaikan',
    NOT_SUBMITTED: 'Belum bayar',
  };
  const frozen = summary.rows.filter((r) => ['PENDING', 'VERIFIED'].includes(r.status)).length;
  return (
    <div className="stack">
      <header>
        <span className="eyebrow">PATUNGAN ACARA</span>
        <h2>Pembayaran</h2>
        <p>Nominal, rekening, dan status setiap peserta dalam satu tempat.</p>
      </header>
      <section className="billing-settings card stack">
        <div className="row between">
          <div>
            <small className="muted">Biaya per peserta</small>
            <div className="billing-amount">
              {data.event.cost_per_person === null
                ? 'Belum diatur'
                : rupiah(data.event.cost_per_person)}
            </div>
            <p className="text-sm">
              {data.event.bank_name
                ? `${data.event.bank_name} · ${data.event.bank_account_number} · ${data.event.bank_account_holder}`
                : 'Tambahkan rekening tujuan sebelum membuka Stage 2.'}
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            <SlidersHorizontal size={16} />
            {editing ? 'Tutup pengaturan' : 'Ubah nominal & rekening'}
          </Button>
        </div>
        {editing && (
          <form
            key={`${data.event.cost_per_person}-${data.event.bank_account_number}`}
            className="stack billing-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const amount = parseMoney(f.get('cost_per_person'));
              if (
                frozen > 0 &&
                amount !== data.event.cost_per_person &&
                !confirm(
                  `Nominal baru berlaku bagi peserta yang belum mengirim bukti. ${frozen} pembayaran yang sudah masuk tetap memakai nominal sebelumnya. Simpan?`,
                )
              )
                return;
              setBusy(true);
              try {
                if (await act('billing', { ...Object.fromEntries(f), cost_per_person: amount }))
                  setEditing(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Biaya per orang (Rp)
              <MoneyInput
                name="cost_per_person"
                defaultValue={data.event.cost_per_person || 0}
                disabled={locked}
              />
            </label>
            <div className="grid grid-2">
              {[
                ['bank_name', 'Nama bank'],
                ['bank_account_number', 'Nomor rekening'],
                ['bank_account_holder', 'Nama pemilik rekening'],
              ].map(([name, label]) => (
                <label className="field" key={name}>
                  {label}
                  <Input
                    name={name}
                    required
                    disabled={locked}
                    defaultValue={String(data.event[name as keyof typeof data.event] || '')}
                  />
                </label>
              ))}
              <label className="field">
                Batas pembayaran (WIB)
                <Input
                  name="stage2_deadline"
                  type="datetime-local"
                  disabled={locked}
                  defaultValue={inputDateTime(data.event.stage2_deadline)}
                />
              </label>
            </div>
            <label className="field">
              Catatan pembayaran
              <Textarea
                name="payment_note"
                disabled={locked}
                defaultValue={data.event.payment_note || ''}
              />
            </label>
            <p className="text-sm">
              Perubahan nominal berlaku untuk peserta yang belum mengirim bukti atau perlu
              mengunggah ulang. Nominal pembayaran yang sedang diverifikasi atau sudah lunas tetap
              tersimpan.
            </p>
            <Button disabled={locked || busy}>
              {busy ? 'Menyimpan…' : 'Simpan biaya & rekening'}
            </Button>
          </form>
        )}
      </section>
      <div className="money-stats">
        {[
          [ArrowDownLeft, 'Sudah terverifikasi', summary.verified, 'received'],
          [Clock3, 'Menunggu verifikasi', summary.pending, 'pending'],
          [Wallet, 'Sisa belum terverifikasi', summary.outstanding, 'remaining'],
        ].map(([Icon, title, value, kind]) => {
          const I = Icon as typeof Wallet;
          return (
            <div className={`money-stat ${kind}`} key={String(title)}>
              <I size={20} />
              <span>{String(title)}</span>
              <strong>{rupiah(Number(value))}</strong>
            </div>
          );
        })}
      </div>
      <div className="row between">
        <p>
          Total tagihan <strong>{rupiah(summary.expected)}</strong> · {data.participants.length}{' '}
          peserta
        </p>
        <span className="pill">
          {summary.rows.filter((r) => r.status === 'VERIFIED').length} lunas
        </span>
      </div>
      <div className="payment-filters">
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="Cari pembayaran peserta"
            placeholder="Cari nama peserta"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="input"
          aria-label="Filter pembayaran"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">Semua status</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Notice error>{error}</Notice>
      <div className="payment-list">
        {summary.rows
          .filter(
            (r) =>
              (filter === 'ALL' || r.status === filter) &&
              r.participant.name.toLowerCase().includes(query.toLowerCase()),
          )
          .map(({ participant, payment, due, status }) => (
            <article className="payment-row" key={participant.id}>
              <div className="row">
                <span className="avatar">{participant.name.slice(0, 1)}</span>
                <div>
                  <strong>{participant.name}</strong>
                  <div className={`payment-status status-${status}`}>{labels[status]}</div>
                </div>
              </div>
              <div className="payment-row-amount">
                <strong>{rupiah(due)}</strong>
                {payment && status === 'REJECTED' && (
                  <small>Bukti sebelumnya: {rupiah(payment.amount)}</small>
                )}
              </div>
              {payment && (
                <div className="payment-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setError('');
                      try {
                        const r = await api(`/api/admin/payments/${payment.id}`);
                        window.open(r.url, '_blank', 'noopener,noreferrer');
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Lihat / unduh bukti
                  </Button>
                  {data.event.status === 'STAGE_2_OPEN' && status === 'PENDING' && (
                    <>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={async () => {
                          if (!confirm('Verifikasi pembayaran ini?')) return;
                          setBusy(true);
                          try {
                            await act('payment_review', {
                              id: payment.id,
                              status: 'VERIFIED',
                              admin_note: '',
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Verifikasi
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={async () => {
                          const note = prompt('Alasan penolakan:');
                          if (!note) return;
                          setBusy(true);
                          try {
                            await act('payment_review', {
                              id: payment.id,
                              status: 'REJECTED',
                              admin_note: note,
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Tolak
                      </Button>
                    </>
                  )}
                </div>
              )}
              {payment?.admin_note && <p className="payment-note">{payment.admin_note}</p>}
            </article>
          ))}
      </div>
      {!summary.rows.length && (
        <div className="empty">Daftar pembayaran muncul otomatis setelah peserta mengisi form.</div>
      )}
      {summary.rows.length > 0 &&
        !summary.rows.some(
          (r) =>
            (filter === 'ALL' || r.status === filter) &&
            r.participant.name.toLowerCase().includes(query.toLowerCase()),
        ) && <div className="empty">Tidak ada peserta yang sesuai pencarian.</div>}
    </div>
  );
}
