'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/utils';
import type { Participant, PaymentMethod } from '@/types/domain';
import { PaymentUpload } from './payment-upload';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Details = Pick<
  Participant,
  'name' | 'whatsapp' | 'vehicle_type' | 'vehicle_owner' | 'vehicle_driver' | 'vehicle_capacity'
>;

export function PaymentRegistration({
  eventId,
  slug,
  amount,
  methods,
  participant,
}: {
  eventId: string;
  slug: string;
  amount: number;
  methods: PaymentMethod[];
  participant: Details | null;
}) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState(participant?.vehicle_type || '');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(participant?.name || '');
  return (
    <div className="stack">
      {!confirmed ? (
        <section className="card stack">
          <span className="eyebrow">01 / NAMA & KENDARAAN</span>
          <h2>
            {participant ? 'Konfirmasi kembali data peserta' : 'Daftar peserta & lanjut bayar'}
          </h2>
          <p>
            {participant
              ? 'Periksa nama dan kendaraanmu sebelum mengirim bukti pembayaran.'
              : 'Belum mengisi form awal? Kamu bisa langsung mendaftar di sini.'}
          </p>
          {!participant && (
            <p className="text-sm muted">
              Sudah pernah daftar? Gunakan link akses pribadimu agar pembayaran masuk ke pendaftaran
              yang sama.
            </p>
          )}
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const form = new FormData(event.currentTarget);
              setBusy(true);
              setError('');
              try {
                await api(`/api/events/${slug}/payment-participant`, {
                  ...Object.fromEntries(form),
                  vehicle_capacity: vehicle === 'NONE' ? 1 : Number(form.get('vehicle_capacity')),
                  confirmed: form.get('confirmed') === 'on',
                });
                setConfirmed(true);
                router.refresh();
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="stack">
              <label className="field">
                Nama lengkap
                <Input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
              <label className="field">
                Nomor WhatsApp
                <Input
                  name="whatsapp"
                  type="tel"
                  defaultValue={participant?.whatsapp || ''}
                  required
                  placeholder="08..."
                  autoComplete="tel"
                />
              </label>
              <label className="field">
                Konfirmasi kendaraan
                <select
                  name="vehicle_type"
                  value={vehicle}
                  onChange={(event) => setVehicle(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Pilih kendaraanmu
                  </option>
                  <option value="NONE">Tidak membawa kendaraan</option>
                  <option value="CAR">Membawa mobil</option>
                  <option value="MOTORCYCLE">Membawa motor</option>
                </select>
              </label>
              {vehicle && vehicle !== 'NONE' && (
                <div className="stack-sm" key={vehicle}>
                  <label className="field">
                    Nama pemilik kendaraan
                    <Input
                      name="vehicle_owner"
                      defaultValue={
                        participant?.vehicle_type === vehicle
                          ? participant.vehicle_owner || name
                          : name
                      }
                      required
                      maxLength={80}
                    />
                  </label>
                  <label className="field">
                    Nama pengemudi
                    <Input
                      name="vehicle_driver"
                      defaultValue={
                        participant?.vehicle_type === vehicle
                          ? participant.vehicle_driver || name
                          : name
                      }
                      required
                      maxLength={80}
                    />
                  </label>
                  <label className="field">
                    Kapasitas termasuk pengemudi
                    <Input
                      name="vehicle_capacity"
                      type="number"
                      min={1}
                      max={vehicle === 'MOTORCYCLE' ? 2 : 50}
                      defaultValue={
                        participant?.vehicle_type === vehicle
                          ? participant.vehicle_capacity || (vehicle === 'MOTORCYCLE' ? 2 : 5)
                          : vehicle === 'MOTORCYCLE'
                            ? 2
                            : 5
                      }
                      required
                    />
                  </label>
                </div>
              )}
              <label className="row text-sm">
                <input type="checkbox" name="confirmed" required />
                Saya sudah memastikan nama dan informasi kendaraan di atas benar.
              </label>
            </fieldset>
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={busy}>
              {busy ? 'Menyimpan...' : 'Konfirmasi & lanjut ke pembayaran'}
            </Button>
          </form>
        </section>
      ) : (
        <>
          <div className="notice stack-sm" role="status">
            <strong>Data {name} sudah dikonfirmasi.</strong>
            <p>
              {vehicle === 'CAR'
                ? 'Membawa mobil'
                : vehicle === 'MOTORCYCLE'
                  ? 'Membawa motor'
                  : 'Tidak membawa kendaraan'}
            </p>
            <Button type="button" variant="outline" onClick={() => setConfirmed(false)}>
              Ubah data peserta
            </Button>
          </div>
          <section className="stack" aria-label="Unggah bukti pembayaran">
            <span className="eyebrow">02 / BUKTI PEMBAYARAN</span>
            <h2>Kirim bukti pembayaran</h2>
            <p>Bukti hanya bisa dilihat organizer, tersimpan secara private.</p>
            <PaymentUpload eventId={eventId} slug={slug} amount={amount} methods={methods} />
          </section>
        </>
      )}
    </div>
  );
}
