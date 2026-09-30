import type { Bundle } from '@/types/domain';
import { orderedVillas } from '@/lib/villa-recommendations';
import { VillaCard } from './villa-card';
export function VillaRecommendations({ data }: { data: Bundle }) {
  const villas = orderedVillas(
    data.villas.filter((v) => v.active),
    data.event.recommended_villa_id,
  );
  return (
    <section className="stack" aria-label="Preview pilihan villa">
      <div>
        <span className="eyebrow">TEMPAT UNTUK KUMPUL</span>
        <h2>Jelajahi pilihan villa</h2>
        <p>
          Lihat foto, fasilitas, kapasitas, dan harga. Lokasi acara mengikuti villa yang ditandai
          “Villa final”.
        </p>
      </div>
      <div className="grid grid-2">
        {villas.map((v) => (
          <VillaCard
            key={v.id}
            villa={v}
            images={data.images}
            recommended={v.id === data.event.recommended_villa_id}
            final={v.id === data.event.final_villa_id}
          />
        ))}
      </div>
      {!villas.length && <p className="empty">Preview villa belum tersedia.</p>}
    </section>
  );
}
