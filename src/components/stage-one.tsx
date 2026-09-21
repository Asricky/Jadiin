'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Car, Bike, Footprints, Check } from 'lucide-react';
import { stage1Schema } from '@/lib/validation';
import { api, prettyDate } from '@/lib/utils';
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
    'Kenalan dulu, yuk.',
    'Kapan kamu bisa?',
    'Villa mana yang kamu suka?',
    'Berangkat naik apa?',
    'Sudah pas semuanya?',
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
        <div className="stepper">
          {headings.map((_, i) => (
            <span key={i} className={`step ${i <= step ? 'done' : ''}`} />
          ))}
        </div>
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
              'Pilih satu favoritmu. Klik lihat info untuk kenalan lebih dekat.',
              'Data ini membantu organizer menyusun perjalanan, bukan otomatis jadi driver.',
              'Cek dulu sebelum dikirim. Kamu bisa mengubahnya selama voting dibuka.',
            ][step]
          }
        </p>
      </div>
      {step === 0 && (
        <div className="card stack">
          <label className="field">
            Nama kamu
            <input autoComplete="name" placeholder="Masukkan nama kamu" {...register('name')} />
            <small>{errors.name?.message}</small>
          </label>
          <label className="field">
            Nomor WhatsApp
            <input
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
              onClick={() => setValue('vehicle_type', v)}
            >
              <span className="row">
                <Icon size={25} />
                {l}
              </span>
              {values.vehicle_type === v && <Check size={19} />}
            </button>
          ))}
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
            <p>{{ CAR: 'Mobil', MOTORCYCLE: 'Motor', NONE: 'Tidak ada' }[values.vehicle_type]}</p>
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
              const fields: ('name' | 'whatsapp' | 'dates' | 'villa_id' | 'vehicle_type')[][] = [
                ['name', 'whatsapp'],
                ['dates'],
                ['villa_id'],
                ['vehicle_type'],
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
