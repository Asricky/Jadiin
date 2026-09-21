'use client';
import { useState } from 'react';
import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { api } from '@/lib/utils';
import { Notice, UploadField } from './common';
import { Button } from './ui/button';
import type { EventDate, Villa } from '@/types/domain';
export function DatesEditor({
  eventId,
  dates,
  onDone,
}: {
  eventId: string;
  dates: EventDate[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(dates.map((d) => d.date));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="card stack">
      <h3>Pilih tanggal yang mungkin</h3>
      <p>Tambahkan rentang (maksimal 90 hari), atau pilih tanggal satu per satu.</p>
      <div className="grid grid-2">
        <label className="field">
          Dari tanggal
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          Sampai tanggal
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          const n = differenceInCalendarDays(parseISO(end || start), parseISO(start));
          if (!Number.isFinite(n) || n < 0 || n > 89) {
            setError('Pilih rentang 1–90 hari');
            return;
          }
          setSelected(
            [
              ...new Set([
                ...selected,
                ...Array.from({ length: n + 1 }, (_, i) =>
                  format(addDays(parseISO(start), i), 'yyyy-MM-dd'),
                ),
              ]),
            ].sort(),
          );
          setError('');
        }}
      >
        Tambahkan tanggal
      </Button>
      <div className="row">
        {selected.map((d) => (
          <button
            className="pill"
            key={d}
            onClick={() => setSelected(selected.filter((x) => x !== d))}
            aria-label={`Hapus ${d}`}
          >
            {d} ×
          </button>
        ))}
      </div>
      <Notice error>{error}</Notice>
      <Button
        disabled={busy || !selected.length}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/admin/events/${eventId}`, {
              action: 'dates',
              data: { dates: selected },
            });
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Menyimpan…' : 'Simpan tanggal'}
      </Button>
    </div>
  );
}
export function VillaEditor({
  eventId,
  villa,
  onDone,
}: {
  eventId: string;
  villa?: Villa;
  onDone: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState(villa?.id);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const f = new FormData(e.currentTarget);
        try {
          const result = await api(`/api/admin/events/${eventId}`, {
            action: 'villa',
            data: {
              id: savedId,
              name: f.get('name'),
              description: f.get('description'),
              price: Number(f.get('price')),
              capacity: Number(f.get('capacity')),
              address: f.get('address'),
              google_maps_url: f.get('google_maps_url'),
              facilities: String(f.get('facilities'))
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              notes: f.get('notes'),
              sort_order: Number(f.get('sort_order')),
              active: f.get('active') === 'on',
            },
          });
          setSavedId(result.id);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{villa ? 'Edit villa' : 'Tambah villa'}</h3>
      {[
        ['name', 'Nama villa', 'text'],
        ['price', 'Harga per malam (Rp)', 'number'],
        ['capacity', 'Kapasitas orang', 'number'],
        ['address', 'Alamat', 'text'],
        ['google_maps_url', 'Google Maps URL', 'url'],
        ['sort_order', 'Urutan', 'number'],
      ].map(([name, label, type]) => (
        <label key={name} className="field">
          {label}
          <input
            name={name}
            type={type}
            required={['name', 'price', 'capacity'].includes(name)}
            defaultValue={String(
              villa?.[name as keyof Villa] ??
                (name === 'capacity' ? 1 : name === 'price' || name === 'sort_order' ? 0 : ''),
            )}
          />
        </label>
      ))}
      <label className="field">
        Deskripsi
        <textarea name="description" defaultValue={villa?.description} />
      </label>
      <label className="field">
        Fasilitas (pisahkan dengan koma)
        <input
          name="facilities"
          defaultValue={villa?.facilities.join(', ')}
          placeholder="Kolam renang, BBQ, WiFi"
        />
      </label>
      <label className="field">
        Catatan
        <textarea name="notes" defaultValue={villa?.notes} />
      </label>
      <label className="row">
        <input type="checkbox" name="active" defaultChecked={villa?.active ?? true} />
        Aktif untuk voting
      </label>
      <Notice error>{error}</Notice>
      <Button disabled={busy} type="submit">
        {busy ? 'Menyimpan…' : 'Simpan villa'}
      </Button>
      {savedId && (
        <>
          <Notice>Villa tersimpan. Tambahkan foto untuk membantu teman memilih.</Notice>
          <UploadField
            eventId={eventId}
            kind="media"
            villaId={savedId}
            onDone={() => setError('')}
          />
          <Button type="button" variant="outline" onClick={onDone}>
            Selesai, kembali ke acara
          </Button>
        </>
      )}
    </form>
  );
}
