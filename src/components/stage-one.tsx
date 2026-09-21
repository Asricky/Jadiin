'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Car, Bike, Footprints, Check } from 'lucide-react';
import { stage1Schema } from '@/lib/validation';
import { api, prettyDate } from '@/lib/utils';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Notice } from './common';
import { DateGrid } from './date-grid';
import { VillaCard } from './villa-card';
import type { Event, EventDate, Villa, VillaImage } from '@/types/domain';
type Values = z.input<typeof stage1Schema>;
export function StageOne({
  event,
  dates,
  villas,
  images,
  initial,
}: {
  event: Pick<Event, 'id' | 'slug'>;
  dates: EventDate[];
  villas: Villa[];
  images: VillaImage[];
  initial?: Values;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const router = useRouter();
  const {
    register,
    control,
    subscribe,
    setValue,
    trigger,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, z.output<typeof stage1Schema>>({
    resolver: zodResolver(stage1Schema),
    defaultValues: initial || {
      name: '',
      whatsapp: '',
      dates: [],
      villa_id: '',
      vehicle_type: 'NONE',
      vehicle_owner: '',
      vehicle_driver: '',
      vehicle_capacity: 5,
    },
  });
  const values = useWatch({ control }) as Values;
  const key = `makrab-draft-${event.id}`;
  useEffect(() => {
    if (!initial) {
      try {
        const draft = localStorage.getItem(key);
        if (draft) {
          const parsed = JSON.parse(draft);
          if (typeof parsed === 'object' && parsed && Array.isArray(parsed.dates))
            reset({
              ...parsed,
              dates: parsed.dates.filter((v: string) => dates.some((d) => d.id === v)),
            });
        }
      } catch {
        /* Draft is optional. */
      }
    }
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values: v }) => {
        try {
          localStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* Storage may be disabled. */
        }
      },
    });
    return unsubscribe;
  }, [key, reset, initial, dates, subscribe]);
  const headings = [
    'Data diri',
    'Kapan kamu bisa?',
    'Villa mana yang kamu suka?',
    'Berangkat naik apa?',
    'Periksa jawaban',
  ];
  return (
    <form
      className="stack"
      onSubmit={handleSubmit(async (data) => {
        if (step !== 4) return;
        setError('');
        try {
          await api(`/api/events/${event.slug}/stage-1`, data);
          localStorage.removeItem(key);
          router.push(`/e/${event.slug}/dashboard`);
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        }
      })}
    >
      <div>
        <Progress value={(step + 1) * 20} className="mb-3 h-1" aria-label="Progres pengisian" />
        <small className="muted">
          Langkah {step + 1} dari 5 ·{' '}
          {['Data diri', 'Tanggal', 'Villa', 'Kendaraan', 'Review'][step]}
        </small>
      </div>
      <div>
        <h2>{headings[step]}</h2>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          {
            [
              'Tanpa bikin akun. Cukup nama dan WhatsApp untuk organizer.',
              'Tap tanggal yang luang, atau geser untuk memilih sekaligus.',
              'Lihat foto dan detailnya, lalu pilih satu villa.',
              'Bawa kendaraan sendiri? Isi pemilik dan rencana drivernya.',
              'Cek dulu sebelum dikirim. Kamu bisa mengubahnya selama voting dibuka.',
            ][step]
          }
        </p>
      </div>
      {step === 0 && (
        <div className="card stack">
          <label className="field">
            Nama kamu
            <Input autoComplete="name" placeholder="Masukkan nama kamu" {...register('name')} />
            <small>{errors.name?.message}</small>
          </label>
          <label className="field">
            Nomor WhatsApp
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="081234567890"
              {...register('whatsapp')}
            />
            <small>
              {errors.whatsapp?.message || 'Hanya organizer yang bisa melihat nomor kamu.'}
            </small>
          </label>
        </div>
      )}
      {step === 1 && (
        <div className="card stack">
          <DateGrid dates={dates} value={values.dates} onChange={(v) => setValue('dates', v)} />
          <small className="muted">
            {values.dates.length} tanggal dipilih. Boleh kosong jika belum ada tanggal yang cocok.
          </small>
        </div>
      )}
      {step === 2 && (
        <>
          <div className="grid grid-2">
            {villas
              .filter((v) => v.active)
              .map((v) => (
                <VillaCard
                  key={v.id}
                  villa={v}
                  images={images}
                  selected={values.villa_id === v.id}
                  onSelect={() => setValue('villa_id', v.id)}
                />
              ))}
          </div>
          <Notice error>{errors.villa_id ? 'Pilih satu villa terlebih dahulu.' : ''}</Notice>
        </>
      )}
      {step === 3 && (
        <div className="stack-sm">
          {(
            [
              ['CAR', 'Mobil', Car],
              ['MOTORCYCLE', 'Motor', Bike],
              ['NONE', 'Tidak ada kendaraan', Footprints],
            ] as const
          ).map(([v, l, Icon]) => (
            <button
              type="button"
              key={v}
              className={`card row between ${values.vehicle_type === v ? 'card-lime' : ''}`}
              aria-pressed={values.vehicle_type === v}
              onClick={() => {
                setValue('vehicle_type', v);
                setValue('vehicle_capacity', v === 'MOTORCYCLE' ? 2 : 5);
                if (!values.vehicle_owner) setValue('vehicle_owner', values.name);
                if (!values.vehicle_driver) setValue('vehicle_driver', values.name);
              }}
            >
              <span className="row">
                <Icon size={25} />
                {l}
              </span>
              {values.vehicle_type === v && <Check size={19} />}
            </button>
          ))}
          {values.vehicle_type !== 'NONE' && (
            <div className="card stack-sm">
              <h3>
                {values.vehicle_type === 'CAR' ? 'Mobil' : 'Motor'}{' '}
                {values.vehicle_owner || values.name}
              </h3>
              <label className="field">
                Nama pemilik kendaraan
                <Input {...register('vehicle_owner')} placeholder={values.name} maxLength={80} />
                <small>{errors.vehicle_owner?.message}</small>
              </label>
              <label className="field">
                Nama driver
                <Input {...register('vehicle_driver')} placeholder={values.name} maxLength={80} />
                <small>
                  {errors.vehicle_driver?.message ||
                    'Rencana awal; organizer akan mengonfirmasi saat menyusun transport.'}
                </small>
              </label>
              <label className="field">
                Kapasitas (termasuk driver)
                <Input
                  type="number"
                  min={1}
                  max={values.vehicle_type === 'MOTORCYCLE' ? 2 : 50}
                  {...register('vehicle_capacity')}
                />
                <small>{errors.vehicle_capacity?.message}</small>
              </label>
            </div>
          )}
        </div>
      )}
      {step === 4 && (
        <div className="card stack">
          <div>
            <small className="muted">NAMA & WHATSAPP</small>
            <h3>{values.name}</h3>
            <p>{values.whatsapp}</p>
          </div>
          <div>
            <small className="muted">TANGGAL LUANG</small>
            <p>
              {dates
                .filter((d) => values.dates.includes(d.id))
                .map((d) => prettyDate(d.date))
                .join(' · ') || 'Belum ada tanggal yang cocok'}
            </p>
          </div>
          <div>
            <small className="muted">VILLA FAVORIT</small>
            <h3>{villas.find((v) => v.id === values.villa_id)?.name}</h3>
          </div>
          <div>
            <small className="muted">KENDARAAN</small>
            <p>
              {{ CAR: 'Mobil', MOTORCYCLE: 'Motor', NONE: 'Tidak ada' }[values.vehicle_type]}{' '}
              {values.vehicle_type !== 'NONE' &&
                `${values.vehicle_owner || values.name} · Driver: ${values.vehicle_driver || values.name} · ${values.vehicle_capacity} orang`}
            </p>
          </div>
        </div>
      )}
      <Notice error>{error}</Notice>
      <div className="sticky-actions">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft size={16} />
          Kembali
        </Button>
        {step < 4 ? (
          <Button
            key="next-step"
            type="button"
            disabled={checking}
            onClick={async () => {
              const fields: (keyof Values)[][] = [
                ['name', 'whatsapp'],
                ['dates'],
                ['villa_id'],
                ['vehicle_type', 'vehicle_owner', 'vehicle_driver', 'vehicle_capacity'],
              ];
              if (!(await trigger(fields[step]))) return;
              setChecking(true);
              try {
                if (step === 0)
                  await api(`/api/events/${event.slug}/identity`, { name: values.name });
                setError('');
                setStep(step + 1);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setChecking(false);
              }
            }}
          >
            Lanjut <ArrowRight size={16} />
          </Button>
        ) : (
          <Button key="submit-response" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Mengirim…' : 'Kirim jawaban'}
            <Check size={16} />
          </Button>
        )}
      </div>
    </form>
  );
}
