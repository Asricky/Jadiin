'use client';
import { Input } from './ui/input';
import { useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Car, Bike, Footprints, GripVertical, Trash2 } from 'lucide-react';
import type { Bundle } from '@/types/domain';
import { Button } from './ui/button';
type Act = (action: string, data: object) => Promise<unknown>;
function Person({ id, name, disabled }: { id: string; name: string; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      className="person-chip"
      style={{
        transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
        zIndex: transform ? 10 : undefined,
      }}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={14} />
      {name}
    </div>
  );
}
function Drop({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={`card stack-sm group-drop ${isOver ? 'over' : ''}`}>
      {children}
    </section>
  );
}
export function Transport({ data, act, locked }: { data: Bundle; act: Act; locked: boolean }) {
  const [type, setType] = useState('CAR');
  const [driver, setDriver] = useState('');
  const [owner, setOwner] = useState('');
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState(5);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const unassigned = data.participants.filter(
    (p) => !data.members.some((m) => m.participant_id === p.id),
  );
  const driverIds = new Set(data.groups.map((g) => g.driver_participant_id));
  async function end(e: DragEndEvent) {
    if (e.over)
      await act('assign', {
        participant_id: e.active.id,
        group_id: e.over.id === 'unassigned' ? '' : e.over.id,
      });
  }
  return (
    <div className="stack">
      <div>
        <h2>Transport peserta</h2>
        <p>Geser nama ke kendaraan di desktop, atau gunakan pilihan transport di bawah.</p>
      </div>
      {!locked && (
        <form
          className="card stack-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const result = await act('group', {
              type,
              label: f.get('label'),
              capacity: Number(f.get('capacity')),
              driver_participant_id: type === 'INDEPENDENT' ? '' : driver,
              owner_participant_id: f.get('owner') || '',
            });
            if (result) {
              form.reset();
              setDriver('');
              setOwner('');
              setLabel('');
            }
          }}
        >
          <h3>Tambah kendaraan</h3>
          <p className="text-sm">
            Pilih pemilik untuk mengisi label, kapasitas, dan usulan driver dari jawaban peserta.
          </p>
          {data.participants.some((p) => p.vehicle_type !== 'NONE') && (
            <details>
              <summary className="text-sm">Kendaraan yang ditawarkan peserta</summary>
              <div className="stack-sm mt-3">
                {data.participants
                  .filter((p) => p.vehicle_type !== 'NONE')
                  .map((p) => (
                    <p key={p.id} className="text-sm">
                      {p.vehicle_type === 'CAR' ? 'Mobil' : 'Motor'} {p.vehicle_owner || p.name} ·
                      Driver: {p.vehicle_driver || p.name} ·{' '}
                      {p.vehicle_capacity || (p.vehicle_type === 'CAR' ? 5 : 2)} kursi
                    </p>
                  ))}
              </div>
            </details>
          )}
          <div className="grid grid-2">
            <label className="field">
              Jenis
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setCapacity(
                    e.target.value === 'MOTORCYCLE' ? 2 : e.target.value === 'INDEPENDENT' ? 1 : 5,
                  );
                  setOwner('');
                  setLabel('');
                }}
              >
                <option value="CAR">Mobil</option>
                <option value="MOTORCYCLE">Motor</option>
                <option value="INDEPENDENT">Mandiri</option>
              </select>
            </label>
            <label className="field">
              Label
              <Input
                required
                name="label"
                placeholder="Mobil Andi"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label className="field">
              Kapasitas (termasuk driver)
              <Input
                key={type}
                type="number"
                name="capacity"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                min={1}
                max={type === 'MOTORCYCLE' ? 2 : type === 'INDEPENDENT' ? 1 : 50}
                required
              />
            </label>
            <label className="field">
              Pemilik
              <select
                aria-label="Pemilik"
                name="owner"
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  const p = data.participants.find((p) => p.id === e.target.value);
                  if (p) {
                    const t = p.vehicle_type === 'NONE' ? type : p.vehicle_type;
                    setType(t);
                    setCapacity(p.vehicle_capacity || (t === 'MOTORCYCLE' ? 2 : 5));
                    setLabel(
                      `${t === 'CAR' ? 'Mobil' : t === 'MOTORCYCLE' ? 'Motor' : 'Mandiri'} ${p.vehicle_owner || p.name}`,
                    );
                    const proposed = unassigned.find(
                      (x) => x.name.toLowerCase() === (p.vehicle_driver || p.name).toLowerCase(),
                    );
                    setDriver(proposed?.id || '');
                  }
                }}
              >
                <option value="">Tidak ditentukan</option>
                {data.participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {type !== 'INDEPENDENT' && (
              <label className="field">
                Driver
                <select
                  aria-label="Driver"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  required
                >
                  <option value="">Pilih driver</option>
                  {unassigned.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {data.participants.find((p) => p.id === driver)?.vehicle_type === 'NONE' && (
            <div className="notice">
              Peserta ini memilih “Tidak ada kendaraan”. Kamu tetap bisa menetapkannya sebagai
              driver.
            </div>
          )}
          <Button>Tambahkan kendaraan</Button>
        </form>
      )}
      <DndContext sensors={sensors} onDragEnd={end}>
        <div className="grid grid-2">
          <Drop id="unassigned">
            <h3 className="row">
              <Footprints size={18} />
              Belum ditempatkan ({unassigned.length})
            </h3>
            {unassigned.map((p) => (
              <Person key={p.id} id={p.id} name={p.name} disabled={locked} />
            ))}
            {!unassigned.length && <p>Semua sudah mendapat tempat ✓</p>}
          </Drop>
          {data.groups.map((g) => (
            <Drop key={g.id} id={g.id}>
              <div className="row between">
                <h3 className="row">
                  {g.type === 'CAR' ? (
                    <Car size={19} />
                  ) : g.type === 'MOTORCYCLE' ? (
                    <Bike size={19} />
                  ) : (
                    <Footprints size={19} />
                  )}{' '}
                  {g.label}
                </h3>
                {!locked && (
                  <button
                    className="button button-ghost button-icon"
                    aria-label={`Hapus ${g.label}`}
                    onClick={() => {
                      if (
                        confirm(
                          'Hapus kendaraan dan kembalikan anggota ke daftar belum ditempatkan?',
                        )
                      )
                        void act('delete_group', { id: g.id });
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <small className="muted">
                {data.members.filter((m) => m.transport_group_id === g.id).length} / {g.capacity}{' '}
                kursi · {g.type}
              </small>
              {data.members
                .filter((m) => m.transport_group_id === g.id)
                .map((m) => (
                  <Person
                    key={m.participant_id}
                    id={m.participant_id}
                    name={`${data.participants.find((p) => p.id === m.participant_id)?.name}${m.role === 'DRIVER' ? ' · Driver' : ''}`}
                    disabled={locked || m.role === 'DRIVER'}
                  />
                ))}
            </Drop>
          ))}
        </div>
      </DndContext>
      {!locked && (
        <section className="card stack-sm">
          <h3>Atur transport tanpa drag</h3>
          {data.participants
            .filter((p) => !driverIds.has(p.id))
            .map((p) => (
              <label className="field" key={p.id}>
                {p.name}
                <select
                  value={
                    data.members.find((m) => m.participant_id === p.id)?.transport_group_id || ''
                  }
                  onChange={(e) =>
                    void act('assign', { participant_id: p.id, group_id: e.target.value })
                  }
                >
                  <option value="">Belum ditempatkan</option>
                  {data.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </section>
      )}
    </div>
  );
}
