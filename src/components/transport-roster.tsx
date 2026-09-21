import { Car, Bike, Footprints, Armchair, Navigation } from 'lucide-react';
import type { Bundle } from '@/types/domain';
export function TransportRoster({
  data,
}: {
  data: Pick<Bundle, 'groups' | 'members' | 'participants'>;
}) {
  const unassigned = data.participants.filter(
    (p) => !data.members.some((m) => m.participant_id === p.id),
  );
  return (
    <section className="stack">
      <div className="row between">
        <div>
          <h2>Teman seperjalanan</h2>
          <p className="text-sm">Siapa berangkat dengan siapa, sesuai pilihan terbaru.</p>
        </div>
        <span className="pill">
          {data.members.length}/{data.participants.length} sudah memilih
        </span>
      </div>
      <div className="grid grid-2">
        {data.groups
          .filter(
            (g) =>
              g.type !== 'INDEPENDENT' || data.members.some((m) => m.transport_group_id === g.id),
          )
          .map((g) => {
            const members = data.members
              .filter((m) => m.transport_group_id === g.id)
              .sort((a, b) => (a.role === b.role ? 0 : a.role === 'DRIVER' ? -1 : 1));
            const Icon = g.type === 'CAR' ? Car : g.type === 'MOTORCYCLE' ? Bike : Footprints;
            return (
              <article className="ride-card" key={g.id}>
                <div className="row between">
                  <span className="ride-icon">
                    <Icon size={24} />
                  </span>
                  <span className="pill">
                    {members.length}/{g.capacity} kursi
                  </span>
                </div>
                <h3>{g.label}</h3>
                <div className="ride-people">
                  {members.map((m) => (
                    <div key={m.participant_id}>
                      <span className="avatar">
                        {data.participants.find((p) => p.id === m.participant_id)?.name.slice(0, 1)}
                      </span>
                      <span>{data.participants.find((p) => p.id === m.participant_id)?.name}</span>
                      {m.role === 'DRIVER' && (
                        <small>
                          <Navigation size={12} />
                          Driver
                        </small>
                      )}
                    </div>
                  ))}
                </div>
                <div className="row text-sm muted">
                  <Armchair size={16} />
                  {g.capacity - members.length} kursi tersisa
                </div>
              </article>
            );
          })}
      </div>
      {unassigned.length > 0 && (
        <div className="unassigned-note">
          <strong>Belum memilih kendaraan ({unassigned.length})</strong>
          <p>{unassigned.map((p) => p.name).join(', ')}</p>
        </div>
      )}
      {!data.groups.length && !unassigned.length && (
        <div className="empty">Kendaraan dan penumpang akan tampil di sini.</div>
      )}
    </section>
  );
}
