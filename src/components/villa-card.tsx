'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { House, MapPin, Users, Check, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { mediaUrl, rupiah } from '@/lib/utils';
import type { Villa, VillaImage } from '@/types/domain';

function VillaGallery({ paths, name }: { paths: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  function select(index: number) {
    const track = viewport.current;
    if (!track) return;
    const next = Math.max(0, Math.min(paths.length - 1, index));
    track.scrollTo({
      left: next * track.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }
  return (
    <section className="villa-slider stack-sm" aria-label={`Galeri ${name}`}>
      <div className="villa-slider-frame">
        <div
          ref={viewport}
          className="villa-slider-track"
          role="region"
          aria-roledescription="carousel"
          aria-label="Foto villa, gunakan tombol panah kiri atau kanan"
          tabIndex={0}
          onKeyDown={(event) => {
            const index =
              event.key === 'ArrowLeft'
                ? active - 1
                : event.key === 'ArrowRight'
                  ? active + 1
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? paths.length - 1
                      : null;
            if (index !== null) {
              event.preventDefault();
              select(index);
            }
          }}
          onScroll={(event) => {
            const track = event.currentTarget;
            const index = Math.max(
              0,
              Math.min(paths.length - 1, Math.round(track.scrollLeft / track.clientWidth)),
            );
            if (index === active) return;
            setActive(index);
            const rail = thumbs.current;
            const thumb = rail?.children[index] as HTMLElement | undefined;
            if (rail && thumb)
              rail.scrollTo({
                left: thumb.offsetLeft - rail.clientWidth / 2 + thumb.clientWidth / 2,
              });
          }}
        >
          {paths.map((path, index) => (
            <div
              className="villa-slide"
              key={path}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} dari ${paths.length}`}
              aria-hidden={index !== active}
            >
              <img
                src={mediaUrl(path)!}
                alt={`${name}, foto ${index + 1}`}
                loading={index === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </div>
          ))}
        </div>
        {paths.length > 1 && (
          <>
            <button
              type="button"
              className="villa-slider-arrow previous"
              aria-label="Foto sebelumnya"
              disabled={active === 0}
              onClick={() => select(active - 1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="villa-slider-arrow next"
              aria-label="Foto berikutnya"
              disabled={active === paths.length - 1}
              onClick={() => select(active + 1)}
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <span className="villa-slider-count" role="status" aria-live="polite">
          Foto {active + 1} dari {paths.length}
        </span>
      </div>
      {paths.length > 1 && (
        <>
          <div ref={thumbs} className="gallery-thumbs" aria-label="Pilih foto villa">
            {paths.map((path, index) => (
              <button
                type="button"
                key={path}
                aria-label={`Lihat foto ${index + 1}`}
                aria-pressed={active === index}
                onClick={() => select(index)}
              >
                <img src={mediaUrl(path)!} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
          <p className="text-sm muted">
            Geser foto atau gunakan tombol panah untuk melihat galeri.
          </p>
        </>
      )}
    </section>
  );
}
export function VillaCard({
  villa,
  images = [],
  selected,
  onSelect,
}: {
  villa: Villa;
  images?: VillaImage[];
  selected?: boolean;
  onSelect?: () => void;
}) {
  const photos = images.filter((i) => i.villa_id === villa.id);
  const cover = villa.cover_path || photos[0]?.storage_path;
  const gallery = [
    ...new Set(
      [cover, ...photos.map((photo) => photo.storage_path)].filter((path): path is string =>
        Boolean(path),
      ),
    ),
  ];
  return (
    <Card className={`villa-card gap-0 py-0 shadow-none ${selected ? 'selected' : ''}`}>
      <div className="villa-image">
        {cover ? (
          <img loading="lazy" src={mediaUrl(cover)!} alt={`Cover ${villa.name}`} />
        ) : (
          <span className="row muted">
            <House size={22} />
            Foto belum ditambahkan
          </span>
        )}
        {selected && (
          <span className="villa-selected">
            <Check size={14} />
            Pilihanmu
          </span>
        )}
      </div>
      <div className="villa-body stack-sm">
        <h3>{villa.name}</h3>
        <div className="villa-price">
          <strong>{rupiah(villa.price)}</strong>
          <span> / malam</span>
        </div>
        <div className="row muted text-sm">
          <Users size={16} />
          {villa.capacity} orang
        </div>
        {villa.address && <p className="line-clamp-1 text-sm">{villa.address}</p>}
        <div className="row between pt-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Lihat info
              </Button>
            </DialogTrigger>
            <DialogContent>
              <div className="stack villa-details">
                <div className="pr-8">
                  <DialogTitle className="text-2xl font-semibold">{villa.name}</DialogTitle>
                  <DialogDescription className="mt-2 text-sm text-muted-foreground">
                    {villa.description || 'Informasi penginapan untuk acara ini.'}
                  </DialogDescription>
                </div>
                {gallery.length > 0 && <VillaGallery paths={gallery} name={villa.name} />}
                <dl className="villa-facts">
                  <div>
                    <dt>Harga per malam</dt>
                    <dd>{rupiah(villa.price)}</dd>
                  </div>
                  <div>
                    <dt>Kapasitas</dt>
                    <dd>{villa.capacity} orang</dd>
                  </div>
                </dl>
                <section className="stack-sm">
                  <h3>Fasilitas</h3>
                  {villa.facilities.length ? (
                    <ul className="amenities">
                      {villa.facilities.map((f, i) => (
                        <li key={i}>
                          <Check size={16} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Belum ditambahkan.</p>
                  )}
                </section>
                <section className="stack-sm">
                  <h3 className="row">
                    <MapPin size={18} />
                    Alamat
                  </h3>
                  <p className="whitespace-pre-line">{villa.address || 'Belum ditambahkan.'}</p>
                  {villa.google_maps_url && (
                    <Button asChild variant="outline">
                      <a href={villa.google_maps_url} target="_blank" rel="noopener noreferrer">
                        Buka Google Maps
                        <ExternalLink size={15} />
                      </a>
                    </Button>
                  )}
                </section>
                {villa.notes && (
                  <section className="stack-sm">
                    <h3>Catatan</h3>
                    <p className="whitespace-pre-line">{villa.notes}</p>
                  </section>
                )}
              </div>
            </DialogContent>
          </Dialog>
          {onSelect && (
            <Button
              type="button"
              variant={selected ? 'default' : 'outline'}
              size="sm"
              aria-pressed={selected}
              onClick={onSelect}
            >
              {selected ? (
                <>
                  <Check size={16} />
                  Dipilih
                </>
              ) : (
                'Pilih villa'
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
