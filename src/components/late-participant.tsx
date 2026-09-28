'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CopyButton } from './common';
export function LateParticipant({
  act,
}: {
  act: (action: string, data: object) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  return (
    <section className="card stack-sm">
      <div className="row between">
        <div>
          <h3>Peserta susulan</h3>
          <p className="text-sm">
            Belum mengisi tahap 1? Tambahkan di sini agar masuk daftar transport dan pembayaran.
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen(!open)}>
          {open ? 'Tutup' : 'Tambah peserta'}
        </Button>
      </div>
      {open && (
        <form
          className="stack-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setLink('');
            try {
              const result = (await act(
                'add_participant',
                Object.fromEntries(new FormData(form)),
              )) as { access_url?: string } | null;
              if (result?.access_url) {
                setLink(result.access_url);
                form.reset();
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid grid-2">
            <label className="field">
              Nama peserta susulan
              <Input name="name" required minLength={2} maxLength={80} />
            </label>
            <label className="field">
              WhatsApp peserta susulan
              <Input name="whatsapp" type="tel" required placeholder="08..." />
            </label>
            <label className="field">
              Kendaraan peserta susulan
              <select name="vehicle_type">
                <option value="NONE">Tidak membawa kendaraan</option>
                <option value="CAR">Mobil · 5 kursi</option>
                <option value="MOTORCYCLE">Motor · 2 kursi</option>
              </select>
            </label>
          </div>
          <p className="text-sm">
            Jika membawa kendaraan, nama peserta menjadi usulan pemilik dan driver. Kapasitas dan
            driver bisa disesuaikan saat menambahkan kendaraan.
          </p>
          <Button disabled={busy}>{busy ? 'Menambahkan...' : 'Simpan peserta susulan'}</Button>
        </form>
      )}
      {link && (
        <div className="notice stack-sm">
          <strong>
            Peserta ditambahkan. Bagikan link pribadi ini untuk memilih transport dan membayar.
          </strong>
          <CopyButton value={link} label="Salin link peserta susulan" />
          <small>Link ini memberi akses ke data peserta. Bagikan hanya kepada pemiliknya.</small>
        </div>
      )}
    </section>
  );
}
