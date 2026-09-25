'use client';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { eventSchema } from '@/lib/validation';
import { api } from '@/lib/utils';
import { Notice } from './common';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { DatesEditor, VillaEditor } from './editors';
import { useRouter } from 'next/navigation';
export function CreateWizard() {
  const [id, setId] = useState('');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof eventSchema>, unknown, z.output<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
  });
  return (
    <div className="stack">
      <div>
        <Progress
          value={((step + 1) / 3) * 100}
          className="mb-3 h-1"
          aria-label="Progres membuat acara"
        />
        <small className="muted">
          {step + 1} / 3 · {['Tentang acara', 'Pilihan tanggal', 'Pilihan villa'][step]}
        </small>
      </div>
      {step === 0 ? (
        <form
          className="card stack"
          onSubmit={handleSubmit(async (data) => {
            try {
              const result = await api('/api/admin/events', data);
              setId(result.id);
              setStep(1);
            } catch (e) {
              setError((e as Error).message);
            }
          })}
        >
          <label className="field">
            Nama acara
            <Input
              required
              placeholder="Makrab Cerita Kita 2026"
              {...register('name', {
                onChange: (e) =>
                  setValue(
                    'slug',
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  ),
              })}
            />
          </label>
          <label className="field">
            Link acara
            <Input required {...register('slug')} placeholder="makrab-cerita-kita" />
            <small>Link peserta: /e/nama-acara</small>
          </label>
          <label className="field">
            Deskripsi
            <Textarea
              {...register('description')}
              placeholder="Ceritakan tujuan acara dan informasi yang perlu peserta tahu."
            />
          </label>
          <label className="field">
            Batas isi jawaban (WIB, opsional)
            <Input type="datetime-local" {...register('stage1_deadline')} />
          </label>
          <Notice error>
            {error ||
              Object.values(errors)
                .map((x) => x.message)
                .join(', ')}
          </Notice>
          <Button disabled={isSubmitting}>Lanjut pilih tanggal</Button>
        </form>
      ) : step === 1 ? (
        <DatesEditor eventId={id} dates={[]} onDone={() => setStep(2)} />
      ) : (
        <VillaEditor eventId={id} onDone={() => router.push(`/admin/events/${id}`)} />
      )}
    </div>
  );
}
