'use client';
import { useCallback, useEffect, useState } from 'react';
import { Car, Bike, Footprints, Check, Armchair, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Notice } from './common';
import { api } from '@/lib/utils';
import type { Group, Member } from '@/types/domain';
type State = {
  groups: Group[];
  members: Member[];
  participants: { id: string; name: string }[];
  participantId: string;
  open: boolean;
};
export function TransportPicker({ slug, initial }: { slug: string; initial: State }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/events/${slug}/transport`, { cache: 'no-store' });
    if (!r.ok)
      throw new Error('Tidak dapat memperbarui kursi. Muat ulang halaman untuk memeriksa sesi.');
    setData(await r.json());
  }, [slug]);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible')
        void refresh().catch(() => setError('Pembaruan kursi terputus. Coba muat ulang.'));
    };
    const timer = setInterval(update, 12000);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
  const mine = data.members.find((m) => m.participant_id === data.participantId);
  const driver = mine?.role === 'DRIVER';
  async function choose(group_id: string | null, independent = false) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(`/api/events/${slug}/transport`, { group_id, independent });
      await refresh();
      setSuccess(
        group_id || independent
          ? 'Pilihan transport tersimpan. Kursimu sudah terisi atas namamu.'
          : 'Pilihan dilepas. Kamu bisa memilih kendaraan lain.',
      );
    } catch (e) {
      setError((e as Error).message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack" id="transport">
      <div className="row between">
        <div>
          <span className="eyebrow">01 / PERJALANAN</span>
          <h2>Pilih teman seperjalanan</h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Perbarui kursi"
          disabled={busy}
          onClick={() =>
            void refresh()
              .then(() => setError(''))
              .catch((e) => setError(e.message))
          }
        >
          <RefreshCw size={17} />
        </Button>
      </div>
      <p>Kursi langsung terisi saat dipilih. Kamu bisa pindah selama Stage 2 masih dibuka.</p>
      <Notice error>{error}</Notice>
      <Notice>{success}</Notice>
      {driver && (
        <div className="notice">Kamu adalah driver. Kursimu sudah disiapkan oleh organizer.</div>
      )}
      {!data.open && (
        <div className="notice">Pilihan transport dikunci karena acara sudah selesai.</div>
      )}
      <div className="stack-sm">
        {data.groups
          .filter((g) => g.type !== 'INDEPENDENT')
          .map((g) => {
            const members = data.members.filter((m) => m.transport_group_id === g.id);
            const remaining = g.capacity - members.length;
            const selected = mine?.transport_group_id === g.id;
            const Icon = g.type === 'CAR' ? Car : Bike;
            return (
              <article className={`ride-option ${selected ? 'chosen' : ''}`} key={g.id}>
                <div className="row between">
                  <div className="row">
                    <span className="ride-icon">
                      <Icon size={25} />
                    </span>
                    <div>
                      <h3>{g.label}</h3>
                      <p className="text-sm">
                        Driver:{' '}
                        {data.participants.find((p) => p.id === g.driver_participant_id)?.name ||
                          'Belum ditetapkan'}
                      </p>
                    </div>
                  </div>
                  <span className={`pill ${remaining === 0 ? 'full' : ''}`}>
                    {remaining === 0 ? 'Penuh' : `${remaining} kursi tersisa`}
                  </span>
                </div>
                <div
                  className="seat-strip"
                  aria-label={`${members.length} dari ${g.capacity} kursi terisi`}
                >
                  {Array.from({ length: Math.min(g.capacity, 12) }, (_, i) => (
                    <span className={i < members.length ? 'occupied' : ''} key={i}>
                      <Armchair size={20} />
                    </span>
                  ))}
                  {g.capacity > 12 && <small>+{g.capacity - 12}</small>}
                </div>
                <p className="text-sm">
                  Bareng:{' '}
                  {members
                    .map((m) => data.participants.find((p) => p.id === m.participant_id)?.name)
                    .join(', ') || 'Belum ada penumpang'}
                </p>
                <Button
                  variant={selected ? 'default' : 'outline'}
                  disabled={busy || !data.open || driver || selected || remaining === 0}
                  onClick={() => void choose(g.id)}
                >
                  {selected ? (
                    <>
                      <Check size={16} />
                      Kendaraanmu
                    </>
                  ) : remaining === 0 ? (
                    'Kursi sudah penuh'
                  ) : (
                    `Ikut ${g.label}`
                  )}
                </Button>
              </article>
            );
          })}
      </div>
      {!data.groups.some((g) => g.type !== 'INDEPENDENT') && (
        <p>
          Organizer belum menambahkan kendaraan bersama. Kamu bisa memilih berangkat mandiri atau
          kembali lagi nanti.
        </p>
      )}
      <div
        className={`ride-option independent ${data.groups.find((g) => g.id === mine?.transport_group_id)?.type === 'INDEPENDENT' ? 'chosen' : ''}`}
      >
        <div className="row">
          <Footprints size={24} />
          <div>
            <h3>Berangkat mandiri</h3>
            <p className="text-sm">
              Atur perjalanan sendiri tanpa mengambil kursi kendaraan bersama.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={
            busy ||
            !data.open ||
            driver ||
            data.groups.find((g) => g.id === mine?.transport_group_id)?.type === 'INDEPENDENT'
          }
          onClick={() => void choose(null, true)}
        >
          {data.groups.find((g) => g.id === mine?.transport_group_id)?.type === 'INDEPENDENT'
            ? 'Pilihanmu: mandiri'
            : 'Pilih berangkat mandiri'}
        </Button>
      </div>
      {mine && !driver && data.open && (
        <Button variant="ghost" disabled={busy} onClick={() => void choose(null)}>
          Lepas pilihan transport
        </Button>
      )}
    </section>
  );
}
