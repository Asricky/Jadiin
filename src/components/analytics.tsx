import { CalendarDays, House, Users } from 'lucide-react';
import { DateGrid } from './date-grid';
import { VillaCard } from './villa-card';
import { prettyDate } from '@/lib/utils';
import type { Bundle } from '@/types/domain';
import { analytics } from '@/lib/planning';
export function PlanningAnalytics({ data, admin = false }: { data: Bundle; admin?: boolean }) {
  const a = analytics(data);
  return (
    <div className="stack">
      <div className="grid grid-2">
        <section className="card card-lime stack-sm">
          <div className="row">
            <CalendarDays size={20} />
            <span className="eyebrow">TANGGAL PALING MEMUNGKINKAN</span>
          </div>
          {a.leadingDates.length ? (
            a.leadingDates.map((d) => <h3 key={d.id}>{prettyDate(d.date)}</h3>)
          ) : (
            <h3>Menunggu pilihan teman</h3>
          )}
          <p>
            {a.maxDate} dari {data.participants.length} peserta tersedia
            {a.leadingDates.length > 1 ? ' · Hasil masih imbang' : ''}
          </p>
        </section>
        <section className="card stack-sm">
          <div className="row">
            <House size={20} />
            <span className="eyebrow">VILLA FAVORIT SEMENTARA</span>
          </div>
          {a.leadingVillas.length ? (
            a.leadingVillas.map((v) => <h3 key={v.id}>{v.name}</h3>)
          ) : (
            <h3>Belum ada suara</h3>
          )}
          <p>
            {a.maxVilla} suara{a.leadingVillas.length > 1 ? ' · Voting sementara masih imbang' : ''}
          </p>
        </section>
      </div>
      <section className="card stack">
        <div className="row between">
          <h3>Kalender kebersamaan</h3>
          <span className="pill">{data.participants.length} peserta</span>
        </div>
        <p style={{ fontSize: 13 }}>
          Semakin hijau, semakin banyak yang bisa. Angka menunjukkan jumlah teman yang tersedia.
        </p>
        <DateGrid dates={data.dates} counts={a.dateCounts} total={data.participants.length} />
      </section>
      {admin && (
        <section className="card stack">
          <h3>Detail ketersediaan</h3>
          {[...data.dates]
            .sort((x, y) => a.dateCounts[y.id] - a.dateCounts[x.id])
            .map((d) => {
              const available = data.participants.filter((p) =>
                data.availability.some(
                  (v) => v.event_date_id === d.id && v.participant_id === p.id,
                ),
              );
              return (
                <details key={d.id}>
                  <summary>
                    {prettyDate(d.date)} — {available.length}/{data.participants.length} (
                    {Math.round((100 * available.length) / (data.participants.length || 1))}%)
                  </summary>
                  <p>Bisa: {available.map((p) => p.name).join(', ') || 'Belum ada'}</p>
                  <p>
                    Tidak bisa:{' '}
                    {data.participants
                      .filter((p) => !available.some((x) => x.id === p.id))
                      .map((p) => p.name)
                      .join(', ') || 'Tidak ada'}
                  </p>
                </details>
              );
            })}
        </section>
      )}
      <section className="stack">
        <h3>Pilihan tempat kumpul</h3>
        <div className="grid grid-2">
          {data.villas
            .filter((v) => v.active)
            .sort((x, y) => x.sort_order - y.sort_order)
            .map((v) => (
              <div key={v.id} className="stack-sm">
                <VillaCard villa={v} images={data.images} />
                <div className="row between">
                  <strong>{a.villaCounts[v.id]} suara</strong>
                  {admin && (
                    <small>
                      {data.participants
                        .filter((p) =>
                          data.votes.some(
                            (vote) => vote.villa_id === v.id && vote.participant_id === p.id,
                          ),
                        )
                        .map((p) => p.name)
                        .join(', ')}
                    </small>
                  )}
                </div>
              </div>
            ))}
        </div>
      </section>
      {(data.event.show_participant_list || admin) && (
        <section className="card stack">
          <h3 className="row">
            <Users size={20} />
            {data.participants.length} teman sudah ikut
          </h3>
          <div className="row">
            {[...data.participants]
              .sort((x, y) => x.name.localeCompare(y.name))
              .map((p) => (
                <span className="pill" key={p.id}>
                  {p.name}
                </span>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
