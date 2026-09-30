'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  rectIntersection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Car, Bike, Footprints, GripVertical, RefreshCw, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Notice } from './common';
import { api } from '@/lib/utils';
import type { Group, Member } from '@/types/domain';
import { offerStatus, type VehicleOffer } from '@/lib/vehicle-offers';

type Person = { id: string; name: string };
type State = {
  offers: VehicleOffer[];
  groups: Group[];
  members: Member[];
  participants: Person[];
  participantId: string;
  open: boolean;
};
function Passenger({
  person,
  movable,
  self,
  owner,
  driver,
}: {
  person: Person;
  movable: boolean;
  self: boolean;
  owner?: boolean;
  driver?: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: person.id,
    disabled: !movable,
  });
  return (
    <div
      ref={setNodeRef}
      data-participant-id={person.id}
      className={`transport-person ${owner ? 'is-owner' : ''} ${self ? 'is-self' : ''}`}
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      {movable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="transport-grip"
          {...attributes}
          {...listeners}
          aria-label={`Geser transport untuk ${person.name}`}
        >
          <GripVertical size={20} />
        </button>
      )}
      <div>
        <strong>{person.name}</strong>
        <div className="transport-person-labels">
          {self && <small>Kamu</small>}
          {owner && <small>Pemilik</small>}
          {driver && <small>Driver</small>}
        </div>
      </div>
    </div>
  );
}
function DropArea({
  id,
  label,
  disabled = false,
  children,
  className = '',
}: {
  id: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      data-transport-drop={id}
      className={`transport-drop ${isOver ? 'is-over' : ''} ${className}`}
    >
      {children}
    </section>
  );
}
export function TransportPicker({ slug, initial }: { slug: string; initial: State }) {
  const [data, setData] = useState(initial);
  const [category, setCategory] = useState<'CAR' | 'MOTORCYCLE'>('CAR');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [destination, setDestination] = useState('unassigned');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const inFlight = useRef(false),
    dragging = useRef(false),
    version = useRef(0);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const refresh = useCallback(async () => {
    const request = ++version.current;
    const r = await fetch(`/api/events/${slug}/transport`, { cache: 'no-store' });
    if (!r.ok)
      throw new Error('Tidak dapat memperbarui kursi. Muat ulang halaman untuk memeriksa sesi.');
    const next = await r.json();
    if (request === version.current) setData(next);
  }, [slug]);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible' && !inFlight.current && !dragging.current)
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
  const shared = data.groups.filter((g) => g.type !== 'INDEPENDENT');
  const pendingOffers = data.offers.filter(
    (p) => !offerStatus(p, data.groups, data.members, data.participants).group,
  );
  const reserved = new Set(
    shared.flatMap((g) => [g.owner_participant_id, g.driver_participant_id]).filter(Boolean),
  );
  const fixed = reserved.has(data.participantId);
  const independent = new Set(data.groups.filter((g) => g.type === 'INDEPENDENT').map((g) => g.id));
  const ownIndependent = !!mine && independent.has(mine.transport_group_id);
  const unassigned = data.participants.filter(
    (p) => !reserved.has(p.id) && !data.members.some((m) => m.participant_id === p.id),
  );
  const solo = data.participants.filter((p) =>
    data.members.some((m) => m.participant_id === p.id && independent.has(m.transport_group_id)),
  );
  async function choose(
    group_id: string | null,
    independent = false,
    participantId = data.participantId,
  ) {
    if (inFlight.current || reserved.has(participantId) || !data.open) return;
    inFlight.current = true;
    ++version.current;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(`/api/events/${slug}/transport`, {
        group_id,
        independent,
        participant_id: participantId,
      });
      await refresh();
      setSuccess(
        group_id || independent
          ? 'Susunan penumpang tersimpan.'
          : 'Peserta dikembalikan ke daftar belum punya transportasi.',
      );
    } catch (e) {
      setError((e as Error).message);
      await refresh().catch(() => {});
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function end(e: DragEndEvent) {
    dragging.current = false;
    setActive(null);
    if (reserved.has(String(e.active.id)) || !e.over || busy || !data.open) return;
    const target = String(e.over.id);
    if (target === data.members.find((m) => m.participant_id === e.active.id)?.transport_group_id)
      return;
    void choose(
      target === 'unassigned' || target === 'independent' ? null : target,
      target === 'independent',
      String(e.active.id),
    );
  }
  function passenger(p: Person, group?: Group) {
    return (
      <Passenger
        key={p.id}
        person={p}
        self={p.id === data.participantId}
        movable={data.open && !busy && !reserved.has(p.id)}
        owner={group?.type !== 'INDEPENDENT' && group?.owner_participant_id === p.id}
        driver={group?.driver_participant_id === p.id}
      />
    );
  }
  return (
    <section className="stack transport-board" id="transport" aria-label="Pilih teman perjalanan">
      <div className="row between">
        <div>
          <span className="eyebrow">01 / PERJALANAN</span>
          <h2>Pilih teman seperjalanan</h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Perbarui kursi"
          disabled={busy || !!active}
          onClick={() =>
            void refresh()
              .then(() => setError(''))
              .catch((e) => setError(e.message))
          }
        >
          <RefreshCw size={17} />
        </Button>
      </div>
      <p className="text-sm">
        Geser nama penumpang lewat pegangan titik ke mobil atau motor. Di ponsel, tahan pegangannya
        sebentar lalu geser. Atau tambahkan penumpang dari daftar tanpa menggeser.
      </p>
      <Notice error>{error}</Notice>
      <Notice>{success}</Notice>
      {fixed && (
        <div className="notice">
          Kamu adalah pemilik atau driver. Kursimu sudah dihitung di kendaraanmu. Hubungi organizer
          untuk mengubahnya.
        </div>
      )}
      {!data.open && (
        <div className="notice">Pilihan transport dikunci karena acara sudah selesai.</div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={(e) => {
          dragging.current = true;
          setActive(String(e.active.id));
        }}
        onDragCancel={() => {
          dragging.current = false;
          setActive(null);
        }}
        onDragEnd={end}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Tekan spasi untuk mengangkat nama penumpang, tombol panah untuk berpindah, spasi untuk melepas, atau Escape untuk membatalkan. Tombol Ikut juga tersedia.',
          },
        }}
      >
        <div className="transport-tabs" aria-label="Jenis kendaraan">
          {(['CAR', 'MOTORCYCLE'] as const).map((type) => (
            <Button
              key={type}
              variant={category === type ? 'default' : 'outline'}
              aria-pressed={category === type}
              onClick={() => setCategory(type)}
            >
              {type === 'CAR' ? <Car size={20} /> : <Bike size={20} />}
              {type === 'CAR' ? 'Mobil' : 'Motor'}{' '}
              <span>{shared.filter((g) => g.type === type).length}</span>
            </Button>
          ))}
        </div>
        <div className="transport-columns transport-category">
          {[category].map((type) => (
            <section
              className="stack-sm transport-column"
              key={type}
              aria-label={type === 'CAR' ? 'Mobil' : 'Motor'}
            >
              <h3 className="row">
                {type === 'CAR' ? <Car size={20} /> : <Bike size={20} />}
                {type === 'CAR' ? 'Mobil' : 'Motor'}{' '}
                <span className="pill">{shared.filter((g) => g.type === type).length}</span>
              </h3>
              {shared
                .filter((g) => g.type === type)
                .map((g) => {
                  const members = data.members.filter((m) => m.transport_group_id === g.id);
                  const full = members.length >= g.capacity,
                    selected = mine?.transport_group_id === g.id;
                  return (
                    <DropArea
                      key={g.id}
                      id={g.id}
                      label={g.label}
                      disabled={!data.open || busy || full}
                      className={selected ? 'chosen' : ''}
                    >
                      <div className="row between">
                        <h4>{g.label}</h4>
                        <span className={`pill ${full ? 'full' : ''}`}>
                          {members.length} / {g.capacity} slot{full ? ' - Penuh' : ''}
                        </span>
                      </div>
                      <p className="text-sm muted">
                        Pemilik:{' '}
                        {data.participants.find((p) => p.id === g.owner_participant_id)?.name ||
                          'Organizer'}
                        <br />
                        Driver:{' '}
                        {data.participants.find((p) => p.id === g.driver_participant_id)?.name ||
                          'Belum ditentukan'}
                      </p>
                      <div className="transport-passengers">
                        {members
                          .map((m) => data.participants.find((p) => p.id === m.participant_id))
                          .filter((p): p is Person => !!p)
                          .map((p) => passenger(p, g))}
                      </div>
                      {!full && (
                        <p className="transport-drop-hint">
                          {g.capacity - members.length} kursi tersedia. Taruh nama penumpang di
                          sini.
                        </p>
                      )}
                      {!full && data.open && (
                        <label className="stack-sm text-sm">
                          Tambah penumpang
                          <select
                            aria-label={`Tambah penumpang ke ${g.label}`}
                            value=""
                            disabled={busy || !unassigned.length}
                            onChange={(e) => {
                              if (e.target.value) void choose(g.id, false, e.target.value);
                            }}
                          >
                            <option value="">
                              {unassigned.length
                                ? 'Pilih nama yang belum punya transportasi'
                                : 'Semua peserta sudah mendapat transportasi'}
                            </option>
                            {unassigned.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <Button
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        disabled={busy || !data.open || fixed || selected || full}
                        onClick={() => void choose(g.id)}
                      >
                        {selected ? (
                          <>
                            <Check size={15} />
                            Kendaraanmu
                          </>
                        ) : full ? (
                          'Kursi sudah penuh'
                        ) : (
                          `Ikut ${g.label}`
                        )}
                      </Button>
                    </DropArea>
                  );
                })}
              {pendingOffers
                .filter((p) => p.vehicle_type === type)
                .map((p) => (
                  <article className="transport-drop" key={p.id} data-pending-offer={p.id}>
                    <span className="pill">Penawaran · belum aktif</span>
                    <h4>
                      {type === 'CAR' ? 'Mobil' : 'Motor'} {p.vehicle_owner || p.name}
                    </h4>
                    <p className="text-sm">
                      Ditawarkan oleh {p.name}
                      <br />
                      Usulan driver: {p.vehicle_driver || p.name}
                      <br />
                      Kapasitas penawaran: {p.vehicle_capacity || (type === 'CAR' ? 5 : 2)} orang
                    </p>
                    <p className="text-sm muted">
                      {offerStatus(p, data.groups, data.members, data.participants).message} Kursi
                      belum dapat dipilih.
                    </p>
                  </article>
                ))}
              {!shared.some((g) => g.type === type) &&
                !pendingOffers.some((p) => p.vehicle_type === type) && (
                  <p className="transport-empty">
                    Belum ada {type === 'CAR' ? 'mobil' : 'motor'} yang disediakan.
                  </p>
                )}
            </section>
          ))}
        </div>
        <DropArea
          id="unassigned"
          label="Belum Punya Transportasi"
          disabled={busy || !data.open}
          className="unassigned-area"
        >
          <h3>
            Belum Punya Transportasi <span className="pill">{unassigned.length}</span>
          </h3>
          <div className="transport-people-list">{unassigned.map((p) => passenger(p))}</div>
          {!unassigned.length && (
            <p className="text-sm muted">Semua peserta sudah menentukan transportasi.</p>
          )}
          <p className="text-sm muted">
            Semua penumpang dapat diatur bersama. Kursi pemilik dan driver hanya dapat diubah
            organizer.
          </p>
        </DropArea>
        <DropArea
          id="independent"
          label="Berangkat Mandiri"
          disabled={busy || !data.open}
          className="independent-area"
        >
          <h3 className="row">
            <Footprints size={20} />
            Berangkat Mandiri
          </h3>
          <p className="text-sm muted">Atur perjalanan sendiri tanpa mengambil kursi bersama.</p>
          <div className="transport-people-list">{solo.map((p) => passenger(p))}</div>
          <Button
            variant="outline"
            disabled={busy || fixed || !data.open || ownIndependent}
            onClick={() => void choose(null, true)}
          >
            {ownIndependent ? 'Pilihanmu: mandiri' : 'Pilih berangkat mandiri'}
          </Button>
          {ownIndependent && data.open && (
            <Button variant="ghost" disabled={busy} onClick={() => void choose(null)}>
              Batalkan berangkat mandiri
            </Button>
          )}
        </DropArea>
        <DragOverlay dropAnimation={null}>
          {active && (
            <div className="transport-person transport-drag-preview">
              <GripVertical size={20} />
              <strong>{data.participants.find((p) => p.id === active)?.name}</strong>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {data.open && (
        <details className="transport-drop">
          <summary>Atur penumpang tanpa geser</summary>
          <p className="text-sm muted">
            Pindahkan penumpang antar mobil, motor, atau perjalanan mandiri.
          </p>
          <label className="stack-sm">
            Penumpang
            <select
              aria-label="Penumpang yang diatur"
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
            >
              <option value="">Pilih penumpang</option>
              {data.participants
                .filter((p) => !reserved.has(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="stack-sm">
            Tujuan
            <select
              aria-label="Tujuan penumpang"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="unassigned">Belum punya transportasi</option>
              <option value="independent">Berangkat mandiri</option>
              {shared.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label} ({data.members.filter((m) => m.transport_group_id === g.id).length}/
                  {g.capacity})
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={busy || !selectedPerson}
            onClick={() =>
              void choose(
                destination === 'unassigned' || destination === 'independent' ? null : destination,
                destination === 'independent',
                selectedPerson,
              )
            }
          >
            Simpan penumpang
          </Button>
        </details>
      )}
      {mine && !ownIndependent && !fixed && data.open && (
        <Button variant="ghost" disabled={busy} onClick={() => void choose(null)}>
          Lepas pilihan transport
        </Button>
      )}
    </section>
  );
}
