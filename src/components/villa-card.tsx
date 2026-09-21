'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { House, MapPin, Users, Check, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { mediaUrl, rupiah } from '@/lib/utils';
import type { Villa, VillaImage } from '@/types/domain';
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
  const [active, setActive] = useState<string>();
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
          <Dialog
            onOpenChange={(open) => {
              if (open) setActive(cover);
            }}
          >
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
                {(active || cover) && (
                  <img
                    className="villa-detail-cover"
                    src={mediaUrl(active || cover)!}
                    alt={`Detail ${villa.name}`}
                  />
                )}
                {photos.length > 1 && (
                  <div className="gallery-thumbs">
                    {photos.map((photo, i) => (
                      <button
                        type="button"
                        key={photo.id}
                        aria-label={`Lihat foto ${i + 1}`}
                        aria-pressed={(active || cover) === photo.storage_path}
                        onClick={() => setActive(photo.storage_path)}
                      >
                        <img
                          src={mediaUrl(photo.storage_path)!}
                          alt={`Foto ${i + 1}`}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
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
