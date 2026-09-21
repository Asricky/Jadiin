'use client';
import { useState } from 'react';
import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { api, mediaUrl } from '@/lib/utils';
import { Notice, UploadField } from './common';
import { Button } from './ui/button';
import { Star, Trash2 } from 'lucide-react';
import { MoneyInput, parseMoney } from './money-input';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import type { EventDate, Villa, VillaImage } from '@/types/domain';
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
      <p>Tambahkan rentang maksimal 90 hari. Sertakan dua tanggal berurutan untuk acara 2 hari 1 malam.</p>
      <div className="grid grid-2">
        <label className="field">
          Dari tanggal
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          Sampai tanggal
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
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
  images = [],
  onDone,
}: {
  eventId: string;
  villa?: Villa;
  images?: VillaImage[];
  onDone: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState(villa?.id);
  const [photos, setPhotos] = useState(images.filter((i) => i.villa_id === villa?.id));
  const [cover, setCover] = useState(villa?.cover_path || null);
  const [saved, setSaved] = useState(false);
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
              price: parseMoney(f.get('price')),
              capacity: Number(f.get('capacity')),
              address: f.get('address'),
              google_maps_url: f.get('google_maps_url'),
              facilities: String(f.get('facilities'))
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
              notes: f.get('notes'),
              sort_order: Number(f.get('sort_order')),
              active: f.get('active') === 'on',
            },
          });
          setSavedId(result.id);
          setSaved(true);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{villa ? 'Edit villa' : 'Tambah villa'}</h3>
      <label className="field">
        Nama villa
        <Input
          name="name"
          required
          defaultValue={villa?.name || ''}
          placeholder="Nama penginapan"
        />
      </label>
      <div className="grid grid-2">
        <label className="field">
          Harga per malam (Rp)
          <MoneyInput name="price" defaultValue={villa?.price || 0} />
        </label>
        <label className="field">
          Kapasitas orang
          <Input
            name="capacity"
            type="number"
            min={1}
            max={10000}
            required
            defaultValue={villa?.capacity || 1}
          />
        </label>
      </div>
      <label className="field">
        Alamat
        <Input
          name="address"
          defaultValue={villa?.address || ''}
          placeholder="Jalan, kawasan, kota"
        />
      </label>
      <label className="field">
        Google Maps URL
        <Input
          name="google_maps_url"
          type="url"
          defaultValue={villa?.google_maps_url || ''}
          placeholder="https://maps.app.goo.gl/..."
        />
      </label>
      <label className="field">
        Deskripsi
        <Textarea name="description" defaultValue={villa?.description} />
      </label>
      <label className="field">
        Fasilitas (satu fasilitas per baris)
        <Textarea
          name="facilities"
          rows={5}
          defaultValue={villa?.facilities.join('\n')}
          placeholder={'Kolam renang\nArea BBQ\nWiFi'}
        />
        <small>Tekan Enter untuk menambahkan fasilitas berikutnya.</small>
      </label>
      <label className="field">
        Catatan
        <Textarea name="notes" defaultValue={villa?.notes} />
      </label>
      <label className="field">
        Urutan tampil
        <Input name="sort_order" type="number" min={0} defaultValue={villa?.sort_order || 0} />
      </label>
      <label className="row">
        <Input type="checkbox" name="active" defaultChecked={villa?.active ?? true} />
        Aktif untuk voting
      </label>
      <Notice error>{error}</Notice>
      <Button disabled={busy} type="submit">
        {busy ? 'Menyimpan…' : 'Simpan villa'}
      </Button>
      {savedId && (
        <>
          {saved && <Notice>Villa tersimpan.</Notice>}
          <div className="stack-sm">
            <h3>Foto villa</h3>
            <p>Pilih bintang pada foto yang ingin dijadikan cover.</p>
            <div className="photo-grid">
              {photos.map((photo, index) => (
                <div className="photo-tile" key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(photo.storage_path)!} alt={`Foto villa ${index + 1}`} />
                  <div className="photo-actions">
                    <Button
                      type="button"
                      size="sm"
                      variant={cover === photo.storage_path ? 'default' : 'outline'}
                      aria-label={`Jadikan foto ${index + 1} cover`}
                      aria-pressed={cover === photo.storage_path}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api(`/api/admin/events/${eventId}`, {
                            action: 'cover_image',
                            data: { id: photo.id },
                          });
                          setCover(photo.storage_path);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Star
                        size={16}
                        fill={cover === photo.storage_path ? 'currentColor' : 'none'}
                      />
                      {cover === photo.storage_path ? 'Cover' : ''}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Hapus foto ${index + 1}`}
                      disabled={busy}
                      onClick={async () => {
                        if (!confirm('Hapus foto ini?')) return;
                        setBusy(true);
                        try {
                          await api(`/api/admin/events/${eventId}`, {
                            action: 'delete_image',
                            data: { id: photo.id },
                          });
                          setPhotos(photos.filter((i) => i.id !== photo.id));
                          if (cover === photo.storage_path) setCover(null);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <UploadField
            eventId={eventId}
            kind="media"
            villaId={savedId}
            onUploaded={(image, newCover) => {
              setPhotos((current) => [...current.filter((i) => i.id !== image.id), image]);
              setCover(newCover);
            }}
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
