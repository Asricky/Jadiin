import { DateGrid } from './date-grid';
import { VillaCard } from './villa-card';
import { prettyDate } from '@/lib/utils';
import type { Bundle } from '@/types/domain';
import { analytics } from '@/lib/planning';
export function PlanningAnalytics({
  data,
  admin = false,
  details = true,
}: {
  data: Bundle;
  admin?: boolean;
  details?: boolean;
}) {
  const a = analytics(data);
  const finalized = ['STAGE_2_OPEN', 'COMPLETED'].includes(data.event.status);
  const pair = finalized
    ? a.datePairs.find((p) => p.start.date === data.event.final_date)
    : a.leadingPairs[0];
  const displayedVillas = finalized
    ? data.villas.filter((v) => v.id === data.event.final_villa_id)
    : a.leadingVillas;
  return (
    <div className="stack">
      <div className="grid grid-2 planning-grid">
        <section className="card stack">
          <div className="stack-sm">
            <h3>{finalized ? 'Tanggal acara' : 'Perkiraan tanggal'}</h3>
            {pair ? (
              <>
                <strong className="text-xl">
                  {prettyDate(pair.start.date)}
                  <br />
                  <span className="font-normal text-muted-foreground">sampai</span>{' '}
                  {prettyDate(pair.end.date)}
                </strong>
                <p>
                  {pair.count} dari {data.participants.length} peserta bisa di kedua hari. 2 hari, 1
                  malam.
                </p>
                {details && !finalized && a.leadingPairs.length > 1 && (
                  <details>
                    <summary className="text-sm text-link">
                      {a.leadingPairs.length} pilihan tanggal dengan hasil imbang
                    </summary>
                    <div className="stack-sm mt-3">
                      {a.leadingPairs.map((p) => (
                        <small key={p.start.id}>
                          {prettyDate(p.start.date)} – {prettyDate(p.end.date)}
                        </small>
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <p>Belum ada peserta yang tersedia selama dua hari berurutan.</p>
            )}
          </div>
          <DateGrid
            compact
            dates={data.dates}
            counts={a.dateCounts}
            total={data.participants.length}
            value={pair ? [pair.start.id, pair.end.id] : []}
          />
          <small className="muted">
            Angka: peserta yang bisa per hari. Warna lebih pekat berarti lebih banyak peserta. Garis
            hijau: pasangan tanggal teratas.
          </small>
        </section>
        <section className="stack-sm">
          <div className="row between">
            <h3>{finalized ? 'Villa acara' : 'Villa favorit sementara'}</h3>
            {finalized ? (
              <span className="pill">Pilihan final</span>
            ) : (
              a.maxVilla > 0 && <span className="pill">{a.maxVilla} suara</span>
            )}
          </div>
          {displayedVillas.length ? (
            displayedVillas.map((v) => <VillaCard key={v.id} villa={v} images={data.images} />)
          ) : (
            <div className="empty">Belum ada suara masuk.</div>
          )}
          {!finalized && a.leadingVillas.length > 1 && (
            <small className="muted">
              Jumlah suara masih imbang. Keputusan final ditetapkan organizer.
            </small>
          )}
        </section>
      </div>
      {details && (data.event.show_participant_list || admin) && (
        <section className="card stack-sm">
          <div className="row between">
            <h3>Sudah mengisi</h3>
            <span className="pill">{data.participants.length} peserta</span>
          </div>
          {data.participants.length ? (
            <div className="participant-list">
              {[...data.participants]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <div className="row" key={p.id}>
                    <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                    <span>{p.name}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p>Jawaban peserta akan muncul di sini.</p>
          )}
        </section>
      )}
      {admin && details && (
        <>
          <section className="card stack">
            <h3>Ketersediaan peserta</h3>
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
                      {prettyDate(d.date)} · {available.length}/{data.participants.length} peserta
                    </summary>
                    <p className="mt-2">
                      Bisa: {available.map((p) => p.name).join(', ') || 'Belum ada'}
                    </p>
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
          <section className="stack">
            <h3>Semua hasil voting villa</h3>
            <div className="grid grid-2">
              {data.villas
                .filter((v) => v.active)
                .sort((x, y) => a.villaCounts[y.id] - a.villaCounts[x.id])
                .map((v) => (
                  <div key={v.id} className="stack-sm">
                    <VillaCard villa={v} images={data.images} />
                    <strong>{a.villaCounts[v.id]} suara</strong>
                    <small className="muted">
                      {data.participants
                        .filter((p) =>
                          data.votes.some(
                            (vote) => vote.villa_id === v.id && vote.participant_id === p.id,
                          ),
                        )
                        .map((p) => p.name)
                        .join(', ') || 'Belum ada pemilih'}
                    </small>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
