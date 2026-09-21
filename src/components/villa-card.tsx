'use client';
/* eslint-disable @next/next/no-img-element */
import { House, MapPin, Users, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
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
  return (
    <article className={`card villa-card ${selected ? 'selected' : ''}`}>
      <div className="villa-image">
        {villa.cover_path ? (
          <img loading="lazy" src={mediaUrl(villa.cover_path)!} alt={villa.name} />
        ) : (
          <House size={50} strokeWidth={1} />
        )}
      </div>
      <div className="villa-body stack-sm">
        <h3>{villa.name}</h3>
        <div className="row muted" style={{ fontSize: 12 }}>
          <Users size={14} />
          {villa.capacity} orang <span>·</span>
          {rupiah(villa.price)} / malam
        </div>
        <div className="row between">
          <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                Lihat info
              </Button>
            </DialogTrigger>
            <DialogContent>
              <div className="stack">
                <DialogTitle className="text-2xl font-semibold">{villa.name}</DialogTitle>
                <DialogDescription>
                  {villa.description || 'Tempat untuk cerita baru bersama teman.'}
                </DialogDescription>
                {images.length > 0 && (
                  <div className="gallery">
                    {images
                      .filter((i) => i.villa_id === villa.id)
                      .map((i) => (
                        <img
                          key={i.id}
                          src={mediaUrl(i.storage_path)!}
                          alt={villa.name}
                          loading="lazy"
                        />
                      ))}
                  </div>
                )}
                <div className="row">
                  <span className="pill">{rupiah(villa.price)} / malam</span>
                  <span className="pill">{villa.capacity} orang</span>
                </div>
                <div className="row">
                  {villa.facilities.map((f) => (
                    <span className="pill" key={f}>
                      {f}
                    </span>
                  ))}
                </div>
                <p>{villa.address}</p>
                {villa.notes && <p>{villa.notes}</p>}
                {villa.google_maps_url && (
                  <a
                    className="button"
                    href={villa.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin size={16} />
                    Buka Google Maps
                  </a>
                )}
              </div>
            </DialogContent>
          </Dialog>
          {onSelect && (
            <Button
              type="button"
              variant={selected ? 'default' : 'ghost'}
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
    </article>
  );
}
